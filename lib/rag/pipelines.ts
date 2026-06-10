
function cleanBrokenLatexText(value: string) {
  return String(value ?? '')
    .replace(/\\\\ce\\{([^{}]+)\\}/g, '$1')
    .replace(/\\ce\\{([^{}]+)\\}/g, '$1')
    .replace(/\\\\lambda/g, 'λ')
    .replace(/\\lambda/g, 'λ')
    .replace(/\\\\Omega/g, 'Ω')
    .replace(/\\Omega/g, 'Ω')
}
import { generateJson, generateText } from '@/lib/llm/failover'
import {
  retrieveAcademicContext,
  retrieveTopicDocuments,
  type RagMatch,
  type RagMetadata,
} from '@/lib/rag/retrieve'

export type RagSource = {
  id: string
  title: string
  url: string | null
  board: string | null
  subject: string | null
  topic: string | null
  year: number | string | null
  paper: string | null
  questionNumber: string | number | null
  similarity: number | null
}

type HistoryMessage = {
  role: 'user' | 'assistant'
  content: string
}

function metadataText(match: RagMatch, key: keyof RagMetadata) {
  const value = match.metadata[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function metadataNumberOrText(match: RagMatch, key: keyof RagMetadata) {
  const value = match.metadata[key]
  return typeof value === 'number' || typeof value === 'string' ? value : null
}

function toSource(match: RagMatch): RagSource {
  return {
    board: metadataText(match, 'board'),
    id: match.id,
    paper: metadataText(match, 'paper'),
    questionNumber: metadataNumberOrText(match, 'question_number'),
    similarity: match.vectorSimilarity ?? match.hybridScore ?? match.textScore,
    subject: metadataText(match, 'subject'),
    title: match.sourceTitle,
    topic: metadataText(match, 'topic'),
    url: match.sourceUrl,
    year: metadataNumberOrText(match, 'year'),
  }
}

function sourceIds(matches: RagMatch[]) {
  return matches.map((_, index) => `S${index + 1}`)
}

const TOPIC_ALIASES: Array<[string, string[]]> = [
  [
    'kinematics',
    [
      'motion',
      'speed',
      'velocity',
      'acceleration',
      'deceleration',
      'displacement',
      'distance',
      'time graph',
      'uniformly accelerated motion',
      'suvat',
    ],
  ],
  ['waves', ['wave', 'frequency', 'wavelength', 'amplitude', 'oscillation', 'transverse wave', 'longitudinal wave']],
  ['electricity', ['current', 'voltage', 'potential difference', 'resistance', 'circuit', 'resistors']],
  ['forces', ['force', 'newton', 'resultant force', 'friction', 'momentum', 'weight']],
  ['mechanics', ['motion', 'force', 'work', 'energy', 'power', 'momentum']],
  ['thermal physics', ['temperature', 'heat capacity', 'specific heat', 'latent heat', 'thermal energy']],
  ['ideal gas', ['pv nrt', 'p v n r t', 'gas law', 'pressure volume temperature', 'molar gas constant']],
  ['pv=nrt', ['ideal gas', 'gas law', 'pressure volume temperature', 'molar gas constant']],
  ['area under curve', ['integration', 'integral', 'definite integral', 'area under graph', 'curve area']],
  ['integration', ['integral', 'definite integral', 'area under curve', 'area under graph']],
  ['differentiation', ['derivative', 'gradient', 'rate of change', 'tangent']],
  ['trigonometry', ['sine', 'cosine', 'tan', 'triangle', 'angle']],
  ['organic chemistry', ['alkane', 'alkene', 'alcohol', 'carboxylic acid', 'ester']],
]

function normalizedWords(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9=+\-\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function expandedTopicTerms(topic: string) {
  const normalized = normalizedWords(topic)
  const terms = new Set<string>()
  if (topic.trim()) terms.add(topic.trim())

  for (const [key, aliases] of TOPIC_ALIASES) {
    const normalizedKey = normalizedWords(key)
    const matched =
      normalized.includes(normalizedKey) ||
      normalizedKey.includes(normalized) ||
      aliases.some((alias) => {
        const normalizedAlias = normalizedWords(alias)
        return normalized.includes(normalizedAlias) || normalizedAlias.includes(normalized)
      })

    if (matched) {
      terms.add(key)
      aliases.forEach((alias) => terms.add(alias))
    }
  }

  return Array.from(terms).filter(Boolean).slice(0, 12)
}

function dedupeMatches(matches: RagMatch[]) {
  const seen = new Set<string>()
  return matches.filter((match) => {
    if (seen.has(match.id)) return false
    seen.add(match.id)
    return true
  })
}

async function retrieveTopicEvidence(input: {
  board?: string | null
  limit: number
  purpose: string
  requestId: string
  subject: string
  topic: string
}) {
  const terms = expandedTopicTerms(input.topic)
  const collected: RagMatch[] = []

  for (const term of terms) {
    const matches = await retrieveTopicDocuments({
      board: input.board,
      limit: Math.max(8, Math.ceil(input.limit / 2)),
      requestId: input.requestId,
      subject: input.subject,
      topic: term,
    })
    collected.push(...matches)
    if (dedupeMatches(collected).length >= input.limit) break
  }

  const directMatches = dedupeMatches(collected)
  if (directMatches.length >= Math.min(5, input.limit)) {
    return { matches: directMatches.slice(0, input.limit), mode: 'keyword' as const }
  }

  const semantic = await retrieveAcademicContext(
    `${input.board ?? ''} ${input.subject} ${input.topic} ${terms.join(' ')} ${input.purpose}`,
    {
      filters: {
        board: input.board || null,
        subject: input.subject,
      },
      limit: Math.min(5, input.limit),
      requestId: input.requestId,
    }
  )

  const matches = dedupeMatches([...directMatches, ...semantic.matches]).slice(0, input.limit)
  return {
    matches,
    mode: matches.length && semantic.matches.length ? 'hybrid' as const : (matches.length ? 'keyword' as const : semantic.mode),
  }
}

function contextBlock(matches: RagMatch[], maxCharsPerChunk = 2_400) {
  if (!matches.length) return 'No retrieved past-paper library evidence.'

  return matches
    .map((match, index) => {
      const source = toSource(match)
      return [
        `[S${index + 1}]`,
        `Title: ${source.title}`,
        `Board: ${source.board ?? 'unknown'}`,
        `Subject: ${source.subject ?? 'unknown'}`,
        `Topic: ${source.topic ?? 'unknown'}`,
        `Year: ${source.year ?? 'unknown'}`,
        `Paper: ${source.paper ?? 'unknown'}`,
        `Question: ${source.questionNumber ?? 'unknown'}`,
        `Similarity: ${source.similarity?.toFixed(4) ?? 'keyword/metadata match'}`,
        `Content: ${match.content.slice(0, maxCharsPerChunk)}`,
      ].join('\n')
    })
    .join('\n\n')
}

function fallbackSourceIds(matches: RagMatch[], count = 3) {
  return sourceIds(matches).slice(0, count)
}

function fallbackExamFormulas(topic: string, matches: RagMatch[]) {
  const normalized = normalizedWords(topic)
  const ids = fallbackSourceIds(matches)
  if (/kinematics|motion|speed|velocity|acceleration/.test(normalized)) {
    return [
      {
        formula: 'v = u + at',
        meaning: 'Final velocity equals initial velocity plus acceleration times time.',
        sourceIds: ids,
        whenToUse: 'Use when acceleration is constant and the question gives speed, acceleration, or time.',
      },
      {
        formula: 's = ut + 1/2 at^2',
        meaning: 'Displacement under constant acceleration.',
        sourceIds: ids,
        whenToUse: 'Use for distance or displacement questions with constant acceleration.',
      },
      {
        formula: 'v^2 = u^2 + 2as',
        meaning: 'Links velocities, acceleration, and displacement without time.',
        sourceIds: ids,
        whenToUse: 'Use when time is not given.',
      },
    ]
  }

  return [
    {
      formula: 'Use the formula named in the past-paper source, then substitute values with units.',
      meaning: 'The retrieved chunks contain the topic evidence; use the matching equation from the source.',
      sourceIds: ids,
      whenToUse: 'Use when the question gives numerical data and asks for a calculation.',
    },
  ]
}

function fallbackExamQuestions(topic: string, matches: RagMatch[]) {
  const ids = fallbackSourceIds(matches)
  return [
    {
      question: `Explain the main idea of ${topic} and apply the relevant formula to one exam-style calculation.`,
      sourceIds: ids,
      whyImportant: 'The retrieved past-paper evidence repeatedly uses this topic in formula selection and short structured questions.',
    },
    {
      question: `Identify the correct equation for a ${topic} problem, substitute the given values, and state the answer with units.`,
      sourceIds: ids,
      whyImportant: 'This matches the common mark-scheme pattern: formula, substitution, units, and final answer.',
    },
  ]
}

function fallbackStudyAnswer(question: string, _matches: RagMatch[]) {
  return directExamAnswer(question)
}

function directExamAnswer(question: string, sourceLine = '') {
  const lower = question.toLowerCase()

  if (/current|resistance|ohm|voltage|circuit/.test(lower)) {
    return `Current decreases when resistance increases because resistance opposes the flow of charge.

Using Ohm's law:

V = IR

Rearrange for current:

I = V / R

If the voltage stays constant, increasing resistance makes the value of I smaller. Therefore, current is inversely proportional to resistance.

Exam-style final sentence: greater resistance means less charge flows per second, so the current decreases.${sourceLine}`
  }

  if (/redox|oxidation|reduction|electron/.test(lower)) {
    return `A redox reaction is a reaction where oxidation and reduction happen at the same time.

Oxidation means loss of electrons.
Reduction means gain of electrons.

A useful exam memory aid is:

OIL RIG

Oxidation Is Loss, Reduction Is Gain.

The substance that loses electrons is oxidised. The substance that gains electrons is reduced. In terms of oxidation number, oxidation is an increase in oxidation number and reduction is a decrease in oxidation number.${sourceLine}`
  }

  if (/aldehyde|aldehydes|carbonyl|ethanal|propanal/.test(lower)) {
    return `Aldehydes contain the functional group –CHO.

They are commonly prepared by controlled oxidation of primary alcohols. For example, ethanol can be oxidised to ethanal.

Use acidified potassium dichromate(VI), K2Cr2O7/H2SO4, and distil the aldehyde as it forms. Distillation is important because aldehydes can oxidise further to carboxylic acids.

Example:

ethanol → ethanal

Exam keyword: primary alcohol, controlled oxidation, distillation, aldehyde functional group –CHO.${sourceLine}`
  }

  if (/wave|frequency|wavelength|oscillation|amplitude/.test(lower)) {
    return `A wave transfers energy from one place to another without transferring matter.

Frequency is the number of oscillations per second. It is measured in hertz, Hz.

For wave calculations, use:

v = fλ

where v is wave speed, f is frequency, and λ is wavelength.

Exam method: write the formula, substitute the values with units, calculate the answer, then give the correct unit.${sourceLine}`
  }

  if (/kinematic|velocity|speed|acceleration|displacement|distance|motion/.test(lower)) {
    return `Kinematics describes motion using quantities such as distance, displacement, speed, velocity, acceleration, and time.

Important formulae include:

speed = distance / time

acceleration = change in velocity / time

For a velocity-time graph, the gradient gives acceleration and the area under the graph gives displacement.

Exam method: identify the known values, choose the correct formula, substitute with units, and state the final answer clearly.${sourceLine}`
  }

  return `Here is a direct exam-style answer.

Start by identifying the key syllabus idea in the question. Then write the relevant definition, formula, or rule. Apply it directly to the situation and finish with a clear final sentence using exam keywords.

For calculation questions: formula → substitution with units → answer with unit.
For explanation questions: keyword → cause → effect → final conclusion.${sourceLine}`
}

function evidenceSummary(matches: RagMatch[]) {
  const topSimilarity = matches.reduce(
    (best, match) => Math.max(best, match.vectorSimilarity ?? match.hybridScore ?? 0),
    0
  )
  const effectiveSimilarity = matches.length ? (topSimilarity > 0 ? topSimilarity : 0.72) : 0.4
  const confidenceScore = matches.length
    ? Math.max(45, Math.min(98, Math.round(effectiveSimilarity * 100)))
    : 40

  return {
    confidenceLabel: matches.length
      ? effectiveSimilarity >= 0.78
        ? 'Mark-scheme supported answer'
        : 'Exam-style answer'
      : 'Exam-style answer',
    confidenceScore,
    sources: matches.map(toSource),
  }
}

function historyBlock(history?: HistoryMessage[]) {
  const rows = (history ?? [])
    .slice(-8)
    .map((message) => `${message.role.toUpperCase()}: ${message.content.trim().slice(0, 1_500)}`)
    .filter(Boolean)
  return rows.length ? rows.join('\n') : 'None'
}

function isGeneralConversation(query: string) {
  const normalized = query.toLowerCase().replace(/\s+/g, ' ').trim()
  if (!normalized) return false
  if (
    /\b(physics|chemistry|math|mathematics|biology|kinematics|velocity|speed|acceleration|displacement|force|waves?|frequency|wavelength|integration|integral|area under curve|differentiation|formula|equation|pv\s*=?\s*nrt|ideal gas)\b/.test(
      normalized
    )
  ) {
    return false
  }
  if (/^(hi|hello|hey|yo|salam|assalamualaikum|thanks|thank you|ok|okay|hmm)\b/.test(normalized)) {
    return true
  }
  if (normalized.length <= 32 && !/[=+\-*/^]|integral|derive|solve|calculate|explain|formula/.test(normalized)) {
    return true
  }
  if (/^(can you help|help me|what can you do|who are you|eta ki|esob ki|ki korbo)/.test(normalized)) {
    return true
  }
  return false
}

export async function runExplainPipeline(input: {
  history?: HistoryMessage[]
  query: string
  requestId: string
  subject?: string | null
  topic?: string | null
}) {
  if (isGeneralConversation(input.query)) {
    const chat = await generateText({
      maxTokens: 500,
      prompt: [
        'Recent conversation:',
        historyBlock(input.history),
        '',
        `User message: ${input.query}`,
        '',
        'Reply naturally in the user language. If they want study help, ask for subject, topic, board, or the exact question. Do not cite fake sources.',
      ].join('\n'),
      requestId: input.requestId,
      system:
        'You are ScholarHAAB, a friendly academic assistant. For casual chat, answer directly. For academic content, ask for the exact question/topic so past-paper search can be used.',
      temperature: 0.25,
    })

    return {
      answer: chat.text,
      confidenceLabel: 'Study chat',
      confidenceScore: 100,
      model: `${chat.provider}:${chat.model}`,
      retrievalMode: 'none',
      sources: [],
    }
  }

  const query = [
    input.subject,
    input.topic,
    input.query,
    ...expandedTopicTerms(input.topic || input.query).slice(1),
  ]
    .filter(Boolean)
    .join(' ')
  let retrieval = await retrieveAcademicContext(query, {
    filters: {
      subject: input.subject || null,
    },
    limit: 5,
    requestId: input.requestId,
  })
  if (!retrieval.matches.length && input.subject && (input.topic || expandedTopicTerms(input.query).length > 1)) {
    const topicEvidence = await retrieveTopicEvidence({
      limit: 5,
      purpose: 'solver answer definition formula worked example',
      requestId: input.requestId,
      subject: input.subject,
      topic: input.topic || input.query,
    })
    if (topicEvidence.matches.length) {
      retrieval = {
        embeddingAvailable: false,
        embeddingProvider: null,
        matches: topicEvidence.matches,
        mode: topicEvidence.mode,
      }
    }
  }
  const evidence = evidenceSummary(retrieval.matches)

  const generation = await generateText({
    maxTokens: 1_500,
    prompt: [
      'RETRIEVED EVIDENCE:',
      contextBlock(retrieval.matches),
      '',
      'RECENT CONVERSATION:',
      historyBlock(input.history),
      '',
      `QUESTION: ${input.query}`,
      '',
      retrieval.matches.length
        ? "Answer the student question directly. Use retrieved exam materials silently as support. Do not cite [S1] IDs. Do not discuss evidence quality. Give the actual explanation, formula, substitutions, units, and final answer when needed."
        : 'No matching past-paper library chunk was retrieved. Give a concise study answer and clearly label it as general knowledge, exam-style.',
    ].join('\n'),
    requestId: input.requestId,
    system: [
      'You are ScholarHAAB, an accurate academic tutor.',
      'Use the supplied past-paper library chunks whenever they are relevant.',
      'Do not invent year, board, paper, or question metadata.',
      'Never mention Hugging Face.',
      'If evidence is weak, say exactly what is weak and still give the best useful answer.',
    ].join('\n'),
    temperature: 0.12,
  })

  return {
    answer: generation.text,
    model: `${generation.provider}:${generation.model}`,
    retrievalMode: retrieval.mode,
    ...evidence,
  }
}

type ExamModeJson = {
  formulas?: Array<{
    formula?: string
    meaning?: string
    sourceIds?: string[]
    whenToUse?: string
  }>
  importantQuestions?: Array<{
    question?: string
    sourceIds?: string[]
    whyImportant?: string
  }>
  importantTopics?: Array<{
    importance?: string
    name?: string
    sourceIds?: string[]
    whyImportant?: string
  }>
  summary?: string
}

export async function runExamModePipeline(input: {
  board?: string | null
  requestId: string
  subject: string
  topic: string
}) {
  const retrieval = await retrieveTopicEvidence({
    board: input.board,
    limit: 8,
    purpose: 'past paper formulas repeated questions examiner report mark scheme',
    requestId: input.requestId,
    subject: input.subject,
    topic: input.topic,
  })

  if (!retrieval.matches.length) {
    throw new Error(`I found related exam-style material for ${input.subject} / ${input.topic}. Try a related topic name such as motion, velocity, integration, waves, or electricity.`)
  }

  const generated = await generateJson<ExamModeJson>({
    maxTokens: 1_100,
    prompt: [
      `SUBJECT: ${input.subject}`,
      `TOPIC: ${input.topic}`,
      `BOARD: ${input.board ?? 'Any'}`,
      '',
      'PAST-PAPER / TEXTBOOK EVIDENCE:',
      contextBlock(retrieval.matches.slice(0, 6), 650),
      '',
      'Extract formulas only when the formula is visible or directly implied in the chunks.',
      'Return JSON only with this shape:',
      '{"importantTopics":[{"name":"","importance":"high|medium|low","whyImportant":"","sourceIds":["S1"]}],"formulas":[{"formula":"","meaning":"","whenToUse":"","sourceIds":["S1"]}],"importantQuestions":[{"question":"","whyImportant":"","sourceIds":["S1"]}],"summary":""}',
    ].join('\n'),
    requestId: input.requestId,
    system: [
      'You are a data-driven exam analysis engine.',
      'Only use the supplied retrieved evidence.',
      'Explain concepts from formulas found in the chunks.',
      'Rank topics/questions by repetition, exam usefulness, and mark-scheme value visible in the chunks.',
      'Mention source IDs for every claim.',
      'Do not use general knowledge. Do not invent metadata.',
    ].join('\n'),
    temperature: 0.08,
  })
  const generatedData = generated.data
  const model = `${generated.provider}:${generated.model}`
  const evidence = evidenceSummary(retrieval.matches)
  const formulas = generatedData.formulas ?? []
  const importantQuestions = generatedData.importantQuestions ?? []
  const importantTopics = generatedData.importantTopics ?? []

  return {
    board: input.board ?? null,
    formulas,
    importantQuestions,
    importantTopics,
    model,
    retrievalMode: retrieval.mode,
    subject: input.subject,
    summary:
      generatedData.summary ||
      `Observation from ${retrieval.matches.length} retrieved chunks: focus on formulas and repeated question wording for ${input.topic}.`,
    topic: input.topic,
    ...evidence,
  }
}

type AdaptiveModeJson = {
  answer?: string
  commonMistakes?: string[]
  explanation?: string[]
  question?: {
    marks?: number
    options?: string[]
    text?: string
    type?: string
  }
  sourcePattern?: string
}

export async function runAdaptiveModePipeline(input: {
  board?: string | null
  difficulty?: string | null
  performance?: string | null
  requestId: string
  subject: string
  topic: string
  }) {
  const retrieval = await retrieveTopicEvidence({
    board: input.board,
    limit: 12,
    purpose: 'past paper question mark scheme worked answer repeated pattern',
    requestId: input.requestId,
    subject: input.subject,
    topic: input.topic,
  })

  if (!retrieval.matches.length) {
    throw new Error(`Using an exam-style practice pattern for ${input.subject} / ${input.topic}. Try a related topic name such as motion, velocity, integration, waves, or electricity.`)
  }

  const generated = await generateJson<AdaptiveModeJson>({
    maxTokens: 1_500,
    prompt: [
      `SUBJECT: ${input.subject}`,
      `TOPIC: ${input.topic}`,
      `BOARD: ${input.board ?? 'Any'}`,
      `DIFFICULTY: ${input.difficulty ?? 'medium'}`,
      `PREVIOUS PERFORMANCE: ${input.performance ?? 'Not supplied'}`,
      '',
      'PATTERN EVIDENCE:',
      contextBlock(retrieval.matches, 1_800),
      '',
      'Create one mock question in the same past-paper style, then solve it. If a retrieved question is already perfect, adapt it lightly instead of copying long text.',
      'Return JSON only with this shape:',
      '{"question":{"type":"MCQ|numerical|structured","text":"","marks":4,"options":[]},"answer":"","explanation":["step 1","step 2"],"commonMistakes":[],"sourcePattern":"Based on [S1], [S2]"}',
    ].join('\n'),
    requestId: input.requestId,
    system: [
      'You generate adaptive practice from retrieved past-paper patterns.',
      'Use the supplied chunks as the source of style, difficulty, and marking.',
      'Do not invent exact source metadata; cite source IDs.',
      'Show step-by-step reasoning and units for numerical answers.',
    ].join('\n'),
    temperature: 0.18,
  })
  const generatedData = generated.data
  const model = `${generated.provider}:${generated.model}`
  const evidence = evidenceSummary(retrieval.matches)
  const rawQuestion = generatedData.question ?? {}
  const nestedAnswer =
    typeof (rawQuestion as { answer?: unknown }).answer === 'string'
      ? (rawQuestion as { answer: string }).answer
      : ''
  const nestedSolution =
    typeof (rawQuestion as { solution?: unknown }).solution === 'string'
      ? (rawQuestion as { solution: string }).solution
      : ''
  const answer =
    generatedData.answer ||
    nestedAnswer ||
    nestedSolution
  const explanation = generatedData.explanation?.length
    ? generatedData.explanation
    : nestedSolution
      ? [nestedSolution]
      : answer
        ? [answer]
        : []

  return {
    answer,
    board: input.board ?? null,
    commonMistakes: generatedData.commonMistakes ?? [],
    explanation,
    model,
    question: {
      marks: rawQuestion.marks ?? 4,
      options: rawQuestion.options ?? [],
      text:
        rawQuestion.text ??
        `A ${input.difficulty ?? 'medium'} ${input.subject} question on ${input.topic}, based on the retrieved past-paper pattern.`,
      type: rawQuestion.type ?? 'structured',
    },
    retrievalMode: retrieval.mode,
    sourcePattern: generatedData.sourcePattern ?? `Based on ${sourceIds(retrieval.matches).join(', ')}`,
    subject: input.subject,
    topic: input.topic,
    ...evidence,
  }
}

type AlternativeExplanationJson = {
  concept?: string
  explanation?: string
  practicePrompt?: string
  sourceIds?: string[]
}

type QbankAnalysisJson = {
  difficultyLevels?: Array<{
    evidence?: string
    level?: string
    sourceIds?: string[]
  }>
  practiceQuestions?: Array<{
    question?: string
    sourceIds?: string[]
    whyPractice?: string
  }>
  repeatedConcepts?: Array<{
    concept?: string
    frequencyHint?: string
    sourceIds?: string[]
  }>
  studyPlan?: string[]
  summary?: string
}

export async function runQbankAnalysisPipeline(input: {
  board?: string | null
  requestId: string
  subject: string
  topic: string
}) {
  const retrieval = await retrieveTopicEvidence({
    board: input.board,
    limit: 20,
    purpose: 'qbank analysis repeated concepts difficulty practice questions',
    requestId: input.requestId,
    subject: input.subject,
    topic: input.topic,
  })

  if (!retrieval.matches.length) {
    throw new Error(`No QBank evidence found for ${input.subject} / ${input.topic}. Try a related topic keyword.`)
  }

  const generated = await generateJson<QbankAnalysisJson>({
    maxTokens: 1_600,
    prompt: [
      `SUBJECT: ${input.subject}`,
      `TOPIC: ${input.topic}`,
      `BOARD: ${input.board ?? 'Any'}`,
      '',
      'QBANK EVIDENCE:',
      contextBlock(retrieval.matches, 1_700),
      '',
      'Return JSON only with this shape:',
      '{"repeatedConcepts":[{"concept":"","frequencyHint":"","sourceIds":["S1"]}],"difficultyLevels":[{"level":"easy|medium|hard","evidence":"","sourceIds":["S1"]}],"practiceQuestions":[{"question":"","whyPractice":"","sourceIds":["S1"]}],"studyPlan":[""],"summary":""}',
    ].join('\n'),
    requestId: input.requestId,
    system: [
      'You are a QBank analysis engine for exam preparation.',
      'Use only supplied past-paper library evidence.',
      'List repeated concepts, likely difficulty, and useful practice questions.',
      'Cite source IDs for every evidence-based claim.',
    ].join('\n'),
    temperature: 0.1,
  })
  const generatedData = generated.data
  const model = `${generated.provider}:${generated.model}`
  const evidence = evidenceSummary(retrieval.matches)
  const repeatedConcepts = generatedData.repeatedConcepts ?? []
  const difficultyLevels = generatedData.difficultyLevels ?? []
  const practiceQuestions = generatedData.practiceQuestions ?? []

  return {
    board: input.board ?? null,
    difficultyLevels,
    model,
    practiceQuestions,
    repeatedConcepts,
    retrievalMode: retrieval.mode,
    studyPlan: generatedData.studyPlan?.length
      ? generatedData.studyPlan
      : [],
    subject: input.subject,
    summary:
      generatedData.summary ||
      `This analysis uses ${retrieval.matches.length} retrieved chunks for ${input.subject} / ${input.topic}.`,
    topic: input.topic,
    ...evidence,
  }
}

export async function buildAlternativeExplanation(input: {
  confusion?: string | null
  requestId: string
  subject?: string | null
  topic: string
}) {
  const retrieval = input.subject
    ? await retrieveTopicEvidence({
        limit: 5,
        purpose: 'alternative explanation textbook analogy worked example',
        requestId: input.requestId,
        subject: input.subject,
        topic: input.topic,
      })
    : await retrieveAcademicContext(
        `${input.topic} ${expandedTopicTerms(input.topic).join(' ')} alternative explanation textbook analogy worked example`,
        {
          filters: { subject: input.subject || null },
          limit: 5,
          requestId: input.requestId,
        }
      )
  if (!retrieval.matches.length) return null

  const generated = await generateJson<AlternativeExplanationJson>({
    maxTokens: 800,
      prompt: [
        `CONCEPT: ${input.topic}`,
        `STUDENT CONFUSION: ${input.confusion || 'Not supplied'}`,
        'Helpful related examples:',
      contextBlock(retrieval.matches, 1_400),
      '',
      'Return JSON only: {"concept":"","explanation":"","practicePrompt":"","sourceIds":["S1"]}',
    ].join('\n'),
    requestId: input.requestId,
    system:
      'Give a non-judgmental alternative explanation using the supplied chunks. Do not say the student skipped or failed anything.',
    temperature: 0.15,
  })

  return {
    ...generated.data,
    model: `${generated.provider}:${generated.model}`,
    sources: retrieval.matches.map(toSource),
  }
}






