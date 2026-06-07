import { generateJson, generateText } from '@/lib/llm/client'
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

function contextBlock(matches: RagMatch[], maxCharsPerChunk = 2_400) {
  if (!matches.length) return 'No retrieved corpus evidence.'

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

function evidenceSummary(matches: RagMatch[]) {
  const topSimilarity = matches.reduce(
    (best, match) => Math.max(best, match.vectorSimilarity ?? match.hybridScore ?? 0),
    0
  )
  const confidenceScore = matches.length
    ? Math.max(35, Math.min(98, Math.round(topSimilarity * 100)))
    : 25

  return {
    confidenceLabel: matches.length
      ? topSimilarity >= 0.78
        ? 'STRONG_CORPUS_MATCH'
        : 'PARTIAL_CORPUS_MATCH'
      : 'GENERAL_KNOWLEDGE_NO_CORPUS_MATCH',
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
        'You are ScholarHAAB, a friendly academic assistant. For casual chat, answer directly. For academic content, ask for the exact question/topic so RAG can be used.',
      temperature: 0.25,
    })

    return {
      answer: chat.text,
      confidenceLabel: 'GENERAL_CHAT',
      confidenceScore: 100,
      model: `${chat.provider}:${chat.model}`,
      retrievalMode: 'none',
      sources: [],
    }
  }

  const query = [input.subject, input.topic, input.query].filter(Boolean).join(' ')
  const retrieval = await retrieveAcademicContext(query, {
    filters: {
      subject: input.subject || null,
    },
    limit: 5,
    requestId: input.requestId,
  })
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
        ? 'Answer using the retrieved evidence first. Cite source IDs like [S1]. Include formulas, substitutions, units, and a final answer when needed.'
        : 'No matching corpus chunk was retrieved. Give a concise general academic answer and clearly label it as general knowledge, not past-paper based.',
    ].join('\n'),
    requestId: input.requestId,
    system: [
      'You are ScholarHAAB, an accurate academic tutor.',
      'Use the supplied corpus chunks whenever they are relevant.',
      'Do not invent year, board, paper, or question metadata.',
      'Never say UNSUPPORTED. Never mention Hugging Face.',
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
  const directMatches = await retrieveTopicDocuments({
    board: input.board,
    limit: 18,
    requestId: input.requestId,
    subject: input.subject,
    topic: input.topic,
  })
  const retrieval = directMatches.length
    ? { matches: directMatches, mode: 'keyword' as const }
    : await retrieveAcademicContext(
        `${input.board ?? ''} ${input.subject} ${input.topic} repeated past paper formulas questions examiner report mark scheme`,
        {
          filters: {
            board: input.board || null,
            subject: input.subject,
          },
          limit: 5,
          requestId: input.requestId,
        }
      )

  if (!retrieval.matches.length) {
    throw new Error(`No indexed past-paper data found for ${input.subject} / ${input.topic}.`)
  }

  const generated = await generateJson<ExamModeJson>({
    maxTokens: 1_700,
    prompt: [
      `SUBJECT: ${input.subject}`,
      `TOPIC: ${input.topic}`,
      `BOARD: ${input.board ?? 'Any'}`,
      '',
      'PAST-PAPER / TEXTBOOK EVIDENCE:',
      contextBlock(retrieval.matches, 1_800),
      '',
      'Return JSON only with this shape:',
      '{"importantTopics":[{"name":"","importance":"high|medium|low","whyImportant":"","sourceIds":["S1"]}],"formulas":[{"formula":"","meaning":"","whenToUse":"","sourceIds":["S1"]}],"importantQuestions":[{"question":"","whyImportant":"","sourceIds":["S1"]}],"summary":""}',
    ].join('\n'),
    requestId: input.requestId,
    system: [
      'You are a data-driven exam analysis engine.',
      'Only use the supplied retrieved evidence.',
      'Rank topics/questions by repetition, exam usefulness, and mark-scheme value visible in the chunks.',
      'Mention source IDs for every claim.',
      'Do not use general knowledge. Do not invent metadata.',
    ].join('\n'),
    temperature: 0.08,
  })
  const evidence = evidenceSummary(retrieval.matches)

  return {
    board: input.board ?? null,
    formulas: generated.data.formulas ?? [],
    importantQuestions: generated.data.importantQuestions ?? [],
    importantTopics: generated.data.importantTopics ?? [],
    model: `${generated.provider}:${generated.model}`,
    retrievalMode: retrieval.mode,
    subject: input.subject,
    summary: generated.data.summary ?? '',
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
  const directMatches = await retrieveTopicDocuments({
    board: input.board,
    limit: 12,
    requestId: input.requestId,
    subject: input.subject,
    topic: input.topic,
  })
  const retrieval = directMatches.length
    ? { matches: directMatches, mode: 'keyword' as const }
    : await retrieveAcademicContext(
        `${input.subject} ${input.topic} ${input.difficulty ?? 'medium'} past paper question mark scheme`,
        {
          filters: {
            board: input.board || null,
            subject: input.subject,
          },
          limit: 5,
          requestId: input.requestId,
        }
      )

  if (!retrieval.matches.length) {
    throw new Error(`No past-paper pattern found for ${input.subject} / ${input.topic}.`)
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
  const evidence = evidenceSummary(retrieval.matches)

  return {
    answer: generated.data.answer ?? '',
    board: input.board ?? null,
    commonMistakes: generated.data.commonMistakes ?? [],
    explanation: generated.data.explanation ?? [],
    model: `${generated.provider}:${generated.model}`,
    question: generated.data.question ?? { marks: 0, options: [], text: '', type: 'structured' },
    retrievalMode: retrieval.mode,
    sourcePattern: generated.data.sourcePattern ?? `Based on ${sourceIds(retrieval.matches).join(', ')}`,
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

export async function buildAlternativeExplanation(input: {
  requestId: string
  subject?: string | null
  topic: string
}) {
  const retrieval = await retrieveAcademicContext(
    `${input.subject ?? ''} ${input.topic} alternative explanation textbook analogy worked example`,
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
      'ALTERNATIVE SOURCE CHUNKS:',
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
