export const runtime = 'nodejs'
export const maxDuration = 30

import { createRequestId, logError } from '@/lib/server/logger'
import { requireAuth } from '@/lib/auth/requireAuth'
import { handleApiError } from '@/lib/errors/AppError'
import { checkRateLimit } from '@/lib/rateLimit/rateLimiter'
import { validateQuestion } from '@/lib/validation/inputValidator'
import { getHighConfidenceConceptAnswer } from '@/lib/ai/conceptAnswerBank'
import { getDeepExamAnswer } from '@/lib/ai/deepExamAnswerBank'
import { getHardestQuestionAnswer } from '@/lib/ai/hardestAnswerBank'
import { filterResponse } from '@/lib/ai/qualityFilter'
import { detectIntent, type Message } from '@/lib/ai/intentEngine'
import { buildSearchQuery } from '@/lib/ai/queryBuilder'
import { trackSkip } from '@/lib/analytics/topicTracker'
import { solveQuestion } from '@/lib/rag/qbankSolver'
import { formatQuestionCard, generateAdaptiveQuestion } from '@/lib/ai/questionGenerator'
import {
  formatUnderstandingResponse,
  understandMessage,
  type Message as UnderstandingMessage,
} from '@/lib/ai/universalUnderstanding'

export async function POST(req: Request) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError

  const demoMode =
    process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ||
    process.env.DEMO_MODE === 'true' ||
    process.env.NODE_ENV === 'development'

  if (!demoMode) {
    const rateCheck = checkRateLimit({
      maxRequests: 50,
      windowMs: 60 * 60 * 1000,
      identifier: `qbank_${user?.id ?? 'anonymous'}`,
    })

    if (!rateCheck.allowed) {
      return Response.json({ error: 'Rate limit reached.' }, { status: 429 })
    }
  }

  const requestId = createRequestId()

  try {
    const body = (await req.clone().json()) as Record<string, unknown>
    const rawMessage = String(body.message || body.question || '')
    validateQuestion(rawMessage)
    const history = Array.isArray(body.history)
      ? (body.history as Message[]).filter(
          (entry) =>
            entry &&
            (entry.role === 'user' || entry.role === 'assistant') &&
            typeof entry.content === 'string'
        )
      : []
    const understood = await understandMessage(rawMessage, history as UnderstandingMessage[])
    const message = understood.cleanMessage
    const subject = typeof body.subject === 'string' ? body.subject.trim() : undefined
    const resolvedSubject = understood.subject ?? subject

    if (understood.intent === 'test_me') {
      const question = await generateAdaptiveQuestion(
        user?.id ?? 'test-anonymous-user',
        resolvedSubject ?? 'Physics',
        understood.topic ?? undefined
      )
      const card = formatQuestionCard(question)
      const response = Response.json({
        answer: card,
        response: card,
        question,
        mode: 'adaptive_question_generator',
        understood,
      })
      response.headers.set('x-request-id', requestId)
      return response
    }

    if (!understood.isAcademic && (!understood.shouldRunRag || understood.intent === 'confused')) {
      const answer = filterResponse(formatUnderstandingResponse(understood))
      const response = Response.json({
        answer,
        response: answer,
        mode: `understanding_${understood.category}`,
        understood,
      })
      response.headers.set('x-request-id', requestId)
      return response
    }

    if (understood.skippedTopic) {
      await trackSkip(
        user?.id ?? 'test-anonymous-user',
        resolvedSubject ?? 'General',
        understood.skippedTopic
      )
    }

    const intent = detectIntent(message, history)
    const isPastPaperLookup = /\b20(?:1[4-9]|2[0-6])\b|past\s*paper|paper\s*questions?|question\s*\d*/i.test(message)
    const searchQuery = buildSearchQuery(
      {
        ...intent,
        subject: intent.subject ?? resolvedSubject ?? null,
        topic: intent.topic ?? understood.topic ?? null,
      },
      history
    )

    const hardestAnswer = getHardestQuestionAnswer(message)
    if (hardestAnswer) {
      const cleanedAnswer = filterResponse(hardestAnswer)
      const response = Response.json({
        answer: cleanedAnswer,
        response: cleanedAnswer,
        confidence: 'AI_REASONING',
        confidenceBadge: '🤖 AI REASONING — verify before exam',
        from_cache: true,
        mode: 'hardest_answer_bank',
        intent,
        searchQuery,
      })
      response.headers.set('x-request-id', requestId)
      return response
    }
    const deepAnswer = getDeepExamAnswer(message)
    if (deepAnswer) {
      const cleanedAnswer = filterResponse(deepAnswer)
      const response = Response.json({
        answer: cleanedAnswer,
        response: cleanedAnswer,
        confidence: 'AI_REASONING',
        confidenceBadge: '🤖 AI REASONING — verify before exam',
        from_cache: true,
        mode: 'deep_exam_answer_bank',
        intent,
        searchQuery,
      })
      response.headers.set('x-request-id', requestId)
      return response
    }
    const conceptAnswer = isPastPaperLookup ? null : getHighConfidenceConceptAnswer(message)
    if (conceptAnswer) {
      const cleanedAnswer = filterResponse(conceptAnswer)
      const response = Response.json({
        answer: cleanedAnswer,
        response: cleanedAnswer,
        confidence: 'VERIFIED',
        confidenceBadge: '✅ VERIFIED — from Cambridge/Edexcel past papers',
        from_cache: true,
        mode: 'concept_answer_bank',
        intent,
        searchQuery,
      })
      response.headers.set('x-request-id', requestId)
      return response
    }
    const solved = await solveQuestion(user?.id ?? 'test-anonymous-user', message, resolvedSubject, history, {
      avoidedTopics: understood.skippedTopic ? [understood.skippedTopic] : [],
    })
    const cleanedAnswer = filterResponse(solved.answer)
    const response = Response.json({
      answer: cleanedAnswer,
      response: cleanedAnswer,
      confidence: solved.confidence,
      confidenceBadge: solved.confidenceBadge,
      confidenceScore: solved.confidenceScore,
      sources: solved.sources,
      subject: solved.subject,
      topic: solved.topic,
      tokens_used: solved.tokens_used,
      from_cache: solved.from_cache,
      mode: 'intent_rag_solver',
      intent,
      searchQuery,
      understood,
    })
    response.headers.set('x-request-id', requestId)
    return response
  } catch (error) {
    if (error instanceof Error && error.name === 'AppError') {
      return handleApiError(error)
    }
    logError('qbank_root_api_error', error, { request_id: requestId, route: '/api/qbank' })
    const response = Response.json({ error: 'Something went wrong' }, { status: 500 })
    response.headers.set('x-request-id', requestId)
    return response
  }
}
