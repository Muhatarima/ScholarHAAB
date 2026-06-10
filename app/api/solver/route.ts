import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { runExplainPipeline } from '@/lib/rag/pipelines'
import { createRequestId, logError } from '@/lib/server/logger'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

type HistoryMessage = {
  content: string
  role: 'assistant' | 'user'
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function history(value: unknown): HistoryMessage[] {
  return Array.isArray(value)
    ? value
        .filter(
          (item): item is HistoryMessage =>
            item &&
            typeof item === 'object' &&
            ((item as HistoryMessage).role === 'user' || (item as HistoryMessage).role === 'assistant') &&
            typeof (item as HistoryMessage).content === 'string'
        )
        .slice(-10)
    : []
}

function withoutConfidence<T extends Record<string, unknown>>(value: T) {
  const clean = { ...value }
  delete clean.confidence
  delete clean.confidenceBadge
  delete clean.confidenceLabel
  delete clean.confidenceScore
  return clean
}

async function saveConversation(input: {
  answer: string
  question: string
  userId: string
}) {
  try {
    await getSupabaseAdmin().from('conversations').insert({
      answer: input.answer,
      question: input.question,
      user_id: input.userId,
    })
  } catch (error) {
    console.error('conversation_save_failed', error)
  }
}

export async function POST(req: Request) {
  const requestId = createRequestId()
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = (await req.json()) as Record<string, unknown>
    const question = text(body.question || body.message)
    const subject = text(body.subject) || null
    const topic = text(body.topic) || null

    if (!question) {
      return NextResponse.json(
        { error: 'Question is required.', requestId },
        { status: 400, headers: { 'x-request-id': requestId } }
      )
    }

    const result = await runExplainPipeline({
      history: history(body.history),
      query: question,
      requestId,
      subject,
      topic,
    })

    await saveConversation({
      answer: result.answer,
      question,
      userId: user.id,
    })

    return NextResponse.json(withoutConfidence(result as Record<string, unknown>), {
      headers: { 'Cache-Control': 'no-store', 'x-request-id': requestId },
    })
  } catch (error) {
    logError('solver_api_failed', error, {
      request_id: requestId,
      user_id: user.id,
    })
    return NextResponse.json(
      { error: 'Solver is temporarily unavailable. Please try again in a moment.', requestId },
      { status: 503, headers: { 'x-request-id': requestId } }
    )
  }
}
