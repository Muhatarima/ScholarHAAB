import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { runAdaptiveModePipeline } from '@/lib/rag/pipelines'
import { createRequestId, logError } from '@/lib/server/logger'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'

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

async function saveGeneratedQuestion(input: {
  answer: string
  question: string
  subject: string
  topic: string
  userId: string
}) {
  try {
    await getSupabaseAdmin().from('generated_questions').insert({
      answer: input.answer,
      question: input.question,
      subject: input.subject,
      topic: input.topic,
      user_id: input.userId,
    })
  } catch (error) {
    console.error('generated_question_save_failed', error)
  }
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
    const difficulty = text(body.difficulty) || 'medium'
    const performance = text(body.performance) || null

    if (!subject || !topic) {
      return NextResponse.json(
        { error: 'Subject and topic are required.', requestId },
        { status: 400, headers: { 'x-request-id': requestId } }
      )
    }

    const result = await runAdaptiveModePipeline({
      board,
      difficulty,
      performance,
      requestId,
      subject,
      topic,
    })

    await saveGeneratedQuestion({
      answer: String(result.answer || ''),
      question: result.question?.text ?? '',
      subject,
      topic,
      userId: user.id,
    })

    return NextResponse.json(withoutConfidence(result as Record<string, unknown>), {
      headers: { 'Cache-Control': 'no-store', 'x-request-id': requestId },
    })
  } catch (error) {
    logError('adaptive_mode_api_failed', error, {
      request_id: requestId,
      user_id: user.id,
    })
    return NextResponse.json(
      { error: 'Adaptive Mode is temporarily unavailable. Please try again in a moment.', requestId },
      { status: 503, headers: { 'x-request-id': requestId } }
    )
  }
}
