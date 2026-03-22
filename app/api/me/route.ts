import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { resolveRequestIdentity } from '@/lib/server/auth'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const identity = await resolveRequestIdentity(cookieStore)

    return NextResponse.json({
      authenticated: identity.isAuthenticated,
      userId: identity.authUserId,
      viewerKey: identity.viewerKey,
      tier: identity.tier,
    })
  } catch (error) {
    console.error('Me API error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
