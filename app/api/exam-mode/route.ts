import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { getPastPaperQuestions } from '@/lib/mock/pastPaperDocuments'
import { createRequestId, logError } from '@/lib/server/logger'

export const runtime = 'nodejs'
export const maxDuration = 30
export const dynamic = 'force-dynamic'

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function POST(req: Request) {
  const requestId = createRequestId()
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = (await req.json()) as Record<string, unknown>
    const subject = text(body.subject)
    const topic = text(body.topic)

    if (!subject || !topic) {
      return NextResponse.json(
        { error: 'Subject and topic are required.', requestId },
        { status: 400, headers: { 'x-request-id': requestId } }
      )
    }

    const questions = await getPastPaperQuestions({ count: 20, subject, topic })

    if (!questions.length) {
      return NextResponse.json(
        {
          error: `No real past paper questions found for ${subject} / ${topic}. Try another topic name from the database.`,
          questions: [],
          requestId,
        },
        { status: 404, headers: { 'Cache-Control': 'no-store', 'x-request-id': requestId } }
      )
    }

    return NextResponse.json(
      { questions, subject, topic },
      { headers: { 'Cache-Control': 'no-store', 'x-request-id': requestId } }
    )
  } catch (error) {
    logError('exam_mode_api_failed', error, {
      request_id: requestId,
      user_id: user.id,
    })
    return NextResponse.json(
      { error: 'Could not load past paper questions.', requestId },
      { status: 500, headers: { 'x-request-id': requestId } }
    )
  }
}
