import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { resolveRequestIdentity } from '@/lib/server/auth'
import { getStudentProfile, upsertStudentProfile } from '@/lib/server/profile'
import { createRequestId, logError } from '@/lib/server/logger'
import { readJsonBody } from '@/lib/server/request-body'
import { requireAuth } from '@/lib/auth/requireAuth'

export const dynamic = 'force-dynamic'

function toPublicProfileErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) {
    return fallback
  }

  if (
    /latest database migration/i.test(error.message) ||
    /could not (load|save).*(profile|setup)/i.test(error.message)
  ) {
    return error.message
  }

  return fallback
}

export async function GET(req: Request) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError

  const requestId = createRequestId()

  try {
    const cookieStore = await cookies()
    const identity = await resolveRequestIdentity(cookieStore, req.headers)
    if (!identity.isAuthenticated || !identity.authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'x-request-id': requestId } })
    }

    const profile = await getStudentProfile(identity.authUserId)
    return NextResponse.json({ success: true, profile }, { headers: { 'x-request-id': requestId } })
  } catch (error) {
    logError('profile_get_failed', error, { request_id: requestId, route: '/api/profile' })
    return NextResponse.json(
      { success: false, error: toPublicProfileErrorMessage(error, 'Could not load profile right now.') },
      { status: 500, headers: { 'x-request-id': requestId } }
    )
  }
}

export async function PUT(req: Request) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError

  const requestId = createRequestId()

  try {
    const cookieStore = await cookies()
    const identity = await resolveRequestIdentity(cookieStore, req.headers)
    if (!identity.isAuthenticated || !identity.authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'x-request-id': requestId } })
    }

    const body = await readJsonBody(req)
    const profile = await upsertStudentProfile(identity.authUserId, {
      defaultProduct: 'qbank',
      preferredBoard: typeof body.preferredBoard === 'string' ? body.preferredBoard : null,
      preferredLevel: typeof body.preferredLevel === 'string' ? body.preferredLevel : null,
      preferredSubjects: Array.isArray(body.preferredSubjects)
        ? body.preferredSubjects.filter((entry): entry is string => typeof entry === 'string')
        : [],
      preferredLanguage: body.preferredLanguage === 'bn' ? 'bn' : 'en',
      targetCountry: typeof body.targetCountry === 'string' ? body.targetCountry : null,
      targetDegree: typeof body.targetDegree === 'string' ? body.targetDegree : null,
      targetField: typeof body.targetField === 'string' ? body.targetField : null,
      fundingPreference: typeof body.fundingPreference === 'string' ? body.fundingPreference : null,
      nationality: typeof body.nationality === 'string' ? body.nationality : 'Bangladesh',
      wantsDeadlineAlerts: body.wantsDeadlineAlerts !== false,
      onboardingCompleted: Boolean(body.onboardingCompleted),
    })

    return NextResponse.json({ success: true, profile }, { headers: { 'x-request-id': requestId } })
  } catch (error) {
    logError('profile_update_failed', error, { request_id: requestId, route: '/api/profile' })
    return NextResponse.json(
      { success: false, error: toPublicProfileErrorMessage(error, 'Could not save profile right now.') },
      { status: 500, headers: { 'x-request-id': requestId } }
    )
  }
}
