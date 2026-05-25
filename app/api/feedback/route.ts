import { NextResponse } from 'next/server'
import { resolveRequestIdentity } from '@/lib/server/auth'
import { insertFeedback } from '@/lib/server/feedback-improvement'
import { cookies } from 'next/headers'
import { createRequestId, logError } from '@/lib/server/logger'
import { readJsonBody } from '@/lib/server/request-body'
import { requireAuth } from '@/lib/auth/requireAuth'
import { validateQuestion } from '@/lib/validation/inputValidator'

export async function POST(req: Request) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError

  const requestId = createRequestId()

  try {
    const cookieStore = await cookies()
    const identity = await resolveRequestIdentity(cookieStore)

    if (!identity.isAuthenticated || !identity.authUserId) {
      return NextResponse.json(
        { error: 'Please log in to submit feedback.' },
        { status: 401, headers: { 'x-request-id': requestId } }
      )
    }

    const body = await readJsonBody(req)
    let question = ''
    let answer = ''
    try {
      question = typeof body.question === 'string' ? validateQuestion(body.question) : ''
      answer = typeof body.answer === 'string' ? validateQuestion(body.answer) : ''
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Invalid feedback fields.' },
        { status: 400, headers: { 'x-request-id': requestId } }
      )
    }
    const rating = body.rating
    const note = body.note
    const product = body.product
    const mode = body.mode
    const sessionId = body.sessionId
    const sources = body.sources

    if (!question || !answer || !rating) {
      return NextResponse.json(
        { error: 'Missing required feedback fields.' },
        { status: 400, headers: { 'x-request-id': requestId } }
      )
    }

    if (rating !== 'thumbs_up' && rating !== 'thumbs_down') {
      return NextResponse.json(
        { error: 'Invalid rating format.' },
        { status: 400, headers: { 'x-request-id': requestId } }
      )
    }

    const feedbackId = await insertFeedback({
      userId: identity.authUserId,
      product: typeof product === 'string' ? product : null,
      mode: typeof mode === 'string' ? mode : null,
      sessionId: typeof sessionId === 'string' ? sessionId : null,
      question,
      answer,
      rating,
      note: typeof note === 'string' ? note : null,
      sources: Array.isArray(sources) ? sources : [],
    })

    return NextResponse.json(
      { success: true, feedbackId },
      { headers: { 'x-request-id': requestId } }
    )
  } catch (err) {
    logError('feedback_api_failed', err, {
      request_id: requestId,
      route: '/api/feedback',
    })
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500, headers: { 'x-request-id': requestId } }
    )
  }
}
