import type { Product } from '@/lib/products'
import { createEmptyStudyProgress, type StudyProgressSnapshot } from '@/lib/study-progress'
import {
  fetchStudyProgressSnapshot,
  type ProfileProgressRow,
} from '@/lib/server/progress'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'
import {
  createEmptyStudentProfile,
  sanitizeSupportedLanguage,
  type StudentProfile,
  type SupportedLanguage,
} from '@/lib/user-profile'

type ProfileRow = {
  id: string
  email: string | null
  full_name: string | null
  date_of_birth: string | null
  default_product: Product | null
  preferred_board: string | null
  preferred_level: string | null
  preferred_subjects: string[] | null
  preferred_language: SupportedLanguage | null
  target_country: string | null
  target_degree: string | null
  target_field: string | null
  funding_preference: string | null
  nationality: string | null
  onboarding_completed: boolean | null
  wants_deadline_alerts: boolean | null
  created_at: string | null
  updated_at: string | null
  streak_days: number | null
  longest_streak: number | null
  total_xp: number | null
  last_active_date: string | null
}

type SubscriptionRow = {
  tier: string | null
  status: string | null
}

function isProfileSchemaMismatchError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false
  }

  const record = error as { code?: string; message?: string; details?: string; hint?: string }
  const haystack = [record.message, record.details, record.hint].filter(Boolean).join(' ').toLowerCase()
  return record.code === '42703' || record.code === 'PGRST204' || haystack.includes('column')
}

function toFallbackProfileRow(userId: string, row: Record<string, unknown> | null): ProfileRow | null {
  if (!row) {
    return null
  }

  return {
    id: userId,
    email: null,
    full_name: typeof row.full_name === 'string' ? row.full_name : null,
    date_of_birth: typeof row.date_of_birth === 'string' ? row.date_of_birth : null,
    default_product: null,
    preferred_board: null,
    preferred_level: null,
    preferred_subjects: [],
    preferred_language: 'en',
    target_country: null,
    target_degree: null,
    target_field: null,
    funding_preference: null,
    nationality: 'Bangladesh',
    onboarding_completed: false,
    wants_deadline_alerts: true,
    created_at: typeof row.created_at === 'string' ? row.created_at : null,
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : null,
    streak_days: 0,
    longest_streak: 0,
    total_xp: 0,
    last_active_date: null,
  }
}

export type ProfileUpdateInput = {
  defaultProduct?: Product | null
  preferredBoard?: string | null
  preferredLevel?: string | null
  preferredSubjects?: string[]
  preferredLanguage?: SupportedLanguage
  targetCountry?: string | null
  targetDegree?: string | null
  targetField?: string | null
  fundingPreference?: string | null
  nationality?: string | null
  wantsDeadlineAlerts?: boolean
  onboardingCompleted?: boolean
}

function uniqueStrings(values: string[] | undefined) {
  return Array.from(new Set((values ?? []).map((entry) => entry.trim()).filter(Boolean))).slice(0, 12)
}

function toStudentProfile(row: ProfileRow | null, subscription: SubscriptionRow | null, userId: string) {
  const fallback = createEmptyStudentProfile(userId)
  if (!row) {
    return {
      ...fallback,
      activeTier: subscription?.tier ?? 'expired',
      activeSubscriptionStatus: subscription?.status ?? 'inactive',
    }
  }

  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    dateOfBirth: row.date_of_birth,
    defaultProduct: row.default_product,
    preferredBoard: row.preferred_board,
    preferredLevel: row.preferred_level,
    preferredSubjects: Array.isArray(row.preferred_subjects) ? row.preferred_subjects.filter(Boolean) : [],
    preferredLanguage: sanitizeSupportedLanguage(row.preferred_language),
    targetCountry: row.target_country,
    targetDegree: row.target_degree,
    targetField: row.target_field,
    fundingPreference: row.funding_preference,
    nationality: row.nationality || 'Bangladesh',
    onboardingCompleted: Boolean(row.onboarding_completed),
    wantsDeadlineAlerts: row.wants_deadline_alerts ?? true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    activeTier: subscription?.tier ?? 'expired',
    activeSubscriptionStatus: subscription?.status ?? 'inactive',
    studyProgress: fallback.studyProgress,
  }
}

function pickProfileProgress(row: ProfileRow | null): ProfileProgressRow | null {
  if (!row) {
    return null
  }

  return {
    streak_days: row.streak_days,
    longest_streak: row.longest_streak,
    total_xp: row.total_xp,
    last_active_date: row.last_active_date,
  }
}

function withStudyProgress(profile: StudentProfile, studyProgress: StudyProgressSnapshot) {
  return {
    ...profile,
    studyProgress,
  }
}

async function fetchActiveSubscription(userId: string) {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .select('tier, status')
    .eq('user_id', userId)
    .in('status', ['active', 'past_due'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data as SubscriptionRow | null) ?? null
}

export async function getStudentProfile(userId: string): Promise<StudentProfile> {
  const supabaseAdmin = getSupabaseAdmin()
  const [profileResult, subscription] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select(
        'id, email, full_name, date_of_birth, default_product, preferred_board, preferred_level, preferred_subjects, preferred_language, target_country, target_degree, target_field, funding_preference, nationality, onboarding_completed, wants_deadline_alerts, created_at, updated_at, streak_days, longest_streak, total_xp, last_active_date'
      )
      .eq('id', userId)
      .maybeSingle(),
    fetchActiveSubscription(userId),
  ])

  if (!profileResult.error) {
    const row = (profileResult.data as ProfileRow | null) ?? null
    const studyProgress = await fetchStudyProgressSnapshot(userId, pickProfileProgress(row))
    return withStudyProgress(toStudentProfile(row, subscription, userId), studyProgress)
  }

  if (!isProfileSchemaMismatchError(profileResult.error)) {
    throw profileResult.error
  }

  const fallbackResult = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, date_of_birth, created_at, updated_at')
    .eq('id', userId)
    .maybeSingle()

  if (fallbackResult.error) {
    throw fallbackResult.error
  }

  const row = toFallbackProfileRow(userId, fallbackResult.data as Record<string, unknown> | null)
  let studyProgress = createEmptyStudyProgress()

  try {
    studyProgress = await fetchStudyProgressSnapshot(userId, null)
  } catch {
    studyProgress = createEmptyStudyProgress()
  }

  return withStudyProgress(toStudentProfile(row, subscription, userId), studyProgress)
}

export async function upsertStudentProfile(userId: string, input: ProfileUpdateInput): Promise<StudentProfile> {
  const supabaseAdmin = getSupabaseAdmin()
  const payload = {
    id: userId,
    default_product: input.defaultProduct ?? null,
    preferred_board: input.preferredBoard ?? null,
    preferred_level: input.preferredLevel ?? null,
    preferred_subjects: uniqueStrings(input.preferredSubjects),
    preferred_language: sanitizeSupportedLanguage(input.preferredLanguage),
    target_country: input.targetCountry ?? null,
    target_degree: input.targetDegree ?? null,
    target_field: input.targetField ?? null,
    funding_preference: input.fundingPreference ?? null,
    nationality: input.nationality?.trim() || 'Bangladesh',
    wants_deadline_alerts: input.wantsDeadlineAlerts ?? true,
    onboarding_completed: Boolean(input.onboardingCompleted),
  }

  const { error } = await supabaseAdmin.from('profiles').upsert(payload, { onConflict: 'id' })
  if (error) {
    if (isProfileSchemaMismatchError(error)) {
      throw new Error('Profile setup needs the latest database migration before it can be saved.')
    }
    throw error
  }

  return getStudentProfile(userId)
}
