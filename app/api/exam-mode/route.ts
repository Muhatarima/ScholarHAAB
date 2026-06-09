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

function fallbackExamMode(input: {
  subject: string
  topic: string
  board: string | null
  requestId: string
}) {
  const subject = input.subject
  const topic = input.topic
  const board = input.board || 'Cambridge'

  return {
    subject,
    topic,
    board,
    confidence: 72,
    summary: `Past-paper search is available for ${subject} / ${topic}. Focus on repeated command words, formula use, definitions, and mark-scheme keywords.`,
    priorities: [
      {
        title: topic,
        reason: `Practise ${topic} using exam-style questions. Write formula/definition first, then substitution or explanation, then final answer with units where needed.`,
        frequency: 'Repeated exam-style theme',
        confidence: 72,
      },
    ],
    formulas: [],
    importantDefinitions: [],
    commonMistakes: [
      'Writing a general explanation without exam keywords.',
      'Forgetting units in calculation answers.',
      'Not linking the cause to the final effect clearly.',
    ],
    sourcePatterns: [
      {
        title: `${board} ${subject} past-paper pattern`,
        note: 'Use related question papers and mark schemes from the indexed document library.',
      },
    ],
    model: 'safe-fallback',
    requestId: input.requestId,
  }
}

export async function POST(req: Request) {
  const requestId = createRequestId()

  try {
    const auth = await requireAuth(req)
    if (auth.error) return auth.error
    if (!auth.user) {
      return NextResponse.json(
        { error: 'Unauthorized', requestId },
        { status: 401, headers: { 'x-request-id': requestId } }
      )
    }

    const body = (await req.json()) as Record<string, unknown>
    const subject = required(body.subject, 'subject')
    const topic = required(body.topic, 'topic')
    const board = typeof body.board === 'string' && body.board.trim() ? body.board.trim() : null

    try {
      const result = await runExamModePipeline({
        subject,
        topic,
        board,
        requestId,
      })

      return NextResponse.json(result, {
        headers: { 'Cache-Control': 'no-store', 'x-request-id': requestId },
      })
    } catch (pipelineError) {
      logError('rag_exam_mode_pipeline_failed', pipelineError, {
        request_id: requestId,
        user_id: auth.user.id,
        subject,
        topic,
        board,
      })

      return NextResponse.json(fallbackExamMode({ subject, topic, board, requestId }), {
        headers: { 'Cache-Control': 'no-store', 'x-request-id': requestId },
      })
    }
  } catch (error) {
    logError('rag_exam_mode_failed', error, {
      request_id: requestId,
    })

    return NextResponse.json(
      {
        error:
          error instanceof Error && /subject|topic|required/i.test(error.message)
            ? error.message
            : 'Exam mode is temporarily unavailable. Please try Solver or Mock Test.',
        requestId,
      },
      { status: 503, headers: { 'x-request-id': requestId } }
    )
  }
}
