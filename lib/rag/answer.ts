import { generateResponse } from '@/lib/ai-service'
import type { RagMatch, RagMetadata } from '@/lib/rag/retrieve'
import { retrieveAcademicContext } from '@/lib/rag/retrieve'
import { retrieveQbankContext } from '@/lib/server/qbank'
import { logError, logEvent } from '@/lib/server/logger'

export type AcademicSource = {
  id: string
  title: string
  url: string | null
  board: string | null
  level: string | null
  subject: string | null
  topic: string | null
  year: number | string | null
  paper: string | null
  question_number: string | number | null
  similarity: number | null
}

export type AcademicAnswer = {
  answer: string
  confidence: 'VERIFIED' | 'PARTIAL' | 'GENERAL_KNOWLEDGE'
  confidenceScore: number
  confidenceBadge: string
  sources: AcademicSource[]
  retrievalMode: 'hybrid' | 'text' | 'qbank' | 'none'
}

function metadataText(metadata: RagMetadata, key: keyof RagMetadata) {
  const value = metadata[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function toSource(match: RagMatch): AcademicSource {
  const { metadata } = match
  return {
    id: match.id,
    title: match.sourceTitle,
    url: match.sourceUrl,
    board: metadataText(metadata, 'board'),
    level: metadataText(metadata, 'level'),
    subject: metadataText(metadata, 'subject'),
    topic: metadataText(metadata, 'topic'),
    year:
      typeof metadata.year === 'number' || typeof metadata.year === 'string'
        ? metadata.year
        : null,
    paper: metadataText(metadata, 'paper'),
    question_number:
      typeof metadata.question_number === 'number' ||
      typeof metadata.question_number === 'string'
        ? metadata.question_number
        : null,
    similarity: match.vectorSimilarity ?? match.textScore,
  }
}

function buildSourceContext(matches: RagMatch[]) {
  if (!matches.length) {
    return 'No past-paper chunk met the retrieval threshold.'
  }

  return matches
    .map((match, index) => {
      const source = toSource(match)
      return [
        `[SOURCE ${index + 1}]`,
        `Title: ${source.title}`,
        `Board: ${source.board ?? 'unknown'}`,
        `Level: ${source.level ?? 'unknown'}`,
        `Subject: ${source.subject ?? 'unknown'}`,
        `Year: ${source.year ?? 'unknown'}`,
        `Paper: ${source.paper ?? 'unknown'}`,
        `Question: ${source.question_number ?? 'unknown'}`,
        `Retrieval score: ${
          source.similarity === null
            ? match.textScore === null
              ? 'not available'
              : match.textScore.toFixed(4)
            : source.similarity.toFixed(4)
        }`,
        `Evidence tier: ${match.tier ?? 'academic source'}`,
        `Content: ${match.content.slice(0, 4_500)}`,
      ].join('\n')
    })
    .join('\n\n')
}

function buildHistoryContext(
  history: Array<{ role: 'user' | 'assistant'; content: string }>
) {
  return history
    .slice(-8)
    .map((message) => `${message.role.toUpperCase()}: ${message.content.slice(0, 1_500)}`)
    .join('\n')
}

function parseModelAnswer(raw: string) {
  const withoutFence = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')

  try {
    const parsed = JSON.parse(withoutFence) as { answer?: unknown }
    if (typeof parsed.answer === 'string' && parsed.answer.trim()) {
      return parsed.answer.trim()
    }
  } catch {
    // A plain-text response is still useful and is handled below.
  }

  return withoutFence
}

function retiredFallbackDetected(answer: string) {
  return (
    /UNSUPPORTED\s*-\s*VERIFY WITH TEACHER\/SOURCE/i.test(answer) ||
    /Know the definition, one example, and the mark[- ]scheme keywords/i.test(answer)
  )
}

function confidenceFor(matches: RagMatch[]) {
  if (!matches.length) {
    return {
      confidence: 'GENERAL_KNOWLEDGE' as const,
      score: 40,
      badge: 'GENERAL KNOWLEDGE - no verified corpus match',
    }
  }

  const bestScore = matches.reduce<number>((best, match) => {
    const score = match.vectorSimilarity ?? match.textScore ?? 0
    return Math.max(best, score)
  }, 0)
  const normalizedScore = bestScore > 1 ? bestScore / 100 : bestScore
  const score = Math.max(45, Math.min(100, Math.round(normalizedScore * 100)))
  const exactAnswer = matches.some((match) => match.tier === 'qbank_exact_answer')

  if (exactAnswer || matches.some((match) => (match.vectorSimilarity ?? 0) >= 0.85)) {
    return {
      confidence: 'VERIFIED' as const,
      score,
      badge: 'PAST-PAPER MATCH - verified source context',
    }
  }

  return {
    confidence: 'PARTIAL' as const,
    score,
    badge: 'ACADEMIC CORPUS MATCH - AI reasoning applied',
  }
}

async function retrieveQbankMatches(
  question: string,
  requestId: string
): Promise<RagMatch[]> {
  try {
    const context = await retrieveQbankContext(question)
    const parsedLevel = context.parsedQuery.level?.toLowerCase() ?? null
    const parsedSubject = context.parsedQuery.subject?.toLowerCase() ?? null
    return context.chunks.filter((chunk) => {
      const haystack = `${chunk.sourceTitle} ${chunk.content}`.toLowerCase()
      if (parsedLevel === 'a level' && /\bo level\b|igcse/.test(haystack)) {
        return false
      }
      if (parsedLevel === 'o level' && /\ba level\b/.test(haystack)) {
        return false
      }
      if (parsedSubject && !haystack.includes(parsedSubject)) {
        return false
      }
      return true
    }).map((chunk) => ({
      id: chunk.id,
      content: chunk.content,
      metadata: {
        board: context.parsedQuery.board,
        level: null,
        subject: null,
        year: context.parsedQuery.year,
        paper: context.parsedQuery.paper,
      },
      sourceTitle: chunk.sourceTitle,
      sourceUrl: chunk.sourceUrl,
      sourceKind: 'qbank',
      tier: chunk.tier,
      vectorSimilarity: null,
      textScore: chunk.score,
    }))
  } catch (error) {
    logError('qbank_retrieval_failed', error, { request_id: requestId })
    return []
  }
}

function mergeMatches(primary: RagMatch[], fallback: RagMatch[], limit = 6) {
  const matches = new Map<string, RagMatch>()
  for (const match of [...primary, ...fallback]) {
    const key = match.id || `${match.sourceTitle}:${match.content.slice(0, 100)}`
    if (!matches.has(key)) matches.set(key, match)
  }
  return Array.from(matches.values()).slice(0, limit)
}

export async function generateAcademicAnswer(input: {
  question: string
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
  filters?: RagMetadata
  requestId: string
  userId: string
}) {
  const retrievalStartedAt = Date.now()
  const [retrieval, qbankMatches] = await Promise.all([
    retrieveAcademicContext(input.question, {
      filters: input.filters,
      requestId: input.requestId,
      limit: 5,
    }),
    retrieveQbankMatches(input.question, input.requestId),
  ])
  const matches = mergeMatches(retrieval.matches, qbankMatches)
  const confidence = confidenceFor(matches)
  const hasRetrievedSources = matches.length > 0
  const retrievalMode: AcademicAnswer['retrievalMode'] =
    retrieval.matches.length && qbankMatches.length
      ? 'hybrid'
      : retrieval.matches.length
        ? retrieval.mode
        : qbankMatches.length
          ? 'qbank'
          : 'none'

  const systemPrompt = [
    'You are ScholarHAAB, a careful academic tutor for Mathematics, Physics, Chemistry, Biology, and exam subjects.',
    'Answer the student directly and reason step by step when the question requires working.',
    'Use retrieved source chunks when they are relevant. Never invent a year, board, paper, question number, quotation, or source.',
    'If no source met the threshold, answer from reliable general academic knowledge and explicitly say that it is not based on a matched past paper.',
    'Never output the words "UNSUPPORTED - VERIFY WITH TEACHER/SOURCE".',
    'Never output a generic template such as "know the definition, one example, and mark-scheme keywords".',
    'For calculations, show the formula, substitutions, units, and final answer.',
    'For follow-up questions, use the supplied conversation history.',
    'If the student says phrases like "worst explanation", "bad explanation", "bujhini", "did not understand", or "explain again", interpret that as a request to re-explain the previous academic topic more clearly and simply.',
    'Return JSON with one string field named "answer". Do not return confidence or source metadata; the server calculates those.',
  ].join('\n')

  const prompt = [
    'CONVERSATION HISTORY:',
    buildHistoryContext(input.history ?? []) || 'No earlier messages.',
    '',
    'RETRIEVED ACADEMIC CONTEXT:',
    buildSourceContext(matches),
    '',
    'STUDENT QUESTION:',
    input.question,
    '',
    'FOLLOW-UP RULE:',
    'If the student message is a short complaint or unclear follow-up, infer the topic from the immediately preceding user/assistant messages and re-answer that topic in a clearer way.',
    '',
    hasRetrievedSources
      ? 'Write a complete answer grounded in the relevant context. Cite sources naturally only when their metadata is present.'
      : 'Write a complete general-knowledge answer and include this exact final note: "Source note: This answer is from general academic knowledge, not a matched past paper."',
  ].join('\n')

  const generationStartedAt = Date.now()
  const raw = await generateResponse(prompt, systemPrompt, {
    maxTokens: 1_000,
    operation: 'academic_rag_answer',
    requestId: input.requestId,
    userKey: input.userId,
  })
  const answer = parseModelAnswer(raw)

  if (!answer || retiredFallbackDetected(answer)) {
    throw new Error('LLM returned the retired unsupported fallback instead of an answer')
  }

  logEvent('info', 'academic_answer_complete', {
    request_id: input.requestId,
    retrieval_mode: retrievalMode,
    retrieved_chunks: matches.length,
    qbank_chunks: qbankMatches.length,
    top_similarity: matches[0]?.vectorSimilarity ?? matches[0]?.textScore ?? null,
    confidence_score: confidence.score,
    answer_length: answer.length,
    retrieval_ms: generationStartedAt - retrievalStartedAt,
    generation_ms: Date.now() - generationStartedAt,
  })

  return {
    answer,
    confidence: confidence.confidence,
    confidenceScore: confidence.score,
    confidenceBadge: confidence.badge,
    sources: matches.map(toSource),
    retrievalMode,
  } satisfies AcademicAnswer
}
