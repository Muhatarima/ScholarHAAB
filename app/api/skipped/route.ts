import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { buildAlternativeExplanation } from '@/lib/rag/pipelines'
import { createRequestId, logError } from '@/lib/server/logger'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

async function handleSkipped(input: {
  requestId: string
  subject?: string | null
  topic: string
}) {
  const result = await buildAlternativeExplanation(input)
  if (!result) {
    return NextResponse.json(
      {
        error:
          'No alternative explanation source was found for this topic yet. Try a broader keyword such as motion, waves, integration, or electricity.',
        requestId: input.requestId,
      },
      { status: 404, headers: { 'x-request-id': input.requestId } }
    )
  }

  return NextResponse.json(
    {
      ...result,
      topic: input.topic,
      subject: input.subject ?? null,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
        'x-request-id': input.requestId,
      },
    }
  )
}

export async function POST(req: Request) {
  const requestId = createRequestId()
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = (await req.json()) as Record<string, unknown>
    const topic = cleanText(body.topic || body.concept)
    if (!topic) {
      return NextResponse.json(
        { error: 'topic is required.', requestId },
        { status: 400, headers: { 'x-request-id': requestId } }
      )
    }

    return handleSkipped({
      requestId,
      subject: cleanText(body.subject) || null,
      topic,
    })
  } catch (error) {
    logError('skipped_topic_api_failed', error, {
      request_id: requestId,
      user_id: user.id,
    })
    return NextResponse.json(
      { error: 'Please try again later. Alternative explanation is temporarily unavailable.', requestId },
      { status: 503, headers: { 'x-request-id': requestId } }
    )
  }
}

export async function GET(req: Request) {
  const requestId = createRequestId()
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const url = new URL(req.url)
    const topic = url.searchParams.get('topic')?.trim() || ''
    if (!topic) {
      return NextResponse.json(
        { error: 'topic is required.', requestId },
        { status: 400, headers: { 'x-request-id': requestId } }
      )
    }

    return handleSkipped({
      requestId,
      subject: url.searchParams.get('subject')?.trim() || null,
      topic,
    })
  } catch (error) {
    logError('skipped_topic_api_failed', error, {
      request_id: requestId,
      user_id: user.id,
    })
    return NextResponse.json(
      { error: 'Please try again later. Alternative explanation is temporarily unavailable.', requestId },
      { status: 503, headers: { 'x-request-id': requestId } }
    )
  }
}
