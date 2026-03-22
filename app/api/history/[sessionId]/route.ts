import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { resolveRequestIdentity } from '@/lib/server/auth'
import { getChatSessionMessages } from '@/lib/server/chat-history'
import { VIEWER_COOKIE_NAME } from '@/lib/server/usage'

type RouteContext = {
  params: Promise<{
    sessionId: string
  }>
}

export async function GET(_req: Request, context: RouteContext) {
  try {
    const { sessionId } = await context.params
    const cookieStore = await cookies()
    const identity = await resolveRequestIdentity(cookieStore)

    const history = await getChatSessionMessages({
      viewerKey: identity.viewerKey,
      sessionId,
    })

    const response = NextResponse.json(history)

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
    console.error('History detail API error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
