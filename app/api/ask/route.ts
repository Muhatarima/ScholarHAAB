import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { generateAcademicAnswer } from '@/lib/rag/answer'
import type { RagMetadata } from '@/lib/rag/retrieve'
import { handleProductChat } from '@/lib/server/chat-api'
import { persistChatTurn } from '@/lib/server/chat-history'
import { resolveRequestIdentity } from '@/lib/server/auth'
import { createRequestId, logError } from '@/lib/server/logger'

export const runtime = 'nodejs'
export const maxDuration = 45
export const dynamic = 'force-dynamic'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

function sanitizeHistory(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(
      (entry): entry is ChatMessage =>
        Boolean(entry) &&
        typeof entry === 'object' &&
        ((entry as ChatMessage).role === 'user' ||
          (entry as ChatMessage).role === 'assistant') &&
        typeof (entry as ChatMessage).content === 'string'
    )
    .map((entry) => ({
      role: entry.role,
      content: entry.content.trim().slice(0, 4_000),
    }))
    .filter((entry) => entry.content)
    .slice(-8)
}

function sanitizeFilters(value: unknown): RagMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const context = value as Record<string, unknown>
  const filters: RagMetadata = {}

  for (const key of ['board', 'level', 'subject', 'topic'] as const) {
    if (typeof context[key] === 'string' && context[key].trim()) {
      filters[key] = context[key].trim()
    }
  }

  if (
    typeof context.year === 'number' ||
    (typeof context.year === 'string' && context.year.trim())
  ) {
    filters.year = context.year
  }

  return filters
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
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: { 'x-request-id': requestId } }
    )
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch (error) {
    logError('ask_invalid_json', error, { request_id: requestId })
    return NextResponse.json(
      { error: 'Invalid JSON body.' },
      { status: 400, headers: { 'x-request-id': requestId } }
    )
  }

  if (hasFiles(body)) {
    const forwarded = new Request(req.url, {
      method: 'POST',
      headers: req.headers,
      body: JSON.stringify(body),
    })
    return handleProductChat(forwarded, { product: 'qbank', requestId })
  }

  const question =
    typeof body.question === 'string'
      ? body.question.trim()
      : typeof body.message === 'string'
        ? body.message.trim()
        : ''

  if (!question) {
    return NextResponse.json(
      { error: 'question is required.' },
      { status: 400, headers: { 'x-request-id': requestId } }
    )
  }

  if (question.length > 12_000) {
    return NextResponse.json(
      { error: 'Question is too long.' },
      { status: 400, headers: { 'x-request-id': requestId } }
    )
  }

  try {
    const cookieStore = await cookies()
    const identity = await resolveRequestIdentity(cookieStore, req.headers)
    const history = sanitizeHistory(body.history)
    const result = await generateAcademicAnswer({
      question,
      history,
      filters: sanitizeFilters(body.sessionContext ?? body.filters),
      requestId,
      userId: user.id,
    })

    let sessionId =
      typeof body.sessionId === 'string' && body.sessionId.trim()
        ? body.sessionId.trim()
        : null

    if (identity.isAuthenticated) {
      try {
        const persisted = await persistChatTurn({
          viewerKey: identity.viewerKey,
          product: 'qbank',
          mode: body.mode === 'tutor' ? 'tutor' : 'direct',
          sessionId: sessionId ?? undefined,
          userMessage: question,
          assistantMessage: result.answer,
          assistantSources: result.sources.map((source) => ({
            title: source.title,
            url: source.url,
            tier: result.retrievalMode,
            lastChecked: null,
          })),
        })
        sessionId = persisted.sessionId
      } catch (error) {
        logError('ask_history_persist_failed', error, {
          request_id: requestId,
          user_id: user.id,
        })
      }
    }

    return NextResponse.json(
      {
        ...result,
        response: result.answer,
        sessionId,
        truth: {
          confidence: result.confidence,
          confidenceScore: result.confidenceScore,
          valid: true,
          source:
            result.sources[0]?.title ??
            'General academic knowledge - no matched past paper',
          issues: [],
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
    logError('ask_pipeline_failed', error, {
      request_id: requestId,
      user_id: user.id,
    })
    return NextResponse.json(
      {
        error:
          'The AI provider could not produce an answer right now. Please try again; the request ID is included for debugging.',
        requestId,
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store',
          'x-request-id': requestId,
        },
      }
    )
  }
}
