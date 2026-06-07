import {
  generateHuggingFaceJson,
  generateHuggingFaceText,
} from '@/lib/rag/embedding'
import {
  retrieveAcademicContext,
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

function toSource(match: RagMatch): RagSource {
  const year = match.metadata.year
  const questionNumber = match.metadata.question_number
  return {
    id: match.id,
    title: match.sourceTitle,
    url: match.sourceUrl,
    board: metadataText(match, 'board'),
    subject: metadataText(match, 'subject'),
    topic: metadataText(match, 'topic'),
    year:
      typeof year === 'number' || typeof year === 'string' ? year : null,
    paper: metadataText(match, 'paper'),
    questionNumber:
      typeof questionNumber === 'number' || typeof questionNumber === 'string'
        ? questionNumber
        : null,
    similarity: match.vectorSimilarity,
  }
}

function contextBlock(matches: RagMatch[]) {
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
        `Similarity: ${source.similarity?.toFixed(4) ?? 'keyword match'}`,
        `Content: ${match.content.slice(0, 4_000)}`,
      ].join('\n')
    })
    .join('\n\n')
}

function evidenceSummary(matches: RagMatch[]) {
  const topSimilarity = matches.reduce(
    (best, match) => Math.max(best, match.vectorSimilarity ?? 0),
    0
  )
  return {
    confidenceScore: matches.length ? Math.round(topSimilarity * 100) : 20,
    confidenceLabel: matches.length
      ? topSimilarity >= 0.8
        ? 'STRONG_CORPUS_MATCH'
        : 'PARTIAL_CORPUS_MATCH'
      : 'AI_SYNTHESIS_NO_CORPUS_MATCH',
    sources: matches.map(toSource),
  }
}

function sourceIds(matches: RagMatch[]) {
  return matches.slice(0, 5).map((_, index) => `S${index + 1}`)
}

function buildExplainFallback(query: string, matches: RagMatch[]) {
  const firstSource = matches[0] ? toSource(matches[0]) : null
  return [
    'The Hugging Face model is temporarily busy, so I am using the retrieved context and a safe study workflow instead of failing.',
    '',
    `Question: ${query}`,
    '',
    matches.length
      ? `Matched source: ${firstSource?.title ?? 'Academic source'}${
          firstSource?.year ? ` (${firstSource.year})` : ''
        }.`
      : 'No strong past-paper source was returned for this exact question.',
    '',
    'How to answer it step by step:',
    '1. Identify the topic and command word in the question.',
    '2. Write the relevant definition or formula before substituting values.',
    '3. Keep units with every numerical step.',
    '4. Finish with a clear final answer and a short exam-style statement.',
    '',
    matches.length
      ? `Use the retrieved evidence IDs ${sourceIds(matches).join(', ')} as the source basis.`
      : 'Try again in a moment for the full AI-generated explanation.',
  ].join('\n')
}

export async function runExplainPipeline(input: {
  query: string
  subject?: string | null
  topic?: string | null
  history?: HistoryMessage[]
  requestId: string
}) {
  const query = [input.subject, input.topic, input.query].filter(Boolean).join(' ')
  const retrieval = await retrieveAcademicContext(query, {
    filters: {
      subject: input.subject || null,
    },
    requestId: input.requestId,
    limit: 5,
  })
  const evidence = evidenceSummary(retrieval.matches)
  const history = (input.history ?? [])
    .slice(-8)
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join('\n')

  const generation = await generateHuggingFaceText({
    system: [
      'You are ScholarHAAB, an accurate academic tutor.',
      'Explain concepts, theories, and formulas step by step.',
      'Use retrieved evidence when it is relevant and cite it as [S1], [S2], etc.',
      'Never invent source metadata.',
      'When corpus evidence is absent, still answer helpfully but explicitly state that the explanation is an AI synthesis without a matched past-paper source.',
      'Never output UNSUPPORTED or a generic fallback template.',
    ].join('\n'),
    prompt: [
      'RETRIEVED EVIDENCE:',
      contextBlock(retrieval.matches),
      '',
      'RECENT CONVERSATION:',
      history || 'None',
      '',
      `QUESTION: ${input.query}`,
      '',
      'Give a direct explanation with definitions, formulas, worked steps, units, and a final result when applicable.',
    ].join('\n'),
    maxTokens: 1_500,
    fallbackText: buildExplainFallback(input.query, retrieval.matches),
  })

  return {
    answer: generation.text,
    model: generation.model,
    retrievalMode: retrieval.mode,
    ...evidence,
  }
}

type ExamModeJson = {
  importantTopics?: Array<{
    name?: string
    importance?: string
    whyImportant?: string
    sourceIds?: string[]
  }>
  formulas?: Array<{
    formula?: string
    meaning?: string
    whenToUse?: string
    sourceIds?: string[]
  }>
  importantQuestions?: Array<{
    question?: string
    whyImportant?: string
    sourceIds?: string[]
  }>
  summary?: string
}

function buildExamFallback(
  input: { subject: string; topic: string; board?: string | null },
  matches: RagMatch[]
): ExamModeJson {
  const ids = sourceIds(matches)
  return {
    importantTopics: [
      {
        name: input.topic,
        importance: matches.length ? 'high' : 'medium',
        whyImportant: matches.length
          ? `This topic appears in the retrieved past-paper evidence (${ids.join(', ')}).`
          : 'No indexed past-paper match was found yet, so this is syllabus-based guidance.',
        sourceIds: ids,
      },
    ],
    formulas: [
      {
        formula: 'Review the core formula list for this topic.',
        meaning: 'Use the exact formula that matches the command word and given data.',
        whenToUse: `When a ${input.subject} question asks for a calculation or explanation in ${input.topic}.`,
        sourceIds: ids,
      },
    ],
    importantQuestions: matches.length
      ? matches.slice(0, 5).map((match, index) => ({
          question: match.content.slice(0, 260),
          whyImportant: `Retrieved as source S${index + 1} for ${input.topic}.`,
          sourceIds: [`S${index + 1}`],
        }))
      : [
          {
            question: `Explain the main idea of ${input.topic} and apply it to one exam-style problem.`,
            whyImportant:
              'This is a safe starter question until the past-paper index has enough matching documents.',
            sourceIds: [],
          },
        ],
    summary: matches.length
      ? 'Generated from retrieved past-paper chunks while Hugging Face generation was unavailable.'
      : 'No matching corpus evidence was found. Ingest more past papers for stronger predictions.',
  }
}

export async function runExamModePipeline(input: {
  subject: string
  topic: string
  board?: string | null
  requestId: string
}) {
  const query = `${input.board ?? ''} ${input.subject} ${input.topic} past paper questions formulas repeated important exam patterns`
  const retrieval = await retrieveAcademicContext(query, {
    filters: {
      board: input.board || null,
      subject: input.subject,
    },
    requestId: input.requestId,
    limit: 5,
  })
  const evidence = evidenceSummary(retrieval.matches)
  const generated = await generateHuggingFaceJson<ExamModeJson>({
    system: [
      'You are an exam-analysis engine.',
      'Base claims on the retrieved past-paper evidence and reference source IDs such as S1.',
      'Never invent a year, board, formula, question, or source.',
      'If evidence is thin, say so in the summary and provide cautious syllabus guidance.',
      'Never output UNSUPPORTED.',
      'Return valid JSON only.',
    ].join('\n'),
    prompt: [
      `SUBJECT: ${input.subject}`,
      `TOPIC: ${input.topic}`,
      `BOARD: ${input.board ?? 'Any'}`,
      '',
      'EVIDENCE:',
      contextBlock(retrieval.matches),
      '',
      'Return this JSON shape:',
      '{"importantTopics":[{"name":"","importance":"high|medium|low","whyImportant":"","sourceIds":["S1"]}],"formulas":[{"formula":"","meaning":"","whenToUse":"","sourceIds":["S1"]}],"importantQuestions":[{"question":"","whyImportant":"","sourceIds":["S1"]}],"summary":""}',
    ].join('\n'),
    maxTokens: 1_500,
    fallbackData: buildExamFallback(input, retrieval.matches),
  })

  return {
    subject: input.subject,
    topic: input.topic,
    board: input.board ?? null,
    importantTopics: generated.data.importantTopics ?? [],
    formulas: generated.data.formulas ?? [],
    importantQuestions: generated.data.importantQuestions ?? [],
    summary: generated.data.summary ?? '',
    model: generated.model,
    retrievalMode: retrieval.mode,
    ...evidence,
  }
}

type AdaptiveModeJson = {
  question?: {
    type?: string
    text?: string
    marks?: number
    options?: string[]
  }
  answer?: string
  explanation?: string[]
  commonMistakes?: string[]
  sourcePattern?: string
}

function buildAdaptiveFallback(
  input: {
    subject: string
    topic: string
    board?: string | null
    difficulty?: string | null
    performance?: string | null
  },
  matches: RagMatch[]
): AdaptiveModeJson {
  const source = matches[0] ? toSource(matches[0]) : null
  const topic = input.topic.toLowerCase()
  if (topic.includes('kinematic')) {
    return {
      question: {
        type: 'numerical',
        text: 'A car starts from rest and accelerates uniformly at 2.0 m/s^2 for 6.0 s. Find its final velocity and distance travelled.',
        marks: 4,
        options: [],
      },
      answer: 'Final velocity = 12 m/s; distance = 36 m.',
      explanation: [
        'Use v = u + at with u = 0, a = 2.0 m/s^2, t = 6.0 s.',
        'v = 0 + (2.0)(6.0) = 12 m/s.',
        'Use s = ut + 1/2 at^2.',
        's = 0 + 1/2(2.0)(6.0)^2 = 36 m.',
      ],
      commonMistakes: ['Forgetting that starts from rest means u = 0.', 'Leaving out units.'],
      sourcePattern: source
        ? `Based on retrieved pattern ${source.year ?? ''} ${source.board ?? ''} (${source.title}).`
        : 'No matched corpus evidence; generated as a syllabus-style practice question.',
    }
  }

  if (topic.includes('integrat')) {
    return {
      question: {
        type: 'structured',
        text: 'Find the area under y = 2x + 1 from x = 0 to x = 3.',
        marks: 4,
        options: [],
      },
      answer: '12 square units.',
      explanation: [
        'Area under a curve is found by definite integration.',
        'Integrate 2x + 1 to get x^2 + x.',
        'Evaluate from 0 to 3: (3^2 + 3) - (0^2 + 0).',
        'The area is 12 square units.',
      ],
      commonMistakes: ['Using the gradient instead of the integral.', 'Forgetting the lower limit.'],
      sourcePattern: source
        ? `Based on retrieved pattern ${source.year ?? ''} ${source.board ?? ''} (${source.title}).`
        : 'No matched corpus evidence; generated as a syllabus-style practice question.',
    }
  }

  return {
    question: {
      type: 'structured',
      text: `Explain the key idea of ${input.topic}, then solve one ${input.difficulty ?? 'medium'} ${input.subject} exam-style application.`,
      marks: 4,
      options: [],
    },
    answer: 'A complete answer should include the definition, formula or rule, substitution/application, and final statement.',
    explanation: [
      'State the core concept first.',
      'Choose the formula or rule that matches the given data.',
      'Apply it step by step.',
      'Check units, signs, and the final wording.',
    ],
    commonMistakes: ['Skipping the formula step.', 'Writing a final answer without units or explanation.'],
    sourcePattern: source
      ? `Based on retrieved pattern ${source.year ?? ''} ${source.board ?? ''} (${source.title}).`
      : 'No matched corpus evidence; generated as a syllabus-style practice question.',
  }
}

export async function runAdaptiveModePipeline(input: {
  subject: string
  topic: string
  board?: string | null
  difficulty?: string | null
  performance?: string | null
  requestId: string
}) {
  const currentYear = new Date().getFullYear()
  const query = `${input.board ?? ''} ${input.subject} ${input.topic} common similar past paper question mark scheme`
  const retrieval = await retrieveAcademicContext(query, {
    filters: {
      board: input.board || null,
      subject: input.subject,
      year_from: currentYear - 10,
      year_to: currentYear,
    },
    requestId: input.requestId,
    limit: 5,
  })
  const evidence = evidenceSummary(retrieval.matches)
  const generated = await generateHuggingFaceJson<AdaptiveModeJson>({
    system: [
      'You create one high-quality past-paper-style practice question and solve it.',
      'Use retrieved questions as pattern evidence, never copy long passages verbatim.',
      'Adapt difficulty to the student performance when supplied.',
      'For calculations show every formula, substitution, unit, and final answer.',
      'Never invent a specific source. Describe the source pattern only from supplied evidence.',
      'Never output UNSUPPORTED.',
      'Return valid JSON only.',
    ].join('\n'),
    prompt: [
      `SUBJECT: ${input.subject}`,
      `TOPIC: ${input.topic}`,
      `BOARD: ${input.board ?? 'Any'}`,
      `DIFFICULTY: ${input.difficulty ?? 'medium'}`,
      `PREVIOUS PERFORMANCE: ${input.performance ?? 'Not supplied'}`,
      '',
      'LAST-10-YEAR EVIDENCE:',
      contextBlock(retrieval.matches),
      '',
      'If there is no exact match, create a fresh MCQ or numerical question based on the visible patterns.',
      'Return this JSON shape:',
      '{"question":{"type":"MCQ|numerical|structured","text":"","marks":4,"options":[]},"answer":"","explanation":["step 1","step 2"],"commonMistakes":[],"sourcePattern":"Based on pattern of [year/board/source IDs], or no matched corpus evidence"}',
    ].join('\n'),
    maxTokens: 1_400,
    fallbackData: buildAdaptiveFallback(input, retrieval.matches),
  })

  return {
    subject: input.subject,
    topic: input.topic,
    board: input.board ?? null,
    question: generated.data.question ?? {
      type: 'structured',
      text: '',
      marks: 0,
      options: [],
    },
    answer: generated.data.answer ?? '',
    explanation: generated.data.explanation ?? [],
    commonMistakes: generated.data.commonMistakes ?? [],
    sourcePattern: generated.data.sourcePattern ?? '',
    model: generated.model,
    retrievalMode: retrieval.mode,
    ...evidence,
  }
}
