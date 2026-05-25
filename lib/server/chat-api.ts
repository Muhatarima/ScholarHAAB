import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { buildCacheKey } from '@/lib/cacheKey'
import { generateResponseFromParts } from '@/lib/ai-service'
import {
  buildRetrievalQuery,
  buildChatResponse,
  buildFallbackChatResponse,
  buildPromptText,
  getResponseBudget,
  isContextDependentFollowUp,
} from '@/lib/chat-response'
import { getSystemPrompt } from '@/lib/prompts'
import { isPromptMode, type Product, type PromptMode } from '@/lib/products'
import { getCached, isCacheableIntent, setCached } from '@/lib/responseCache'
import { resolveRequestIdentity } from '@/lib/server/auth'
import { isPersonalQuestion } from '@/lib/server/cache'
import {
  getFilesSummary,
  normalizeChatFilesPayload,
  prepareUploadedFiles,
  selectUploadedFileChunks,
} from '@/lib/server/file-input'
import {
  getChatSessionMessages,
  persistChatTurn,
} from '@/lib/server/chat-history'
import {
  buildQbankGeneralKnowledgeReply,
  buildQbankGroundedReply,
  buildQbankOfflineReply,
  parseQbankQuery,
  retrieveQbankContext,
} from '@/lib/server/qbank'
import { validateAndFinalizeAnswer } from '@/lib/server/answer-quality'
import { retrieveRagContext } from '@/lib/server/rag'
import { assertRequestRateLimit } from '@/lib/server/rate-limit'
import { buildDisplaySources } from '@/lib/server/source-display'
import { recordStudyActivity } from '@/lib/server/progress'
import {
  commitUsage,
  createBypassedUsagePreview,
  previewUsage,
  TIER_COOKIE_NAME,
  VIEWER_COOKIE_NAME,
} from '@/lib/server/usage'
import { hasPaidAccess } from '@/lib/usage'
import { isTrustedEvalRequest } from '@/lib/server/eval-mode'
import { createRequestId, logError, logEvent } from '@/lib/server/logger'
import {
  applySessionContextToMessage,
  sanitizeSessionContext,
  type SessionContext,
} from '@/lib/sessionContext'

type HandlerOptions = {
  product: Product
  forceMode?: PromptMode
  requestId?: string
}

type AbroadParsedQuery = {
  degreeLevel: string | null
  field: string | null
}

function shouldUseDeterministicQbankReply(
  qbankContext: Awaited<ReturnType<typeof retrieveQbankContext>>
) {
  const intent = qbankContext.parsedQuery.intent
  const topQuestion = qbankContext.questionMatches[0]
  const hasQuestionAnchor =
    Boolean(qbankContext.parsedQuery.year) ||
    Boolean(qbankContext.parsedQuery.yearStart) ||
    Boolean(qbankContext.parsedQuery.yearEnd) ||
    Boolean(qbankContext.parsedQuery.paper) ||
    qbankContext.questionMatches.some(
      (match) => match.linkQuality === 'exact' || match.answerReady
    )

  if (qbankContext.gapMatches.length > 0 || qbankContext.blockedRecoveryMatches.length > 0) {
    return true
  }

  if (intent === 'formula_lookup' || intent === 'concept_lookup') {
    return qbankContext.conceptMatches.length > 0
  }

  if (intent === 'topic_review') {
    return (
      qbankContext.repeatMatches.length > 0 ||
      qbankContext.topicMatches.length > 0 ||
      qbankContext.conceptMatches.length > 0
    )
  }

  if (intent === 'general') {
    return false
  }

  const hasTightQuestionMatch =
    !!topQuestion &&
    (() => {
      const haystack = [
        topQuestion.subject,
        topQuestion.topic,
        topQuestion.questionLabel,
        topQuestion.questionText,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const matchedHints = qbankContext.parsedQuery.topicHints.filter(
        (hint) => hint.length >= 4 && haystack.includes(hint.toLowerCase())
      )
      const matchedTerms = qbankContext.parsedQuery.queryTerms.filter(
        (term) => term.length >= 3 && haystack.includes(term.toLowerCase())
      )

      return matchedHints.length > 0 || matchedTerms.length >= 2
    })()

  if ((intent === 'question_lookup' || intent === 'solve') && hasQuestionAnchor) {
    return Boolean(
      qbankContext.parsedQuery.year ||
        qbankContext.parsedQuery.yearStart !== null ||
        qbankContext.parsedQuery.yearEnd !== null ||
        qbankContext.parsedQuery.paper ||
        hasTightQuestionMatch
    )
  }

  return false
}

function shouldUseOfflineQbankReply() {
  return false
}

function shouldExposeSources(
  product: Product,
  qbankContext: Awaited<ReturnType<typeof retrieveQbankContext>> | null,
  hasUploadedEvidence = false
) {
  if (product !== 'qbank') {
    return true
  }

  if (hasUploadedEvidence) {
    return true
  }

  if (!qbankContext) {
    return false
  }

  return qbankContext.showSources
}

function compactText(value: string | null | undefined, maxChars = 220) {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxChars) {
    return normalized
  }

  return `${normalized.slice(0, maxChars - 3).trim()}...`
}

function isExplicitFileGroundedQuestion(message: string) {
  return /\b(this|these|attached|upload|uploaded|image|photo|scan|pdf|document|doc|file|files|using both files|from this|read this)\b/i.test(
    message
  )
}

function buildUploadedWarningChunks(
  uploadedFiles: Awaited<ReturnType<typeof prepareUploadedFiles>> | null
) {
  if (!uploadedFiles) {
    return [] as Array<{
      sourceTitle: string
      sourceUrl: null
      content: string
      tier: 'uploaded_file_warning'
      lastChecked: null
      score: number
    }>
  }

  return uploadedFiles.traces.flatMap((trace, traceIndex) =>
    trace.warnings.map((warning, warningIndex) => ({
      sourceTitle: `${trace.fileName} processing note`,
      sourceUrl: null,
      content: `I could not extract reliable text from ${trace.fileName}. ${warning}`,
      tier: 'uploaded_file_warning' as const,
      lastChecked: null,
      score: Math.max(0.76 - traceIndex * 0.02 - warningIndex * 0.01, 0.7),
    }))
  )
}

function summarizeChunks(
  chunks: Array<{
    sourceTitle: string
    sourceUrl?: string | null
    content: string
    tier?: string | null
    lastChecked?: string | null
    score?: number | null
  }>
) {
  return chunks.slice(0, 6).map((entry) => ({
    title: entry.sourceTitle,
    url: entry.sourceUrl ?? null,
    tier: entry.tier ?? null,
    lastChecked: entry.lastChecked ?? null,
    score: entry.score ?? null,
    contentPreview: compactText(entry.content, 240),
  }))
}

function summarizeUploadedTraces(
  traces: Array<{
    fileName: string
    fileType: string
    extractionStrategy: string
    chunkCount: number
    extractedChars: number
    pageCount: number
    warnings: string[]
  }>
) {
  return traces.map((trace) => ({
    fileName: trace.fileName,
    fileType: trace.fileType,
    extractionStrategy: trace.extractionStrategy,
    chunkCount: trace.chunkCount,
    extractedChars: trace.extractedChars,
    pageCount: trace.pageCount,
    warnings: trace.warnings,
  }))
}

function collectDebugRawSources(
  chunks: Array<{
    sourceTitle: string
    sourceUrl?: string | null
    tier?: string | null
    lastChecked?: string | null
    score?: number | null
  }>
) {
  return chunks.map((entry) => ({
    title: entry.sourceTitle,
    url: entry.sourceUrl,
    tier: entry.tier,
    lastChecked: entry.lastChecked ?? null,
    score: entry.score ?? null,
  }))
}

function summarizeQbankContext(context: Awaited<ReturnType<typeof retrieveQbankContext>> | null) {
  if (!context) {
    return null
  }

  return {
    enabled: context.enabled,
    sourceMode: context.sourceMode,
    parsedQuery: context.parsedQuery,
    ambiguousPaperLevel: context.ambiguousPaperLevel,
    showSources: context.showSources,
    bestSourceRelevance: context.bestSourceRelevance,
    counts: {
      topicMatches: context.topicMatches.length,
      conceptMatches: context.conceptMatches.length,
      repeatMatches: context.repeatMatches.length,
      questionMatches: context.questionMatches.length,
      paperMatches: context.paperMatches.length,
      paperPairMatches: context.paperPairMatches.length,
      pdfChunkMatches: context.pdfChunkMatches.length,
      gapMatches: context.gapMatches.length,
      blockedRecoveryMatches: context.blockedRecoveryMatches.length,
      nearbyResourceMatches: context.nearbyResourceMatches.length,
      sourceMatches: context.sourceMatches.length,
      chunks: context.chunks.length,
    },
    topQuestionMatches: context.questionMatches.slice(0, 3).map((row) => ({
      id: row.id,
      board: row.board,
      level: row.level,
      subject: row.subject,
      year: row.year ?? null,
      paper: row.paper ?? null,
      questionLabel: row.questionLabel ?? null,
      topic: row.topic ?? null,
      answerReady: row.answerReady ?? null,
      linkQuality: row.linkQuality ?? null,
      sourceUrl: row.sourceUrl ?? null,
      answerSourceUrl: row.answerSourceUrl ?? null,
    })),
    topTopicMatches: context.topicMatches.slice(0, 3).map((row) => ({
      id: row.id,
      board: row.board,
      level: row.level,
      subject: row.subject,
      chapter: row.chapter,
      topic: row.topic,
      totalFrequency: row.totalFrequency ?? null,
      sourceUrl: row.sourceUrl ?? null,
    })),
    topPaperMatches: context.paperMatches.slice(0, 3).map((row) => ({
      id: row.id,
      board: row.board,
      level: row.level,
      subject: row.subject,
      year: row.year ?? null,
      paper: row.paper,
      paperTitle: row.paperTitle,
      sourceUrl: row.sourceUrl ?? null,
    })),
    topRepeatMatches: context.repeatMatches.slice(0, 3).map((row) => ({
      subject: row.subject,
      topic: row.topic,
      frequency: row.frequency,
      years: row.years,
    })),
    topSourceMatches: context.sourceMatches.slice(0, 3).map((row) => ({
      title: row.title,
      board: row.board,
      level: row.level,
      subject: row.subject,
      url: row.url ?? null,
      provider: row.provider,
    })),
    chunks: summarizeChunks(context.chunks),
  }
}

function buildEvalDebugPayload({
  requestId,
  product,
  mode,
  effectiveMessage,
  contextualMessage,
  retrievalMessage,
  contextDependentFollowUp,
  cacheIntent,
  cacheKey,
  shouldCheckCache,
  responseOrigin,
  preferUploadedEvidence,
  rawQbankQuery,
  parsedQbankQuery,
  parsedAbroadQuery,
  scholarshipQuery,
  qbankContext,
  ragContext,
  promptText,
  systemPrompt,
  validation,
  rawSources,
  displaySources,
  uploadedFiles,
  uploadedChunks,
}: {
  requestId: string
  product: Product
  mode: PromptMode
  effectiveMessage: string
  contextualMessage: string
  retrievalMessage: string
  contextDependentFollowUp: boolean
  cacheIntent: string
  cacheKey: string
  shouldCheckCache: boolean
  responseOrigin: 'ai' | 'deterministic' | 'fallback'
  preferUploadedEvidence: boolean
  rawQbankQuery: ReturnType<typeof parseQbankQuery> | null
  parsedQbankQuery: ReturnType<typeof parseQbankQuery> | null
  parsedAbroadQuery: AbroadParsedQuery | null
  scholarshipQuery: boolean
  qbankContext: Awaited<ReturnType<typeof retrieveQbankContext>> | null
  ragContext: Awaited<ReturnType<typeof retrieveRagContext>> | Awaited<ReturnType<typeof retrieveQbankContext>>
  promptText: string | null
  systemPrompt: string | null
  validation: ReturnType<typeof validateAndFinalizeAnswer>
  rawSources: Array<{ title: string; url?: string | null; tier?: string | null; lastChecked?: string | null; score?: number | null }>
  displaySources: Array<{ title: string; url?: string | null; label: string; verified: boolean; lastChecked?: string | null; score?: number | null }>
  uploadedFiles: Awaited<ReturnType<typeof prepareUploadedFiles>> | null
  uploadedChunks: Array<{
    sourceTitle: string
    sourceUrl?: string | null
    content: string
    tier?: string | null
    lastChecked?: string | null
    score?: number | null
  }>
}) {
  return {
    requestId,
    product,
    mode,
    message: effectiveMessage,
    contextualMessage,
    retrievalMessage,
    followUpDetected: contextDependentFollowUp,
    cache: {
      intent: cacheIntent,
      keyPrefix: cacheKey.slice(0, 12),
      eligible: shouldCheckCache,
    },
    routing: {
      responseOrigin,
      scholarshipQuery,
      preferUploadedEvidence,
      rawQbankQuery,
      parsedQbankQuery,
      parsedAbroadQuery,
    },
    retrieval: {
      qbank: summarizeQbankContext(qbankContext),
      ragEnabled: ragContext.enabled,
      ragChunks: summarizeChunks(ragContext.chunks),
      uploadedFiles: uploadedFiles
        ? {
            fileCount: uploadedFiles.files.length,
            warnings: uploadedFiles.warnings,
            traces: summarizeUploadedTraces(uploadedFiles.traces),
            selectedChunks: summarizeChunks(uploadedChunks),
          }
        : null,
      reranker: null,
    },
    prompt: {
      systemPrompt,
      context: promptText,
    },
    validation,
    citations: {
      rawSources,
      displaySources,
    },
  }
}

function shouldUseQaFastGeneralKnowledgePath(input: {
  product: Product
  authUserId: string | null
  rawQbankQuery: ReturnType<typeof parseQbankQuery> | null
  sessionId?: string
  hasFiles: boolean
}) {
  return (
    process.env.QA_MODE === 'true' &&
    input.product === 'qbank' &&
    input.authUserId === 'test-anonymous-user' &&
    input.rawQbankQuery?.queryClass === 'GENERAL_KNOWLEDGE' &&
    !input.sessionId &&
    !input.hasFiles
  )
}

function isConversationalCacheMessage(message: string) {
  return /\b(i don'?t understand|confused|help me|at all help me|anything else|shortlist|narrow it down|continue)\b/i.test(
    message
  )
}

function resolveCacheIntent(input: {
  product: Product
  message: string
  rawQbankQuery: ReturnType<typeof parseQbankQuery> | null
  parsedQbankQuery: ReturnType<typeof parseQbankQuery> | null
  parsedAbroadQuery: AbroadParsedQuery | null
  scholarshipQuery: boolean
}) {
  if (isConversationalCacheMessage(input.message)) {
    return 'CONVERSATIONAL'
  }

  if (input.product === 'qbank') {
    return input.parsedQbankQuery?.queryClass ?? input.rawQbankQuery?.queryClass ?? 'CONCEPT_SEARCH'
  }

  if (input.scholarshipQuery) {
    return 'SCHOLARSHIP_SEARCH'
  }

  return 'CONCEPT_SEARCH'
}

function buildCacheContext(input: {
  product: Product
  sessionContext: SessionContext
  cacheIntent: string
  rawQbankQuery: ReturnType<typeof parseQbankQuery> | null
  parsedQbankQuery: ReturnType<typeof parseQbankQuery> | null
  parsedAbroadQuery: AbroadParsedQuery | null
}) {
  if (input.product === 'qbank') {
    const parsed = input.parsedQbankQuery ?? input.rawQbankQuery
    const board = parsed?.board ?? input.sessionContext.board
    const level = parsed?.level ?? input.sessionContext.level
    const subject = parsed?.subject ?? input.sessionContext.subject
    const cacheStoreContext: SessionContext = {
      ...input.sessionContext,
      board,
      level,
      subject,
    }

    return {
      board,
      level,
      subject,
      cacheStoreContext,
      keyIntent: `${input.product}:${input.cacheIntent}`,
    }
  }

  const board = null
  const level = input.parsedAbroadQuery?.degreeLevel ?? input.sessionContext.degree
  const subject = input.parsedAbroadQuery?.field ?? input.sessionContext.field
  const cacheStoreContext: SessionContext = {
    ...input.sessionContext,
    board,
    level: input.sessionContext.level,
    subject,
    degree: input.parsedAbroadQuery?.degreeLevel ?? input.sessionContext.degree,
    field: input.parsedAbroadQuery?.field ?? input.sessionContext.field,
  }

  return {
    board,
    level,
    subject,
    cacheStoreContext,
    keyIntent: `${input.product}:${input.cacheIntent}`,
  }
}

function mapConfidenceToScore(confidence: 'high' | 'medium' | 'low') {
  if (confidence === 'high') {
    return 92
  }

  if (confidence === 'medium') {
    return 76
  }

  return 58
}

function applyResponseCookies(
  response: NextResponse,
  identity: Awaited<ReturnType<typeof resolveRequestIdentity>>
) {
  if (identity.shouldSetViewerCookie) {
    response.cookies.set(VIEWER_COOKIE_NAME, identity.viewerKey, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    })
  }

  if (identity.isAuthenticated) {
    response.cookies.set(TIER_COOKIE_NAME, identity.tier, {
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })
  }
}

function shouldBypassSubscriptionCheck() {
  return (
    process.env.NODE_ENV !== 'production' ||
    process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ||
    process.env.DEMO_MODE === 'true'
  )
}

export async function handleProductChat(req: Request, options: HandlerOptions) {
  const requestId = options.requestId ?? createRequestId()
  const evalDebugRequested = isTrustedEvalRequest(req)
  let body: unknown

  try {
    body = await req.json()
  } catch (error) {
    logError('chat_request_json_parse_failed', error, {
      request_id: requestId,
      route_product: options.product,
    })
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}

  const message = typeof payload.message === 'string' ? payload.message : ''
  let normalizedFiles: ReturnType<typeof normalizeChatFilesPayload>
  try {
    normalizedFiles = normalizeChatFilesPayload({
      fileBase64: typeof payload.fileBase64 === 'string' ? payload.fileBase64 : undefined,
      fileType: typeof payload.fileType === 'string' ? payload.fileType : undefined,
      fileName: typeof payload.fileName === 'string' ? payload.fileName : undefined,
      files: payload.files,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid attachment payload.' }, { status: 400 })
  }
  const hasFiles = normalizedFiles.length > 0
  const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId : undefined
  const mode =
    options.forceMode ?? (isPromptMode(payload.mode) ? payload.mode : 'direct')
  const sessionContext = sanitizeSessionContext(payload.sessionContext)

  const cookieStore = await cookies()
  const identity = await resolveRequestIdentity(cookieStore, req.headers)

  if (!identity.isAuthenticated) {
    return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 })
  }

  if (!shouldBypassSubscriptionCheck() && !hasPaidAccess(identity.tier)) {
    return NextResponse.json(
      { error: 'An active subscription is required to use ScholarHAAB. Choose Pro or Premium Plus to continue.' },
      { status: 403 }
    )
  }

  const requestRateLimit = evalDebugRequested
    ? {
        allowed: true,
        limit: Number.POSITIVE_INFINITY,
        remaining: Number.POSITIVE_INFINITY,
        retryAfterSeconds: 0,
      }
    : await assertRequestRateLimit({
        key: `${options.product}:${identity.viewerKey}`,
        tier: identity.tier,
        userId: identity.authUserId,
        requestId,
      })
  if (!requestRateLimit.allowed) {
    return NextResponse.json(
      {
        error: `Too many requests too quickly. Please wait about ${requestRateLimit.retryAfterSeconds}s and try again.`,
      },
      {
        status: 429,
        headers: {
          'retry-after': String(requestRateLimit.retryAfterSeconds),
        },
      }
    )
  }

  const effectiveMessage = message.trim() || 'Please analyze this uploaded file.'
  const preferUploadedEvidence = hasFiles && isExplicitFileGroundedQuestion(effectiveMessage)
  const rawQbankQuery =
    options.product === 'qbank' ? parseQbankQuery(effectiveMessage) : null

  if (
    shouldUseQaFastGeneralKnowledgePath({
      product: options.product,
      authUserId: identity.authUserId,
      rawQbankQuery,
      sessionId,
      hasFiles,
    })
  ) {
    const validation = validateAndFinalizeAnswer({
      query: effectiveMessage,
      answer:
        buildQbankGeneralKnowledgeReply(mode, effectiveMessage, sessionContext) ??
        'I can help with that, but I could not produce a direct tutor answer right now.',
      product: options.product,
      mode,
      deterministicGeneralAnswer: buildQbankGeneralKnowledgeReply(mode, effectiveMessage, sessionContext),
      deterministicGroundedAnswer: null,
      deterministicScholarshipAnswer: null,
    })
    const answer = validation.answer

    const qaFastPayload: Record<string, unknown> = {
      answer,
      response: answer,
      cached: false,
      fromCache: false,
      confidence: 92,
      sessionId: null,
      history: {
        enabled: false,
      },
      sources: [],
    }

    if (evalDebugRequested) {
      qaFastPayload._debug = {
        requestId,
        product: options.product,
        mode,
        qaFastPath: true,
        routing: {
          rawQbankQuery,
        },
        retrieval: {
          ragEnabled: false,
          ragChunks: [],
          reranker: null,
        },
        prompt: {
          systemPrompt: null,
          context: null,
        },
        validation,
        citations: {
          rawSources: [],
          displaySources: [],
        },
      }
    }

    const response = NextResponse.json(qaFastPayload)

    applyResponseCookies(response, identity)
    return response
  }

  const historyResult = sessionId
    ? await getChatSessionMessages({
        viewerKey: identity.viewerKey,
        sessionId,
      })
    : {
        enabled: false,
        session: null,
        messages: [],
      }

  const historyMessages = historyResult.messages.map((entry) => ({
    role: entry.role,
    content: entry.content,
  }))

  const contextDependentFollowUp = isContextDependentFollowUp(
    effectiveMessage,
    historyMessages,
    options.product
  )
  const contextualMessage = applySessionContextToMessage(
    options.product,
    effectiveMessage,
    sessionContext
  )
  const parsedQbankQuery =
    options.product === 'qbank'
      ? rawQbankQuery?.queryClass === 'GENERAL_KNOWLEDGE'
        ? rawQbankQuery
        : parseQbankQuery(contextualMessage)
      : null
  const parsedAbroadQuery: AbroadParsedQuery | null = null
  const scholarshipQuery = false
  const cacheIntent = resolveCacheIntent({
    product: options.product,
    message: effectiveMessage,
    rawQbankQuery,
    parsedQbankQuery,
    parsedAbroadQuery,
    scholarshipQuery,
  })
  const cacheContext = buildCacheContext({
    product: options.product,
    sessionContext,
    cacheIntent,
    rawQbankQuery,
    parsedQbankQuery,
    parsedAbroadQuery,
  })
  const cacheKey = buildCacheKey(effectiveMessage, {
    board: cacheContext.board,
    level: cacheContext.level,
    subject: cacheContext.subject,
    intent: cacheContext.keyIntent,
  })

  const shouldCheckCache =
    !evalDebugRequested &&
    !hasFiles &&
    !isPersonalQuestion(effectiveMessage) &&
    !contextDependentFollowUp &&
    isCacheableIntent(cacheIntent)

  const preview = evalDebugRequested
    ? createBypassedUsagePreview({
        tier: identity.tier,
        product: options.product,
        mode,
        message: effectiveMessage,
      })
    : await previewUsage({
        viewerKey: identity.viewerKey,
        tier: identity.tier,
        product: options.product,
        mode,
        message: effectiveMessage,
      })

  if (!preview.allowed) {
    const response = NextResponse.json(
      {
        error: preview.message ?? 'Daily credit limit reached.',
        usage: preview,
      },
      { status: 429 }
    )

    if (identity.shouldSetViewerCookie) {
      response.cookies.set(VIEWER_COOKIE_NAME, identity.viewerKey, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
      })
    }

    return response
  }

  if (shouldCheckCache) {
    const cached = await getCached(cacheKey)
    if (cached) {
      logEvent('info', 'answer_cache_hit', {
        request_id: requestId,
        product: options.product,
        cache_key: cacheKey.slice(0, 8),
        intent: cacheIntent,
      })

      const persistedChat = await persistChatTurn({
        viewerKey: identity.viewerKey,
        product: options.product,
        mode,
        sessionId,
        userMessage: effectiveMessage,
        assistantMessage: cached.response,
        assistantSources: cached.sources as Array<{ title: string; url?: string | null; tier?: string; lastChecked?: string | null }>,
      })

      const committedUsage = preview.enabled
        ? await commitUsage({
            viewerKey: identity.viewerKey,
            tier: identity.tier,
            product: options.product,
            mode,
            message: effectiveMessage,
            usageDate: preview.usageDate,
          })
        : preview
      const studyProgress =
        identity.authUserId && identity.authUserId !== 'test-anonymous-user'
        ? await recordStudyActivity({
            userId: identity.authUserId,
            product: options.product,
            mode,
          }).catch((error) => {
            logError('study_progress_update_failed', error, {
              request_id: requestId,
              user_id: identity.authUserId,
              product: options.product,
              mode,
              cached: true,
            })
            return null
          })
          : null

      const cachedPayload: Record<string, unknown> = {
        answer: cached.response,
        response: cached.response,
        cached: true,
        fromCache: true,
        confidence: cached.confidence,
        sessionId: persistedChat.sessionId,
        usage: committedUsage,
        studyProgress,
        history: {
          enabled: persistedChat.enabled,
        },
        sources: cached.sources,
      }

      if (evalDebugRequested) {
        cachedPayload._debug = {
          requestId,
          product: options.product,
          mode,
          cache: {
            intent: cacheIntent,
            keyPrefix: cacheKey.slice(0, 12),
            eligible: shouldCheckCache,
            hit: true,
          },
          retrieval: {
            ragEnabled: false,
            ragChunks: [],
            reranker: null,
          },
          prompt: {
            systemPrompt: null,
            context: null,
          },
          citations: {
            rawSources: cached.sources,
            displaySources: cached.sources,
          },
        }
      }

      const cachedResponse = NextResponse.json(cachedPayload)

      applyResponseCookies(cachedResponse, identity)

      return cachedResponse
    }
  }

  const retrievalMessage = buildRetrievalQuery(options.product, contextualMessage, historyMessages)
  let uploadedFiles: Awaited<ReturnType<typeof prepareUploadedFiles>> | null = null
  try {
    uploadedFiles = hasFiles ? await prepareUploadedFiles(normalizedFiles) : null
  } catch (error) {
    logError('uploaded_file_prepare_failed', error, {
      request_id: requestId,
      product: options.product,
      file_count: normalizedFiles.length,
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not read the uploaded file.' },
      { status: 400 }
    )
  }
  const uploadedChunks = uploadedFiles
    ? selectUploadedFileChunks(
        retrievalMessage,
        uploadedFiles.chunks,
        uploadedFiles.files.length === 1 ? 6 : 8
      )
    : []
  const uploadedWarningChunks = buildUploadedWarningChunks(uploadedFiles)

  if (uploadedFiles) {
    logEvent('info', 'uploaded_files_prepared', {
      request_id: requestId,
      product: options.product,
      file_count: uploadedFiles.files.length,
      inline_parts: uploadedFiles.inlineParts.length,
      extracted_chunks: uploadedFiles.chunks.length,
      selected_chunks: uploadedChunks.length,
      warnings: uploadedFiles.warnings,
    })
  }

  const qbankContext =
    options.product === 'qbank' &&
    parsedQbankQuery?.queryClass !== 'GENERAL_KNOWLEDGE' &&
    !preferUploadedEvidence
      ? await retrieveQbankContext(retrievalMessage)
      : null
  const ragContext =
    qbankContext ??
    (preferUploadedEvidence
      ? {
          enabled: uploadedChunks.length > 0 || uploadedWarningChunks.length > 0,
          chunks: [] as Awaited<ReturnType<typeof retrieveRagContext>>['chunks'],
        }
      : await retrieveRagContext(options.product, retrievalMessage))
  const mergedRagContext = [
    ...uploadedWarningChunks.map((entry) => ({
      sourceTitle: entry.sourceTitle,
      sourceUrl: entry.sourceUrl,
      content: entry.content,
      tier: entry.tier,
      lastChecked: entry.lastChecked,
      score: entry.score,
    })),
    ...uploadedChunks.map((entry) => ({
      sourceTitle: entry.sourceTitle,
      sourceUrl: entry.sourceUrl,
      content: entry.content,
      tier: entry.tier,
      lastChecked: entry.lastChecked,
      score: entry.score,
    })),
    ...ragContext.chunks.map((entry) => ({
      sourceTitle: entry.sourceTitle,
      sourceUrl: entry.sourceUrl,
      content: entry.content,
      tier: entry.tier,
      lastChecked: entry.lastChecked,
      score: 'score' in entry ? entry.score : null,
    })),
  ]

  const responseInput = {
    message: effectiveMessage,
    product: options.product,
    mode,
    history: historyMessages,
    sessionContext,
    ragContext: mergedRagContext.map((entry) => ({
      sourceTitle: entry.sourceTitle,
      sourceUrl: entry.sourceUrl,
      content: entry.content,
      tier: entry.tier,
    })),
  }

  let answer: string
  let responseOrigin: 'ai' | 'deterministic' | 'fallback' = 'ai'
  let deterministicGeneralKnowledgeAnswer: string | null = null
  let deterministicQbankFallbackAnswer: string | null = null
  let deterministicScholarshipAnswer: string | null = null
  let promptTextForDebug: string | null = null
  let systemPromptForDebug: string | null = null

  try {
    let deterministicQbankAnswer: string | null = null
    deterministicGeneralKnowledgeAnswer =
      options.product === 'qbank' &&
      rawQbankQuery?.queryClass === 'GENERAL_KNOWLEDGE'
        ? buildQbankGeneralKnowledgeReply(mode, effectiveMessage, sessionContext)
        : null

    if (deterministicGeneralKnowledgeAnswer) {
      deterministicQbankAnswer = deterministicGeneralKnowledgeAnswer
    } else if (qbankContext && shouldUseDeterministicQbankReply(qbankContext)) {
      deterministicQbankAnswer = buildQbankGroundedReply(mode, qbankContext, sessionContext)
      deterministicQbankFallbackAnswer = deterministicQbankAnswer
    } else if (qbankContext && shouldUseOfflineQbankReply()) {
      deterministicQbankAnswer = buildQbankOfflineReply(mode, qbankContext, sessionContext)
      deterministicQbankFallbackAnswer = deterministicQbankAnswer
    }

    if (deterministicQbankAnswer) {
      answer = deterministicQbankAnswer
      responseOrigin = 'deterministic'
    } else if (uploadedFiles) {
      const promptText = buildPromptText(
        effectiveMessage,
        responseInput.history,
        responseInput.ragContext,
        options.product
      )
      promptTextForDebug = promptText
      systemPromptForDebug = getSystemPrompt(options.product, mode, sessionContext)
      const maxTokens = getResponseBudget(options.product, mode, effectiveMessage)

      if (uploadedFiles.inlineParts.length > 0) {
        answer = await generateResponseFromParts(
          [...uploadedFiles.extractedTextParts, ...uploadedFiles.inlineParts, { text: promptText }],
          systemPromptForDebug,
          {
            maxTokens,
            requestId,
            userKey: identity.viewerKey,
            operation: `${options.product}_multipart_chat`,
          }
        )
      } else {
        answer = await buildChatResponse({
          ...responseInput,
          aiRequest: {
            requestId,
            userKey: identity.viewerKey,
            operation: `${options.product}_uploaded_text_chat`,
            maxTokens,
          },
        })
      }
    } else {
      promptTextForDebug = buildPromptText(
        effectiveMessage,
        responseInput.history,
        responseInput.ragContext,
        options.product
      )
      systemPromptForDebug = getSystemPrompt(options.product, mode, sessionContext)
      answer = await buildChatResponse({
        ...responseInput,
        aiRequest: {
          requestId,
          userKey: identity.viewerKey,
          operation: `${options.product}_chat`,
        },
      })
    }
  } catch (error) {
    logError('primary_chat_generation_failed', error, {
      request_id: requestId,
      product: options.product,
      mode,
    })
    responseOrigin = 'fallback'
    answer =
      options.product === 'qbank' && rawQbankQuery?.queryClass === 'GENERAL_KNOWLEDGE'
        ? buildQbankGeneralKnowledgeReply(mode, effectiveMessage, sessionContext) ??
          buildFallbackChatResponse(responseInput)
        : options.product === 'qbank' && qbankContext
        ? buildQbankOfflineReply(mode, qbankContext, sessionContext) ??
          buildFallbackChatResponse(responseInput)
        : buildFallbackChatResponse(responseInput)
  }

  if (!answer.trim()) {
    responseOrigin = 'fallback'
    answer =
      options.product === 'qbank' && rawQbankQuery?.queryClass === 'GENERAL_KNOWLEDGE'
        ? buildQbankGeneralKnowledgeReply(mode, effectiveMessage, sessionContext) ??
          (qbankContext
            ? buildQbankOfflineReply(mode, qbankContext, sessionContext)
            : buildFallbackChatResponse(responseInput)) ??
          buildFallbackChatResponse(responseInput)
        : options.product === 'qbank' && qbankContext
          ? buildQbankOfflineReply(mode, qbankContext, sessionContext) ??
            buildFallbackChatResponse(responseInput)
          : buildFallbackChatResponse(responseInput)
  }

  const validation = validateAndFinalizeAnswer({
    query: effectiveMessage,
    answer,
    product: options.product,
    mode,
    deterministicGeneralAnswer: deterministicGeneralKnowledgeAnswer,
    deterministicGroundedAnswer: deterministicQbankFallbackAnswer,
    deterministicScholarshipAnswer,
  })
  answer = validation.answer
  const confidenceScore = mapConfidenceToScore(validation.confidence)

  const rawSources = shouldExposeSources(
    options.product,
    qbankContext,
    uploadedChunks.length > 0 || uploadedWarningChunks.length > 0
  )
    ? mergedRagContext.map((entry) => ({
        title: entry.sourceTitle,
        url: entry.sourceUrl,
        tier: entry.tier,
        lastChecked: entry.lastChecked,
        score: entry.score,
      }))
    : []
  const debugRawSources =
    rawSources.length > 0 ? rawSources : collectDebugRawSources([...uploadedChunks, ...ragContext.chunks])
  const displaySources = buildDisplaySources({
    product: options.product,
    query: effectiveMessage,
    answer,
    sessionContext,
    sources: rawSources,
  })

  const persistedChat = await persistChatTurn({
    viewerKey: identity.viewerKey,
    product: options.product,
    mode,
    sessionId,
    userMessage: [message.trim(), getFilesSummary(normalizedFiles)].filter(Boolean).join('\n\n'),
    assistantMessage: answer,
    assistantSources: displaySources,
  })

  const committedUsage = preview.enabled
    ? await commitUsage({
        viewerKey: identity.viewerKey,
        tier: identity.tier,
        product: options.product,
        mode,
        message: effectiveMessage,
        usageDate: preview.usageDate,
      })
    : preview
  const studyProgress =
    identity.authUserId && identity.authUserId !== 'test-anonymous-user'
    ? await recordStudyActivity({
        userId: identity.authUserId,
        product: options.product,
        mode,
        fileType: normalizedFiles[0]?.fileType,
        fileName: normalizedFiles[0]?.fileName,
      }).catch((error) => {
        logError('study_progress_update_failed', error, {
          request_id: requestId,
          user_id: identity.authUserId,
          product: options.product,
          mode,
          cached: false,
        })
        return null
      })
      : null

  const responsePayload: Record<string, unknown> = {
    answer,
    response: answer,
    cached: false,
    fromCache: false,
    confidence: confidenceScore,
    sessionId: persistedChat.sessionId,
    usage: committedUsage,
    studyProgress,
    history: {
      enabled: persistedChat.enabled,
    },
    sources: displaySources,
  }

  if (evalDebugRequested) {
    responsePayload._debug = buildEvalDebugPayload({
      requestId,
      product: options.product,
      mode,
      effectiveMessage,
      contextualMessage,
      retrievalMessage,
      contextDependentFollowUp,
      cacheIntent,
      cacheKey,
      shouldCheckCache,
      responseOrigin,
      preferUploadedEvidence,
      rawQbankQuery,
      parsedQbankQuery,
      parsedAbroadQuery,
      scholarshipQuery,
      qbankContext,
      ragContext,
      promptText: promptTextForDebug,
      systemPrompt: systemPromptForDebug,
      validation,
      rawSources: debugRawSources,
      displaySources,
      uploadedFiles,
      uploadedChunks,
    })
  }

  const response = NextResponse.json(responsePayload)

  applyResponseCookies(response, identity)

  if (!evalDebugRequested && shouldCheckCache && responseOrigin !== 'fallback') {
    await setCached(
      cacheKey,
      effectiveMessage,
      answer,
      displaySources,
      confidenceScore,
      cacheIntent,
      cacheContext.cacheStoreContext
    )
  }

  return response
}
