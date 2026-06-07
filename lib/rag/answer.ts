import { generateResponse } from '@/lib/ai-service'
import type { RagMatch, RagMetadata } from '@/lib/rag/retrieve'
import { retrieveAcademicContext } from '@/lib/rag/retrieve'
import { logEvent } from '@/lib/server/logger'

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
  retrievalMode: 'hybrid' | 'text' | 'none'
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
    similarity: match.vectorSimilarity,
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
        `Vector similarity: ${
          source.similarity === null ? 'not available' : source.similarity.toFixed(4)
        }`,
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
  const bestSimilarity = matches.reduce<number | null>((best, match) => {
    if (match.vectorSimilarity === null) return best
    return best === null ? match.vectorSimilarity : Math.max(best, match.vectorSimilarity)
  }, null)

  if (bestSimilarity === null) {
    return {
      confidence: 'GENERAL_KNOWLEDGE' as const,
      score: 40,
      badge: 'GENERAL KNOWLEDGE - no verified vector match',
    }
  }

  const score = Math.max(0, Math.min(100, Math.round(bestSimilarity * 100)))
  if (score >= 85) {
    return {
      confidence: 'VERIFIED' as const,
      score,
      badge: 'PAST-PAPER MATCH - verified source context',
    }
  }

  return {
    confidence: 'PARTIAL' as const,
    score,
    badge: 'PARTIAL PAST-PAPER MATCH - AI reasoning applied',
  }
}

export async function generateAcademicAnswer(input: {
  question: string
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
  filters?: RagMetadata
  requestId: string
  userId: string
}) {
  const retrievalStartedAt = Date.now()
  const retrieval = await retrieveAcademicContext(input.question, {
    filters: input.filters,
    requestId: input.requestId,
    limit: 5,
  })
  const confidence = confidenceFor(retrieval.matches)
  const hasVectorSources = retrieval.matches.some(
    (match) => match.vectorSimilarity !== null
  )

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
    buildSourceContext(retrieval.matches),
    '',
    'STUDENT QUESTION:',
    input.question,
    '',
    'FOLLOW-UP RULE:',
    'If the student message is a short complaint or unclear follow-up, infer the topic from the immediately preceding user/assistant messages and re-answer that topic in a clearer way.',
    '',
    hasVectorSources
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
    retrieval_mode: retrieval.mode,
    retrieved_chunks: retrieval.matches.length,
    top_similarity: retrieval.matches[0]?.vectorSimilarity ?? null,
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
    sources: retrieval.matches.map(toSource),
    retrievalMode: retrieval.mode,
  } satisfies AcademicAnswer
}
