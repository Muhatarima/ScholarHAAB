import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { resolveRequestIdentity } from '@/lib/server/auth'
import { getChatSessionMessages } from '@/lib/server/chat-history'
import { createRequestId, logError } from '@/lib/server/logger'
import { VIEWER_COOKIE_NAME } from '@/lib/server/usage'
import { requireAuth } from '@/lib/auth/requireAuth'

type RouteContext = {
  params: Promise<{
    sessionId: string
  }>
}

export async function GET(_req: Request, context: RouteContext) {
  const { error: authError } = await requireAuth(_req)
  if (authError) return authError

  const requestId = createRequestId()

  try {
    const { sessionId } = await context.params
    const cookieStore = await cookies()
    const identity = await resolveRequestIdentity(cookieStore, _req.headers)

    if (!identity.isAuthenticated) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401, headers: { 'x-request-id': requestId } }
      )
    }

    const history = await getChatSessionMessages({
      viewerKey: identity.viewerKey,
      sessionId,
    })

    const response = NextResponse.json(history, {
      headers: { 'x-request-id': requestId },
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

    return response
  } catch (error) {
    logError('history_detail_failed', error, {
      request_id: requestId,
      route: '/api/history/[sessionId]',
    })
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500, headers: { 'x-request-id': requestId } }
    )
  }
}
