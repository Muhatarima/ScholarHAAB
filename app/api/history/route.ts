import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { isProduct } from '@/lib/products'
import { resolveRequestIdentity } from '@/lib/server/auth'
import { listChatSessions } from '@/lib/server/chat-history'
import { VIEWER_COOKIE_NAME } from '@/lib/server/usage'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const requestedProduct = searchParams.get('product')
    const product = isProduct(requestedProduct) ? requestedProduct : 'abroad'

    const cookieStore = await cookies()
    const identity = await resolveRequestIdentity(cookieStore)

    const history = await listChatSessions({
      viewerKey: identity.viewerKey,
      product,
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
    console.error('History API error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
