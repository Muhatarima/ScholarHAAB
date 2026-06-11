import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { runExplainPipeline } from '@/lib/rag/pipelines'
import { createRequestId, logError } from '@/lib/server/logger'
import {
  normalizeChatFilesPayload,
  prepareUploadedFiles,
  selectUploadedFileChunks,
} from '@/lib/server/file-input'
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

function uploadedContextBlock(query: string, body: Record<string, unknown>) {
  const files = normalizeChatFilesPayload({
    fileBase64: typeof body.fileBase64 === 'string' ? body.fileBase64 : undefined,
    fileName: typeof body.fileName === 'string' ? body.fileName : undefined,
    fileType: typeof body.fileType === 'string' ? body.fileType : undefined,
    files: body.files,
  })

  return { files }
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
    const { files } = uploadedContextBlock(question, body)

    if (!question && files.length === 0) {
      return NextResponse.json(
        { error: 'Question or uploaded image/PDF is required.', requestId },
        { status: 400, headers: { 'x-request-id': requestId } }
      )
    }

    const uploaded = files.length ? await prepareUploadedFiles(files) : null
    const fileChunks = uploaded
      ? selectUploadedFileChunks(question || 'uploaded question', uploaded.chunks, 6)
      : []
    const fileText = fileChunks
      .map((chunk, index) => [
        `Uploaded file excerpt ${index + 1}: ${chunk.sourceTitle}`,
        chunk.page ? `Page: ${chunk.page}` : '',
        chunk.content,
      ].filter(Boolean).join('\n'))
      .join('\n\n')
    const effectiveQuestion = [
      question || 'Please solve the uploaded question.',
      fileText ? `Use this uploaded question text:\n${fileText}` : '',
      uploaded?.warnings.length
        ? `Upload note: ${uploaded.warnings.join(' ')}`
        : '',
    ].filter(Boolean).join('\n\n')

    const result = await runExplainPipeline({
      history: history(body.history),
      query: effectiveQuestion,
      requestId,
      subject,
      topic,
    })

    await saveConversation({
      answer: result.answer,
      question: question || uploaded?.fileSummary || 'Uploaded question',
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
