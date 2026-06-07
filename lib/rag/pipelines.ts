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

export async function runAdaptiveModePipeline(input: {
  subject: string
  topic: string
  board?: string | null
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
