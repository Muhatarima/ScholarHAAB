import type { SupabaseClient } from '@supabase/supabase-js'

function isCompatibilityError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false
  }

  const record = error as {
    code?: string
    details?: string
    hint?: string
    message?: string
  }
  const message = [record.message, record.details, record.hint]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return (
    record.code === '42703' ||
    record.code === '42P01' ||
    record.code === 'PGRST204' ||
    record.code === 'PGRST205' ||
    message.includes('column') ||
    message.includes('schema cache') ||
    message.includes('does not exist')
  )
}

export async function getSetupCompleted(supabase: SupabaseClient, userId: string) {
  const canonical = await supabase
    .from('profiles')
    .select('setup_completed')
    .eq('id', userId)
    .maybeSingle()

  if (!canonical.error && canonical.data?.setup_completed === true) {
    return true
  }

  if (canonical.error && !isCompatibilityError(canonical.error)) {
    throw canonical.error
  }

  // Temporary rollout compatibility for existing ScholarHAAB profile rows.
  const legacyProfile = await supabase
    .from('profiles')
    .select('onboarding_completed')
    .eq('id', userId)
    .maybeSingle()

  if (!legacyProfile.error && legacyProfile.data?.onboarding_completed === true) {
    return true
  }

  if (legacyProfile.error && !isCompatibilityError(legacyProfile.error)) {
    throw legacyProfile.error
  }

  const studyProfile = await supabase
    .from('user_profiles')
    .select('setup_completed')
    .eq('user_id', userId)
    .maybeSingle()

  if (studyProfile.error) {
    if (isCompatibilityError(studyProfile.error)) {
      return false
    }
    throw studyProfile.error
  }

  return studyProfile.data?.setup_completed === true
}

export function isSetupSchemaCompatibilityError(error: unknown) {
  return isCompatibilityError(error)
}
