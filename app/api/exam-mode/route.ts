import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { runExamModePipeline } from '@/lib/rag/pipelines'
import { createRequestId, logError } from '@/lib/server/logger'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

function required(value: unknown, name: string) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) throw new Error(`${name} is required.`)
  return text
}

export async function POST(req: Request) {
  const requestId = createRequestId()
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = (await req.json()) as Record<string, unknown>
    const result = await runExamModePipeline({
      subject: required(body.subject, 'subject'),
      topic: required(body.topic, 'topic'),
      board: typeof body.board === 'string' ? body.board.trim() : null,
      requestId,
    })
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store', 'x-request-id': requestId },
    })
  } catch (error) {
    logError('hf_exam_mode_failed', error, {
      request_id: requestId,
      user_id: user.id,
    })
    return NextResponse.json(
      {
        error:
          error instanceof Error && /subject|topic|required/i.test(error.message)
            ? error.message
            : 'Please try again later. The AI service is temporarily unavailable.',
        requestId,
      },
      { status: 503 }
    )
  }
}
