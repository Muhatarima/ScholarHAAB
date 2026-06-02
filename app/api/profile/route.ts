import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { resolveRequestIdentity } from '@/lib/server/auth'
import { getStudentProfile, upsertStudentProfile } from '@/lib/server/profile'
import { createRequestId, logError } from '@/lib/server/logger'
import { readJsonBody } from '@/lib/server/request-body'
import { requireRealAuth } from '@/lib/auth/requireAuth'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'

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

function isMissingTable(error: unknown) {
  const code = (error as { code?: string })?.code
  const message = String((error as { message?: string })?.message ?? '')
  return code === '42P01' || code === 'PGRST205' || /schema cache|does not exist/i.test(message)
}

function isDemoUserId(userId: string) {
  return userId === 'test-anonymous-user' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)
}

function createDemoProfile(overrides: Record<string, unknown> = {}) {
  const setupProfile = {
    level: 'O Level',
    board: 'Cambridge',
    stage: 'Class 10',
    subjects: ['Physics', 'Chemistry'],
    language_preference: 'Banglish',
    explanation_style: 'Step-by-step teacher style',
    setup_completed: true,
    updated_at: new Date().toISOString(),
  }

  return {
    id: 'test-anonymous-user',
    email: null,
    fullName: 'ScholarHAAB Demo Student',
    preferredBoard: setupProfile.board,
    preferredLevel: setupProfile.level,
    preferredSubjects: setupProfile.subjects,
    preferredLanguage: 'bn',
    onboardingCompleted: true,
    activeTier: 'premium',
    activeSubscriptionStatus: 'active',
    stage: setupProfile.stage,
    languagePreference: setupProfile.language_preference,
    explanationStyle: setupProfile.explanation_style,
    setupProfile,
    ...overrides,
  }
}

async function loadSetupProfile(userId: string) {
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('user_profiles')
      .select('level, board, stage, subjects, language_preference, explanation_style, setup_completed, updated_at')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw error
    return data as {
      level?: string | null
      board?: string | null
      stage?: string | null
      subjects?: string[] | null
      language_preference?: string | null
      explanation_style?: string | null
      setup_completed?: boolean | null
      updated_at?: string | null
    } | null
  } catch (error) {
    if (!isMissingTable(error)) {
      logError('profile_setup_load_failed', error, { route: '/api/profile' })
    }
    return null
  }
}

function toLegacyLanguagePreference(value: string | null | undefined) {
  return value === 'English' ? 'en' : 'bn'
}

export async function GET(req: Request) {
  const { error: authError } = await requireRealAuth()
  if (authError) return authError

  const requestId = createRequestId()

  try {
    const cookieStore = await cookies()
    const identity = await resolveRequestIdentity(cookieStore, req.headers)
    if (!identity.isAuthenticated || !identity.authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'x-request-id': requestId } })
    }

    if (isDemoUserId(identity.authUserId)) {
      const profile = createDemoProfile()
      return NextResponse.json({ success: true, profile, setupProfile: profile.setupProfile }, { headers: { 'x-request-id': requestId } })
    }

    const [profile, setupProfile] = await Promise.all([
      getStudentProfile(identity.authUserId),
      loadSetupProfile(identity.authUserId),
    ])
    const mergedProfile = {
      ...profile,
      preferredBoard: profile.preferredBoard ?? setupProfile?.board ?? null,
      preferredLevel: profile.preferredLevel ?? setupProfile?.level ?? null,
      preferredSubjects: profile.preferredSubjects.length ? profile.preferredSubjects : setupProfile?.subjects ?? [],
      preferredLanguage: profile.preferredLanguage ?? toLegacyLanguagePreference(setupProfile?.language_preference),
      onboardingCompleted: profile.onboardingCompleted || Boolean(setupProfile?.setup_completed),
      stage: setupProfile?.stage ?? null,
      languagePreference: setupProfile?.language_preference ?? (profile.preferredLanguage === 'en' ? 'English' : 'Banglish'),
      explanationStyle: setupProfile?.explanation_style ?? 'Step-by-step teacher style',
      setupProfile,
    }
    return NextResponse.json({ success: true, profile: mergedProfile, setupProfile }, { headers: { 'x-request-id': requestId } })
  } catch (error) {
    logError('profile_get_failed', error, { request_id: requestId, route: '/api/profile' })
    return NextResponse.json(
      { success: false, error: toPublicProfileErrorMessage(error, 'Could not load profile right now.') },
      { status: 500, headers: { 'x-request-id': requestId } }
    )
  }
}

export async function PUT(req: Request) {
  const { error: authError } = await requireRealAuth()
  if (authError) return authError

  const requestId = createRequestId()

  try {
    const cookieStore = await cookies()
    const identity = await resolveRequestIdentity(cookieStore, req.headers)
    if (!identity.isAuthenticated || !identity.authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'x-request-id': requestId } })
    }

    const body = await readJsonBody(req)
    const preferredBoard = typeof body.preferredBoard === 'string'
      ? body.preferredBoard
      : typeof body.board === 'string'
        ? body.board
        : null
    const preferredLevel = typeof body.preferredLevel === 'string'
      ? body.preferredLevel
      : typeof body.level === 'string'
        ? body.level
        : null
    const preferredSubjects = Array.isArray(body.preferredSubjects)
      ? body.preferredSubjects.filter((entry): entry is string => typeof entry === 'string')
      : Array.isArray(body.subjects)
        ? body.subjects.filter((entry): entry is string => typeof entry === 'string')
        : []
    const languagePreference = typeof body.languagePreference === 'string'
      ? body.languagePreference
      : body.preferredLanguage === 'en'
        ? 'English'
        : body.preferredLanguage === 'bn'
          ? 'Banglish'
          : null
    const onboardingCompleted =
      typeof body.onboardingCompleted === 'boolean'
        ? body.onboardingCompleted
        : Boolean(preferredBoard || preferredLevel || preferredSubjects.length || languagePreference)

    if (isDemoUserId(identity.authUserId)) {
      const profile = createDemoProfile({
        preferredBoard: preferredBoard ?? 'Cambridge',
        preferredLevel: preferredLevel ?? 'O Level',
        preferredSubjects: preferredSubjects.length ? preferredSubjects : ['Physics', 'Chemistry'],
        preferredLanguage: languagePreference === 'English' ? 'en' : 'bn',
        onboardingCompleted,
        stage: typeof body.stage === 'string' && body.stage.trim() ? body.stage.trim() : 'Class 10',
        languagePreference: languagePreference ?? 'Banglish',
        explanationStyle:
          typeof body.explanationStyle === 'string' && body.explanationStyle.trim()
            ? body.explanationStyle.trim()
            : 'Step-by-step teacher style',
      })
      return NextResponse.json({ success: true, profile, setupProfile: profile.setupProfile }, { headers: { 'x-request-id': requestId } })
    }

    if (preferredBoard || preferredLevel || preferredSubjects.length || languagePreference || typeof body.explanationStyle === 'string') {
      try {
        const supabase = getSupabaseAdmin()
        await supabase.from('user_profiles').upsert(
          {
            user_id: identity.authUserId,
            board: preferredBoard ?? 'Cambridge',
            level: preferredLevel ?? 'A Level',
            stage: typeof body.stage === 'string' && body.stage.trim() ? body.stage.trim() : null,
            subjects: preferredSubjects,
            language_preference: languagePreference ?? 'English',
            explanation_style:
              typeof body.explanationStyle === 'string' && body.explanationStyle.trim()
                ? body.explanationStyle.trim()
                : 'Step-by-step teacher style',
            setup_completed: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
      } catch (error) {
        if (!isMissingTable(error)) throw error
      }
    }

    const profile = await upsertStudentProfile(identity.authUserId, {
      defaultProduct: 'qbank',
      preferredBoard,
      preferredLevel,
      preferredSubjects,
      preferredLanguage: languagePreference
        ? languagePreference === 'English'
          ? 'en'
          : 'bn'
        : body.preferredLanguage === 'bn'
          ? 'bn'
          : 'en',
      targetCountry: typeof body.targetCountry === 'string' ? body.targetCountry : null,
      targetDegree: typeof body.targetDegree === 'string' ? body.targetDegree : null,
      targetField: typeof body.targetField === 'string' ? body.targetField : null,
      fundingPreference: typeof body.fundingPreference === 'string' ? body.fundingPreference : null,
      nationality: typeof body.nationality === 'string' ? body.nationality : 'Bangladesh',
      wantsDeadlineAlerts: body.wantsDeadlineAlerts !== false,
      onboardingCompleted,
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
