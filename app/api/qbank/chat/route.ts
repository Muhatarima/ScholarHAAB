import { cookies } from 'next/headers'
import { insertQueryLog, estimateLoggedTokens } from '@/lib/admin/query-logs'
import { handleProductChat } from '@/lib/server/chat-api'
import { resolveRequestIdentity } from '@/lib/server/auth'
import { parseQbankQuery } from '@/lib/server/qbank'
import { createRequestId, logError } from '@/lib/server/logger'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'
import { updateMemoryAfterSession } from '@/lib/memory/studentMemory'
import { retrieveVerifiedContext, validateAIResponse } from '@/lib/ai/truthEngine'
import { trackEvent } from '@/lib/analytics/usageTracker'
import { getOfflineAnswer } from '@/lib/offline/fallbackEngine'
import { requireAuth } from '@/lib/auth/requireAuth'
import { checkRateLimit } from '@/lib/rateLimit/rateLimiter'
import { validateQuestion } from '@/lib/validation/inputValidator'
import { handleApiError } from '@/lib/errors/AppError'
import { detectIntent } from '@/lib/ai/intentEngine'
import { buildSearchQuery } from '@/lib/ai/queryBuilder'
import { filterResponse } from '@/lib/ai/qualityFilter'
import { trackSkip } from '@/lib/analytics/topicTracker'
import { formatQuestionCard, generateAdaptiveQuestion } from '@/lib/ai/questionGenerator'
import {
  formatUnderstandingResponse,
  understandMessage,
  type Message as UnderstandingMessage,
} from '@/lib/ai/universalUnderstanding'

export const runtime = 'nodejs'
export const maxDuration = 30
export const dynamic = 'force-dynamic'

function withRequestId(response: Response, requestId: string) {
  response.headers.set('x-request-id', requestId)
  return response
}

function hasAttachedFiles(body: Record<string, unknown>) {
  if (typeof body.fileBase64 === 'string' && body.fileBase64.trim()) {
    return true
  }

  return Array.isArray(body.files) && body.files.length > 0
}

export async function POST(req: Request) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError

  const rateCheck = checkRateLimit({
    maxRequests: 50,
    windowMs: 60 * 60 * 1000,
    identifier: `qbank_chat_${user?.id ?? 'anonymous'}`,
  })

  if (!rateCheck.allowed) {
    return Response.json({ error: 'Rate limit reached.' }, { status: 429 })
  }

  const requestId = createRequestId()
  const startTime = Date.now()
  const cookieStore = await cookies()
  const identity = await resolveRequestIdentity(cookieStore, req.headers)
  let userEmail: string | null = null
  let body: Record<string, unknown>

  if (identity.authUserId) {
    try {
      const supabaseAdmin = getSupabaseAdmin()
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('email')
        .eq('id', identity.authUserId)
        .maybeSingle()

      userEmail = String((data as { email?: string | null } | null)?.email ?? '').trim() || null
    } catch {
      userEmail = null
    }
  }

  try {
    body = (await req.json()) as Record<string, unknown>
  } catch (error) {
    logError('qbank_chat_invalid_json', error, {
      request_id: requestId,
      route: '/api/qbank/chat',
    })
    return withRequestId(Response.json({ error: 'Invalid JSON body' }, { status: 400 }), requestId)
  }

  let message = ''
  try {
    message = typeof body.message === 'string' ? validateQuestion(body.message) : ''
  } catch (error) {
    return handleApiError(error)
  }
  if (!message && !hasAttachedFiles(body)) {
    return withRequestId(Response.json({ error: 'message is required' }, { status: 400 }), requestId)
  }

  try {
    const headers = new Headers(req.headers)
    headers.set('Content-Type', 'application/json')
    headers.delete('content-length')
    const history = Array.isArray(body.history)
      ? (body.history as UnderstandingMessage[]).filter(
          (entry) =>
            entry &&
            (entry.role === 'user' || entry.role === 'assistant') &&
            typeof entry.content === 'string'
        )
      : []
    const understood = await understandMessage(message, history)
    const cleanMessage = understood.cleanMessage
    const parsedQuery = parseQbankQuery(cleanMessage)
    const intelligenceIntent = detectIntent(cleanMessage, history)
    const intelligenceSearchQuery = buildSearchQuery(intelligenceIntent, [])
    const sessionContext =
      body.sessionContext && typeof body.sessionContext === 'object'
        ? (body.sessionContext as { subject?: unknown })
        : null
    const loggedSubject =
      typeof body.subject === 'string'
        ? body.subject.trim()
        : typeof sessionContext?.subject === 'string'
          ? sessionContext.subject.trim()
          : understood.subject ?? parsedQuery.subject

    if (understood.intent === 'test_me') {
      const question = await generateAdaptiveQuestion(
        identity.authUserId ?? user?.id ?? 'test-anonymous-user',
        loggedSubject ?? 'Physics',
        understood.topic ?? undefined
      )
      const card = formatQuestionCard(question)
      return withRequestId(
        Response.json({
          answer: card,
          response: card,
          question,
          mode: 'adaptive_question_generator',
          understood,
        }),
        requestId
      )
    }

    if (!understood.isAcademic && (!understood.shouldRunRag || understood.intent === 'confused')) {
      const answer = filterResponse(formatUnderstandingResponse(understood))
      return withRequestId(
        Response.json({
          answer,
          response: answer,
          mode: `understanding_${understood.category}`,
          understood,
        }),
        requestId
      )
    }

    if (understood.skippedTopic) {
      await trackSkip(
        identity.authUserId ?? user?.id ?? 'test-anonymous-user',
        loggedSubject ?? 'General',
        understood.skippedTopic
      )
    }

    body.message = cleanMessage

    const forwardRequest = new Request(req.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    const response = await handleProductChat(forwardRequest, {
      requestId,
      product: 'qbank',
    })
    let finalResponse: Response = response

    try {
      const payload = (await response.clone().json()) as Record<string, unknown>
      let answer =
        typeof payload.answer === 'string'
          ? payload.answer
          : typeof payload.response === 'string'
            ? payload.response
            : ''
      const fromCache = Boolean(payload.fromCache ?? payload.from_cache)
      const explicitTokens = Number.isFinite(Number(payload.tokens_used))
        ? Number(payload.tokens_used)
        : null

      if (response.ok && answer && !hasAttachedFiles(body)) {
        const verifiedContext = await retrieveVerifiedContext(
          `${cleanMessage}\n\nSmart search intent: ${intelligenceIntent.type}\nExpanded search query: ${intelligenceSearchQuery}`,
          loggedSubject,
          parsedQuery.topicHints[0] ?? null
        )
        const validation = await validateAIResponse(
          answer,
          verifiedContext,
          message,
          identity.authUserId
        )

        answer = filterResponse(validation.answer)
        payload.answer = validation.answer
        payload.answer = answer
        payload.response = answer
        payload.truth = {
          confidence: validation.confidence,
          confidenceScore: validation.confidenceScore,
          source: validation.source,
          valid: validation.valid,
          issues: validation.issues,
          lowConfidence: verifiedContext.lowConfidence,
        }
        payload.confidence = validation.confidence
        payload.confidenceScore = validation.confidenceScore
        payload.confidenceBadge =
          validation.confidence === 'VERIFIED'
            ? '✅ VERIFIED — from Cambridge/Edexcel past papers'
            : validation.confidence === 'PARTIAL'
              ? '⚠️ PARTIAL MATCH — AI reasoning applied'
              : '🤖 AI REASONING — verify before exam'

        finalResponse = Response.json(payload, {
          status: response.status,
          headers: response.headers,
        })
      }

      await insertQueryLog({
        userId: identity.authUserId,
        userEmail,
        message: cleanMessage,
        queryType: parsedQuery.intent,
        subject: loggedSubject,
        tokensUsed: fromCache ? 0 : estimateLoggedTokens(answer, explicitTokens),
        fromCache,
        responseMs: Date.now() - startTime,
      })

      if (identity.authUserId && identity.authUserId !== 'test-anonymous-user') {
        await updateMemoryAfterSession(identity.authUserId, {
          subject: loggedSubject,
          topic: parsedQuery.topicHints[0] ?? parsedQuery.subject ?? 'General',
          sessionType: parsedQuery.intent === 'solve' ? 'practice' : 'topic_prep',
          questionsAttempted: parsedQuery.intent === 'solve' || parsedQuery.intent === 'question_lookup' ? 1 : 0,
          questionsCorrect: 0,
          aiNotes: answer ? `QBank chat answered ${parsedQuery.intent}.` : 'QBank chat completed.',
        })
      }

      if (response.ok) {
        await trackEvent('question_asked', {
          subject: loggedSubject ?? undefined,
          topic: parsedQuery.topicHints[0] ?? undefined,
          question: cleanMessage,
          page: '/api/qbank/chat',
          userId: identity.authUserId ?? undefined,
        })
      }
    } catch {
      // Logging is best-effort and should never block the user response.
    }

    return withRequestId(finalResponse, requestId)
  } catch (error) {
    logError('qbank_chat_route_failed', error, {
      request_id: requestId,
      route: '/api/qbank/chat',
    })

    const parsedQuery = parseQbankQuery(message)
    const offline = getOfflineAnswer(message, parsedQuery.subject ?? undefined)
    const answer = offline.question
      ? [
          '**Confidence:** PARTIAL (Offline Cache)',
          `**Source:** ${offline.question.source}`,
          '',
          '**Step-by-Step Solution:**',
          offline.question.step_by_step,
          '',
          '**Official Mark Scheme:**',
          ...offline.question.mark_scheme_points.map((point) => `- ${point}`),
        ].join('\n')
      : `**Confidence:** OFFLINE\n**Source:** Cached response\n\n${offline.message}`

    await trackEvent('question_asked', {
      subject: offline.question?.subject ?? parsedQuery.subject ?? undefined,
      topic: offline.question?.topic ?? parsedQuery.topicHints[0] ?? undefined,
      question: message,
      page: '/api/qbank/chat',
      userId: identity.authUserId ?? undefined,
    })

    return withRequestId(
      Response.json({
        answer,
        response: answer,
        from_cache: true,
        mode: 'offline_fallback',
        truth: {
          confidence: offline.found ? 'PARTIAL' : 'UNVERIFIED',
          confidenceScore: offline.found ? 70 : 0,
          source: offline.question?.source ?? 'Offline cache',
          valid: offline.found,
          issues: offline.found ? [] : ['Live QBank chat unavailable and no cached match found'],
        },
      }),
      requestId
    )
  }
}
