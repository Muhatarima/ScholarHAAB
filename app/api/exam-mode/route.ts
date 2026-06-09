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

function required(value: unknown, name: string) {
  const valueText = text(value)
  if (!valueText) throw new Error(`${name} is required.`)
  return valueText
}

function safeExamModeResult(input: {
  subject: string
  topic: string
  board: string | null
  requestId: string
  reason?: string
}) {
  const board = input.board || 'Cambridge'
  const topic = input.topic
  const subject = input.subject

  return {
    subject,
    topic,
    board,
    confidence: 70,
    summary:
      `${topic} is a useful ${subject} revision area. Practise it with past-paper style questions, write key definitions/formulae first, and answer using mark-scheme keywords.`,
    priorities: [
      {
        title: topic,
        reason:
          `Focus on ${topic}: learn the core definition/formula, practise common command words, and compare your final sentence with mark-scheme wording.`,
        frequency: 'Common exam-practice area',
        confidence: 70,
      },
    ],
    formulas:
      /physics/i.test(subject) && /kinematic|motion|velocity|speed|acceleration|displacement/i.test(topic)
        ? [
            {
              name: 'Speed',
              formula: 'speed = distance / time',
              useCase: 'Use when distance and time are given.',
            },
            {
              name: 'Acceleration',
              formula: 'acceleration = change in velocity / time',
              useCase: 'Use when velocity changes over a time interval.',
            },
          ]
        : [],
    importantDefinitions: [
      {
        term: topic,
        definition:
          `Know the syllabus meaning of ${topic}, then apply it directly to the question using precise exam keywords.`,
      },
    ],
    commonMistakes: [
      'Writing a vague explanation without the key exam word.',
      'Forgetting units in calculation answers.',
      'Not giving a final sentence that links cause and effect.',
    ],
    sourcePatterns: [
      {
        title: `${board} ${subject} past-paper practice`,
        note: 'Use related question papers and mark schemes from the indexed library.',
      },
    ],
    model: 'safe-exam-mode-fallback',
    requestId: input.requestId,
    recovered: true,
    recoveryReason: input.reason || null,
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('AI timeout; using local fallback.')), ms)
    ),
  ])
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

  try {
    let auth
    try {
      auth = await requireAuth(req)
    } catch (authError) {
      logError('exam_mode_auth_failed', authError, { request_id: requestId })
      return json(
        safeExamModeResult({
          subject,
          topic,
          board,
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
      logError('exam_mode_body_parse_failed', bodyError, { request_id: requestId })
      return json(
        {
          error: 'Invalid request body.',
          requestId,
        },
        400,
        requestId
      )
    }

    subject = required(body.subject, 'subject')
    topic = required(body.topic, 'topic')
    board = text(body.board) || null

    try {
      const result = await withTimeout(runExamModePipeline({
        subject,
        topic,
        board,
        requestId,
      }), 25000)

      return json(result, 200, requestId)
    } catch (pipelineError) {
      logError('exam_mode_pipeline_recovered', pipelineError, {
        request_id: requestId,
        user_id: auth.user?.id ?? null,
        subject,
        topic,
        board,
      })

      return json(
        safeExamModeResult({
          subject,
          topic,
          board,
          requestId,
          reason: pipelineError instanceof Error ? pipelineError.message : 'pipeline failed',
        }),
        200,
        requestId
      )
    }
  } catch (error) {
    logError('exam_mode_unhandled_recovered', error, {
      request_id: requestId,
      subject,
      topic,
      board,
    })

    return json(
      safeExamModeResult({
        subject,
        topic,
        board,
        requestId,
        reason: error instanceof Error ? error.message : 'unhandled error',
      }),
      200,
      requestId
    )
  }
}
