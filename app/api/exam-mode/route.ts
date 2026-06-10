import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { runExamModePipeline } from '@/lib/rag/pipelines'
import { createRequestId, logError } from '@/lib/server/logger'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function withoutConfidence<T extends Record<string, unknown>>(value: T) {
  const clean = { ...value }
  delete clean.confidence
  delete clean.confidenceBadge
  delete clean.confidenceLabel
  delete clean.confidenceScore
  return clean
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
    const board = text(body.board) || null
    const difficulty = text(body.difficulty) || null

    if (!subject || !topic) {
      return NextResponse.json(
        { error: 'Subject and topic are required.', requestId },
        { status: 400, headers: { 'x-request-id': requestId } }
      )
    }

    const result = await runExamModePipeline({ board, requestId, subject, topic })

    return NextResponse.json(
      withoutConfidence({
        ...result,
        difficulty,
        observation:
          result.summary ||
          'Observation is based on retrieved formulas, repeated wording, and question patterns from the indexed library.',
      } as Record<string, unknown>),
      { headers: { 'Cache-Control': 'no-store', 'x-request-id': requestId } }
    )
  } catch (error) {
    logError('exam_mode_api_failed', error, {
      request_id: requestId,
      user_id: user.id,
    })
    return NextResponse.json(
      { error: 'Exam Mode is temporarily unavailable. Please try again in a moment.', requestId },
      { status: 503, headers: { 'x-request-id': requestId } }
    )
  }
}
