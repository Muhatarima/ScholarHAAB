import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { resolveRequestIdentity } from '@/lib/server/auth'
import {
  commitUsage,
  createBypassedUsagePreview,
  previewUsage,
  TIER_COOKIE_NAME,
  VIEWER_COOKIE_NAME,
} from '@/lib/server/usage'
import { hasPaidAccess } from '@/lib/usage'
import { isTrustedEvalRequest } from '@/lib/server/eval-mode'
import { createRequestId, logError } from '@/lib/server/logger'
import { InvalidJsonBodyError } from '@/lib/server/request-body'
import { assertRequestRateLimit } from '@/lib/server/rate-limit'
import type { Product, PromptMode } from '@/lib/products'

export type GuardOptions = {
  product: Product
  mode?: PromptMode
  messageHint?: string // Text used to trigger UsageAction regex in lib/usage.ts
  requireAuth?: boolean // Default true
}

export type GuardContext = {
  identity: Awaited<ReturnType<typeof resolveRequestIdentity>>
  usagePreview: Awaited<ReturnType<typeof previewUsage>>
  requestId: string
}

function applyCookies(response: NextResponse, identity: Awaited<ReturnType<typeof resolveRequestIdentity>>) {
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

function withRequestId(response: NextResponse, requestId: string) {
  response.headers.set('x-request-id', requestId)
  return response
}

function resolveRoute(req: Request) {
  try {
    return new URL(req.url).pathname
  } catch {
    return 'unknown'
  }
}

function shouldBypassSubscriptionCheck() {
  return (
    process.env.NODE_ENV !== 'production' ||
    process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ||
    process.env.DEMO_MODE === 'true'
  )
}

export async function withApiGuard(
  req: Request,
  options: GuardOptions,
  handler: (req: Request, ctx: GuardContext) => Promise<NextResponse>
) {
  const requestId = createRequestId()
  const route = resolveRoute(req)

  try {
    const cookieStore = await cookies()
  const identity = await resolveRequestIdentity(cookieStore, req.headers)
    const requireAuth = options.requireAuth ?? true
    const trustedEvalRequest = isTrustedEvalRequest(req)

    if (requireAuth && !identity.isAuthenticated) {
      return withRequestId(
        NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 }),
        requestId
      )
    }

    if (!shouldBypassSubscriptionCheck() && !hasPaidAccess(identity.tier)) {
      return withRequestId(
        NextResponse.json(
          { error: 'An active subscription is required to use ScholarHAAB. Choose Pro or Premium Plus to continue.' },
          { status: 403 }
        ),
        requestId
      )
    }

    const requestRateLimit = trustedEvalRequest
      ? { allowed: true, limit: Number.POSITIVE_INFINITY, remaining: Number.POSITIVE_INFINITY, retryAfterSeconds: 0 }
      : await assertRequestRateLimit({
          key: `${options.product}:${identity.viewerKey}`,
          tier: identity.tier,
          userId: identity.authUserId,
          requestId,
        })
    if (!requestRateLimit.allowed) {
      return withRequestId(
        NextResponse.json(
          {
            error: `Too many requests too quickly. Please wait about ${requestRateLimit.retryAfterSeconds}s and try again.`,
          },
          {
            status: 429,
            headers: {
              'retry-after': String(requestRateLimit.retryAfterSeconds),
            },
          }
        ),
        requestId
      )
    }

    const mode = options.mode ?? 'direct'
    const messageHint = options.messageHint ?? ''

    const preview = trustedEvalRequest
      ? createBypassedUsagePreview({
          tier: identity.tier,
          product: options.product,
          mode,
          message: messageHint,
        })
      : await previewUsage({
          viewerKey: identity.viewerKey,
          tier: identity.tier,
          product: options.product,
          mode,
          message: messageHint,
        })

    if (!preview.allowed) {
      const errorResponse = NextResponse.json(
        {
          error: preview.message ?? 'Daily credit limit reached.',
          usage: preview,
        },
        { status: 429 }
      )
      applyCookies(errorResponse, identity)
      return withRequestId(errorResponse, requestId)
    }

    let response: NextResponse
    try {
      response = await handler(req, { identity, usagePreview: preview, requestId })
    } catch (error) {
      const status = error instanceof InvalidJsonBodyError ? 400 : 500
      const message = error instanceof InvalidJsonBodyError ? error.message : 'Something went wrong'
      logError('api_guard_handler_failed', error, {
        request_id: requestId,
        route,
        product: options.product,
        mode,
      })
      response = NextResponse.json({ error: message }, { status })
    }

    if (preview.enabled && response.status >= 200 && response.status < 300) {
      try {
        await commitUsage({
          viewerKey: identity.viewerKey,
          tier: identity.tier,
          product: options.product,
          mode,
          message: messageHint,
          usageDate: preview.usageDate,
        })
      } catch (error) {
        logError('api_guard_commit_failed', error, {
          request_id: requestId,
          route,
          product: options.product,
          mode,
        })
      }
    }

    applyCookies(response, identity)
    return withRequestId(response, requestId)
  } catch (error) {
    logError('api_guard_failed', error, {
      request_id: requestId,
      route,
      product: options.product,
    })
    return withRequestId(
      NextResponse.json({ error: 'Something went wrong' }, { status: 500 }),
      requestId
    )
  }
}
