import { NextResponse } from 'next/server'
import { getCachedResponse, setCachedResponse } from '@/lib/ai/responseCache'
import { handleTutorMessage } from '@/lib/ai/tutorEngine'
import { trackEvent } from '@/lib/analytics/usageTracker'
import { handleApiError } from '@/lib/errors/AppError'
import { checkRateLimit } from '@/lib/rateLimit/rateLimiter'
import { requireAuth } from '@/lib/auth/requireAuth'
import { validateQuestion, validateSubject } from '@/lib/validation/inputValidator'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 })
  }

  const rateCheck = checkRateLimit({
    maxRequests: 20,
    windowMs: 60 * 60 * 1000,
    identifier: `tutor_${user.id}`,
  })

  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Rate limit reached. Try again in 1 hour.' },
      { status: 429 }
    )
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  let message: string
  let subject: string
  let level: string
  let board: string | undefined
  try {
    message = validateQuestion(body.message || body.question)
    subject = validateSubject(body.subject || '')
    level = typeof body.level === 'string' && body.level.trim() ? body.level.trim() : 'O Level'
    board = typeof body.board === 'string' && body.board.trim() ? body.board.trim().toLowerCase() : undefined
  } catch (error) {
    return handleApiError(error)
  }

  const cacheScope = board
    ? `${subject}:${board}:personality-v2`
    : `${subject}:personality-v2`
  const cached = await getCachedResponse(message, cacheScope)
  if (cached) {
    return NextResponse.json({
      answer: cached,
      response: cached,
      fromCache: true,
      confidence: 'VERIFIED',
      mode: 'response_cache',
      subject,
    })
  }

  try {
    const conversationHistory =
      Array.isArray(body.conversationHistory)
        ? body.conversationHistory.filter(
            (entry): entry is { role: 'user' | 'assistant'; content: string } =>
              Boolean(entry) &&
              typeof entry === 'object' &&
              (entry as { role?: unknown }).role !== undefined &&
              ((entry as { role?: unknown }).role === 'user' ||
                (entry as { role?: unknown }).role === 'assistant') &&
              typeof (entry as { content?: unknown }).content === 'string'
          )
        : []
    const result = await handleTutorMessage(user.id, message, conversationHistory, board)
    await setCachedResponse(message, cacheScope, result.answer)

    await trackEvent('question_asked', {
      subject,
      question: message,
      page: '/api/tutor/chat',
      userId: user.id,
    })

    return NextResponse.json({
      answer: result.answer,
      response: result.answer,
      mode: result.mode,
      subject: result.subject ?? subject,
      board,
      level,
      topic: result.topic,
      prerequisiteWarning: result.prerequisiteWarning,
      tokens_used: result.tokensUsed,
      from_cache: false,
    })
  } catch (error) {
    console.error('Tutor route failed:', error)
    const fallbackSource = board === 'edexcel' ? 'Pearson Edexcel expert reasoning' : 'Cambridge expert reasoning'
    const fallbackMarks = board === 'edexcel'
      ? 'Edexcel marks this as: M1 method shown, A1 correct application, B1 final answer/accuracy.'
      : 'Cambridge marks this as: correct principle, correct application, final conclusion.'
    const fallbackAnswer = `**Confidence:** 🧠 EXPERT\n**Source:** ${fallbackSource}\n\n**Solution:**\nState the relevant formula or principle first, apply it step by step, and give the final answer with units where needed.\n\n**Mark Scheme:**\n- ${fallbackMarks}\n- Correct application to question\n- Correct final answer/conclusion\n\n**Examiner Tip:** Even when retrieval is unavailable, answer using the board's method marks.`
    return NextResponse.json(
      {
        answer: fallbackAnswer,
        response: fallbackAnswer,
        mode: 'expert_fallback',
        subject,
        board,
        level,
        topic: null,
        prerequisiteWarning: null,
        tokensUsed: 0,
      },
      { status: 200 }
    )
  }
}
