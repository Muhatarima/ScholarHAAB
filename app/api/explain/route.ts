import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { runExplainPipeline } from '@/lib/rag/pipelines'
import { createRequestId, logError } from '@/lib/server/logger'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const requestId = createRequestId()
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = (await req.json()) as Record<string, unknown>
    const query = typeof body.query === 'string' ? body.query.trim() : ''
    if (!query) {
      return NextResponse.json({ error: 'query is required.' }, { status: 400 })
    }
    const result = await runExplainPipeline({
      query,
      subject: typeof body.subject === 'string' ? body.subject.trim() : null,
      topic: typeof body.topic === 'string' ? body.topic.trim() : null,
      requestId,
    })
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store', 'x-request-id': requestId },
    })
  } catch (error) {
    logError('rag_explain_failed', error, {
      request_id: requestId,
      user_id: user.id,
    })
    return NextResponse.json(
      {
        error:
          error instanceof Error && /query|required/i.test(error.message)
            ? error.message
            : 'Please try again later. The AI service is temporarily unavailable.',
        requestId,
      },
      { status: 503 }
    )
  }
}
