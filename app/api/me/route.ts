import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createEmptyStudyProgress } from '@/lib/study-progress'
import { resolveRequestIdentity } from '@/lib/server/auth'
import { isAdminUser } from '@/lib/server/admin'
import { getStudentProfile } from '@/lib/server/profile'
import { createRequestId, logError } from '@/lib/server/logger'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/requireAuth'

export async function GET(req: Request) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError

  const requestId = createRequestId()
  try {
    const cookieStore = await cookies()
    const identity = await resolveRequestIdentity(cookieStore, req.headers)
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const profile =
      identity.isAuthenticated && identity.authUserId
        ? await getStudentProfile(identity.authUserId)
        : null
    const admin = identity.isAuthenticated ? await isAdminUser(identity.authUserId) : false

    const response = NextResponse.json({
      authenticated: identity.isAuthenticated,
      userId: identity.authUserId,
      email: user?.email ?? profile?.email ?? null,
      fullName:
        typeof user?.user_metadata.full_name === 'string'
          ? user.user_metadata.full_name
          : profile?.fullName ?? null,
      viewerKey: identity.viewerKey,
      tier: identity.tier,
      onboardingCompleted: profile?.onboardingCompleted ?? false,
      preferredLanguage: profile?.preferredLanguage ?? 'en',
      defaultProduct: profile?.defaultProduct === 'abroad' ? 'qbank' : (profile?.defaultProduct ?? 'qbank'),
      studyProgress: profile?.studyProgress ?? createEmptyStudyProgress(),
      isAdmin: admin,
    })
    response.headers.set('x-request-id', requestId)
    return response
  } catch (error) {
    logError('me_api_error', error, { request_id: requestId, route: '/api/me' })
    const response = NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
    response.headers.set('x-request-id', requestId)
    return response
  }
}
