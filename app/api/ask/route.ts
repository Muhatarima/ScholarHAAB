import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { extractAcademicFileText } from '@/lib/rag/file-query'
import { runExplainPipeline } from '@/lib/rag/pipelines'
import { createRequestId, logError } from '@/lib/server/logger'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

type HistoryMessage = {
  role: 'user' | 'assistant'
  content: string
}

function historyFrom(value: unknown): HistoryMessage[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(
      (entry): entry is HistoryMessage =>
        Boolean(entry) &&
        typeof entry === 'object' &&
        ((entry as HistoryMessage).role === 'user' ||
          (entry as HistoryMessage).role === 'assistant') &&
        typeof (entry as HistoryMessage).content === 'string'
    )
    .map((entry) => ({
      role: entry.role,
      content: entry.content.trim().slice(0, 4_000),
    }))
    .filter((entry) => entry.content)
    .slice(-8)
}

function hasFiles(body: Record<string, unknown>) {
  return (
    (Array.isArray(body.files) && body.files.length > 0) ||
    (typeof body.fileBase64 === 'string' && body.fileBase64.trim())
  )
}

export async function POST(req: Request) {
  const requestId = createRequestId()
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = (await req.json()) as Record<string, unknown>
    const typedQuestion =
      typeof body.question === 'string'
        ? body.question.trim()
        : typeof body.message === 'string'
          ? body.message.trim()
          : ''
    const fileResult = hasFiles(body)
      ? await extractAcademicFileText(body)
      : { text: '', traces: [] }
    const question = [
      typedQuestion ||
        (fileResult.text
          ? 'Solve and explain the uploaded academic question.'
          : ''),
      fileResult.text,
    ]
      .filter(Boolean)
      .join('\n\n')

    if (!question) {
      return NextResponse.json(
        { error: 'A question or supported file is required.' },
        { status: 400 }
      )
    }

    const context =
      body.sessionContext && typeof body.sessionContext === 'object'
        ? (body.sessionContext as Record<string, unknown>)
        : {}
    const result = await runExplainPipeline({
      query: question,
      subject:
        typeof context.subject === 'string' ? context.subject : null,
      topic: typeof context.topic === 'string' ? context.topic : null,
      history: historyFrom(body.history),
      requestId,
    })
    const confidence =
      result.confidenceLabel === 'STRONG_CORPUS_MATCH'
        ? 'VERIFIED'
        : 'PARTIAL'

    return NextResponse.json(
      {
        answer: result.answer,
        response: result.answer,
        confidence,
        confidenceScore: result.confidenceScore,
        confidenceBadge:
          fileResult.traces.length > 0
            ? 'HF OCR + RAG ANALYSIS'
            : result.confidenceLabel.replaceAll('_', ' '),
        retrievalMode: result.retrievalMode,
        model: result.model,
        sources: result.sources.map((source) => ({
          title: source.title,
          url: source.url,
          board: source.board,
          subject: source.subject,
          topic: source.topic,
          year: source.year,
          paper: source.paper,
          question_number: source.questionNumber,
          similarity: source.similarity,
        })),
        fileAnalysis: { traces: fileResult.traces },
        truth: {
          confidence,
          confidenceScore: result.confidenceScore,
          valid: true,
          source:
            result.sources[0]?.title ||
            (fileResult.traces.length
              ? 'Uploaded question processed with Hugging Face OCR'
              : 'Hugging Face synthesis without a matched corpus source'),
          issues: result.sources.length
            ? []
            : ['No matching document was returned by the current corpus.'],
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store',
          'x-request-id': requestId,
        },
      }
    )
  } catch (error) {
    logError('hf_ask_failed', error, {
      request_id: requestId,
      user_id: user.id,
    })
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Hugging Face RAG could not answer the question.',
        requestId,
      },
      { status: 503, headers: { 'x-request-id': requestId } }
    )
  }
}
