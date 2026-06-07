import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { generateResponseFromParts, type AiInputPart } from '@/lib/ai-service'
import { requireAuth } from '@/lib/auth/requireAuth'
import { generateAcademicAnswer } from '@/lib/rag/answer'
import type { RagMetadata } from '@/lib/rag/retrieve'
import { persistChatTurn } from '@/lib/server/chat-history'
import { resolveRequestIdentity } from '@/lib/server/auth'
import {
  normalizeChatFilesPayload,
  prepareUploadedFiles,
} from '@/lib/server/file-input'
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

function uploadedQuestion(body: Record<string, unknown>) {
  const question =
    typeof body.question === 'string'
      ? body.question.trim()
      : typeof body.message === 'string'
        ? body.message.trim()
        : ''

  return question || 'Read the attached question paper image or document and solve the visible question.'
}

async function answerUploadedFiles(input: {
  body: Record<string, unknown>
  requestId: string
  userId: string
}) {
  const files = normalizeChatFilesPayload(input.body)
  const prepared = await prepareUploadedFiles(files)
  const question = uploadedQuestion(input.body)
  const history = sanitizeHistory(input.body.history)
  const parts: AiInputPart[] = [
    {
      text: [
        'STUDENT REQUEST:',
        question,
        '',
        'RECENT CONVERSATION:',
        history.length
          ? history.map((item) => `${item.role.toUpperCase()}: ${item.content}`).join('\n')
          : 'No earlier messages.',
        '',
        `ATTACHMENTS: ${prepared.fileSummary ?? 'uploaded academic file'}`,
        'Inspect the actual attachment as the primary evidence. OCR text, when present, is only a helper and may contain errors.',
      ].join('\n'),
    },
    ...prepared.extractedTextParts,
    ...prepared.inlineParts,
  ]

  const systemPrompt = [
    'You are ScholarHAAB, an expert Cambridge/Edexcel academic tutor and exam-paper analyst.',
    'Read every visible part of the uploaded image or document before answering.',
    'Transcribe the exact question you are solving when that helps remove ambiguity.',
    'Identify board, level, subject, year, paper, question number, and marks only when they are genuinely visible. Never invent them.',
    'Solve the requested question completely. For Mathematics and Physics, show formula, substitutions, algebra, units, and final answer. For theory, write mark-scheme-ready points.',
    'If a diagram is present, use it. If one symbol or number is unreadable, state exactly which part is unclear and continue with the readable evidence.',
    'The uploaded file is a valid source. Do not call this answer general knowledge and do not say no past paper matched.',
    'Never output UNSUPPORTED or the retired generic mark-scheme template.',
    'Return clean Markdown only.',
  ].join('\n')

  const answer = await generateResponseFromParts(parts, systemPrompt, {
    maxTokens: 1_500,
    operation: 'academic_uploaded_file_answer',
    requestId: input.requestId,
    userKey: input.userId,
  })

  const sources = prepared.files.map((file, index) => ({
    id: `upload-${index + 1}`,
    title: file.fileName,
    url: null,
    board: null,
    level: null,
    subject: null,
    topic: null,
    year: null,
    paper: null,
    question_number: null,
    similarity: null,
    source: 'Uploaded question paper',
  }))
  const confidenceScore = prepared.hasInlineOnlyEvidence ? 82 : 90

  return {
    answer: answer.trim(),
    response: answer.trim(),
    confidence: 'UPLOADED_SOURCE',
    confidenceScore,
    confidenceBadge: 'UPLOADED QUESTION PAPER - analyzed from your file',
    sources,
    retrievalMode: 'uploaded',
    sessionId:
      typeof input.body.sessionId === 'string' ? input.body.sessionId : null,
    fileAnalysis: {
      traces: prepared.traces,
      warnings: prepared.warnings,
    },
    truth: {
      confidence: 'UPLOADED_SOURCE',
      confidenceScore,
      valid: true,
      source: prepared.fileSummary ?? 'Uploaded question paper',
      issues: prepared.warnings,
    },
  }
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
    try {
      const result = await answerUploadedFiles({
        body,
        requestId,
        userId: user.id,
      })
      return NextResponse.json(result, {
        headers: {
          'Cache-Control': 'no-store',
          'x-request-id': requestId,
        },
      })
    } catch (error) {
      logError('ask_uploaded_file_failed', error, {
        request_id: requestId,
        user_id: user.id,
      })
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : 'The uploaded file could not be analyzed.',
          requestId,
        },
        {
          status: 422,
          headers: {
            'Cache-Control': 'no-store',
            'x-request-id': requestId,
          },
        }
      )
    }
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
