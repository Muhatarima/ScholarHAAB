import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { buildChatResponse } from '@/lib/chat-response'
import { isPromptMode, type Product, type PromptMode } from '@/lib/products'
import { resolveRequestIdentity } from '@/lib/server/auth'
import {
  getChatSessionMessages,
  persistChatTurn,
} from '@/lib/server/chat-history'
import { retrieveQbankContext } from '@/lib/server/qbank'
import { retrieveRagContext } from '@/lib/server/rag'
import {
  commitUsage,
  previewUsage,
  TIER_COOKIE_NAME,
  VIEWER_COOKIE_NAME,
} from '@/lib/server/usage'

type HandlerOptions = {
  product: Product
  forceMode?: PromptMode
}

export async function handleProductChat(req: Request, options: HandlerOptions) {
  const body = await req.json()
  const message = typeof body?.message === 'string' ? body.message : ''
  const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : undefined
  const mode =
    options.forceMode ?? (isPromptMode(body?.mode) ? body.mode : 'direct')

  const cookieStore = await cookies()
  const identity = await resolveRequestIdentity(cookieStore)

  const preview = await previewUsage({
    viewerKey: identity.viewerKey,
    tier: identity.tier,
    product: options.product,
    mode,
    message,
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

  const ragContext =
    options.product === 'qbank'
      ? await retrieveQbankContext(message)
      : await retrieveRagContext(options.product, message)

  const answer = await buildChatResponse({
    message,
    product: options.product,
    mode,
    history: historyResult.messages.map((entry) => ({
      role: entry.role,
      content: entry.content,
    })),
    ragContext: ragContext.chunks.map((entry) => ({
      sourceTitle: entry.sourceTitle,
      sourceUrl: entry.sourceUrl,
      content: entry.content,
      tier: entry.tier,
    })),
  })

  const persistedChat = await persistChatTurn({
    viewerKey: identity.viewerKey,
    product: options.product,
    mode,
    sessionId,
    userMessage: message,
    assistantMessage: answer,
    assistantSources: ragContext.chunks.map((entry) => ({
      title: entry.sourceTitle,
      url: entry.sourceUrl,
      tier: entry.tier,
      lastChecked: entry.lastChecked,
    })),
  })

  const committedUsage = preview.enabled
    ? await commitUsage({
        viewerKey: identity.viewerKey,
        tier: identity.tier,
        product: options.product,
        mode,
        message,
        usageDate: preview.usageDate,
      })
    : preview

  const response = NextResponse.json({
    answer,
    sessionId: persistedChat.sessionId,
    usage: committedUsage,
    history: {
      enabled: persistedChat.enabled,
    },
    sources: ragContext.chunks.map((entry) => ({
      title: entry.sourceTitle,
      url: entry.sourceUrl,
      tier: entry.tier,
      lastChecked: entry.lastChecked,
    })),
  })

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

  return response
}
