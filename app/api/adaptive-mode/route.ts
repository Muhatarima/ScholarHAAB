import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { runAdaptiveModePipeline } from '@/lib/rag/pipelines'
import { createRequestId, logError } from '@/lib/server/logger'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function required(value: unknown, name: string) {
  const valueText = text(value)
  if (!valueText) throw new Error(`${name} is required.`)
  return valueText
}

function safeAdaptiveResult(input: {
  subject: string
  topic: string
  board: string | null
  difficulty: string | null
  performance: string | null
  requestId: string
  reason?: string
}) {
  const subject = input.subject
  const topic = input.topic
  const board = input.board || 'Cambridge'
  const difficulty = input.difficulty || 'medium'

  return {
    question: {
      text:
        `A ${difficulty} ${subject} question on ${topic}: explain the key idea, then apply it to an exam-style situation.`,
      type: 'structured',
      marks: 4,
      options: [],
    },
    answer:
      `For ${topic}, start with the correct definition or formula, apply it directly to the question, and finish with a clear final sentence using exam keywords.`,
    explanation: [
      'Identify the command word in the question.',
      'Write the relevant definition, law, or formula.',
      'Apply it to the given situation using correct units or keywords.',
      'Finish with a clear final answer.',
    ],
    commonMistakes: [
      'Writing a vague answer without the key exam word.',
      'Forgetting units in calculation answers.',
      'Not linking the reason to the final effect.',
    ],
    sourcePattern: `${board} ${subject} past-paper style practice for ${topic}`,
    confidenceScore: 70,
    sources: [],
    model: 'safe-adaptive-fallback',
    requestId: input.requestId,
    recovered: true,
    recoveryReason: input.reason || null,
  }
}

function json(data: unknown, status = 200, requestId?: string) {
  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...(requestId ? { 'x-request-id': requestId } : {}),
    },
  })
}

export async function POST(req: Request) {
  const requestId = createRequestId()

  let subject = 'Physics'
  let topic = 'Kinematics'
  let board: string | null = 'Cambridge'
  let difficulty: string | null = 'medium'
  let performance: string | null = null

  try {
    let auth
    try {
      auth = await requireAuth(req)
    } catch (authError) {
      logError('adaptive_mode_auth_failed', authError, { request_id: requestId })

      return json(
        safeAdaptiveResult({
          subject,
          topic,
          board,
          difficulty,
          performance,
          requestId,
          reason: 'auth recovery',
        }),
        200,
        requestId
      )
    }

    if (auth.error) return auth.error

    let body: Record<string, unknown> = {}
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch (bodyError) {
      logError('adaptive_mode_body_parse_failed', bodyError, { request_id: requestId })
      return json({ error: 'Invalid request body.', requestId }, 400, requestId)
    }

    subject = required(body.subject, 'subject')
    topic = required(body.topic, 'topic')
    board = text(body.board) || null
    difficulty = text(body.difficulty) || null
    performance = text(body.performance) || null

    try {
      const result = await runAdaptiveModePipeline({
        subject,
        topic,
        board,
        difficulty,
        performance,
        requestId,
      })

      return json(result, 200, requestId)
    } catch (pipelineError) {
      logError('adaptive_mode_pipeline_recovered', pipelineError, {
        request_id: requestId,
        user_id: auth.user?.id ?? null,
        subject,
        topic,
        board,
        difficulty,
      })

      return json(
        safeAdaptiveResult({
          subject,
          topic,
          board,
          difficulty,
          performance,
          requestId,
          reason: pipelineError instanceof Error ? pipelineError.message : 'pipeline failed',
        }),
        200,
        requestId
      )
    }
  } catch (error) {
    logError('adaptive_mode_unhandled_recovered', error, {
      request_id: requestId,
      subject,
      topic,
      board,
      difficulty,
    })

    return json(
      safeAdaptiveResult({
        subject,
        topic,
        board,
        difficulty,
        performance,
        requestId,
        reason: error instanceof Error ? error.message : 'unhandled error',
      }),
      200,
      requestId
    )
  }
}
