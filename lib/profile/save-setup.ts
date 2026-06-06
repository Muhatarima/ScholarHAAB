import type { SupabaseClient, User } from '@supabase/supabase-js'
import { getSetupCompleted, isSetupSchemaCompatibilityError } from '@/lib/auth/setup-status'
import {
  BOARDS,
  EXPLANATION_STYLES,
  LANGUAGES,
  LEVELS,
  STAGES,
  SUBJECTS,
} from '@/lib/profile/setupOptions'

export type SetupInput = {
  board: string
  explanationStyle: string
  languagePreference: string
  level: string
  stage: string
  subjects: string[]
}

function validateSetup(input: SetupInput) {
  const level = input.level.trim()
  const board = input.board.trim()
  const stage = input.stage.trim()
  const languagePreference = input.languagePreference.trim()
  const explanationStyle = input.explanationStyle.trim()

  if (!LEVELS.includes(level as never)) throw new Error('Choose O Level or A Level.')
  if (!BOARDS.includes(board as never)) throw new Error('Choose Cambridge or Edexcel.')
  if (!LANGUAGES.includes(languagePreference as never)) {
    throw new Error('Choose a language preference.')
  }
  if (!EXPLANATION_STYLES.includes(explanationStyle as never)) {
    throw new Error('Choose an explanation style.')
  }

  const allowedSubjects = new Set(SUBJECTS[level as keyof typeof SUBJECTS])
  const subjects = Array.from(
    new Set(
      input.subjects
        .map((subject) => subject.trim())
        .filter((subject) => allowedSubjects.has(subject as never))
    )
  )
  if (subjects.length === 0) throw new Error('Choose at least one subject.')

  const allowedStages = new Set(STAGES[level as keyof typeof STAGES])

  return {
    board,
    explanationStyle,
    languagePreference,
    level,
    stage: stage && allowedStages.has(stage as never) ? stage : null,
    subjects,
  }
}

export async function saveSetupProfile(
  supabase: SupabaseClient,
  user: User,
  input: SetupInput
) {
  const setup = validateSetup(input)
  const fullName =
    String(user.user_metadata?.full_name ?? '').trim() ||
    String(user.email ?? '').trim() ||
    'Student'

  const canonicalUpdate = await supabase
    .from('profiles')
    .update({
      full_name: fullName,
      setup_completed: true,
    })
    .eq('id', user.id)
    .select('id, setup_completed')
    .maybeSingle()

  if (canonicalUpdate.error && !isSetupSchemaCompatibilityError(canonicalUpdate.error)) {
    throw canonicalUpdate.error
  }

  if (!canonicalUpdate.error && !canonicalUpdate.data) {
    const canonicalInsert = await supabase.from('profiles').insert({
      full_name: fullName,
      id: user.id,
      setup_completed: true,
    })

    if (canonicalInsert.error && !isSetupSchemaCompatibilityError(canonicalInsert.error)) {
      throw canonicalInsert.error
    }
  }

  // Keep the pre-existing profile model synchronized during rollout.
  const legacyUpdate = await supabase
    .from('profiles')
    .update({ onboarding_completed: true })
    .eq('id', user.id)

  if (legacyUpdate.error && !isSetupSchemaCompatibilityError(legacyUpdate.error)) {
    throw legacyUpdate.error
  }

  const studyProfile = await supabase.from('user_profiles').upsert(
    {
      board: setup.board,
      explanation_style: setup.explanationStyle,
      language_preference: setup.languagePreference,
      level: setup.level,
      setup_completed: true,
      stage: setup.stage,
      subjects: setup.subjects,
      updated_at: new Date().toISOString(),
      user_id: user.id,
    },
    { onConflict: 'user_id' }
  )

  if (studyProfile.error && !isSetupSchemaCompatibilityError(studyProfile.error)) {
    throw studyProfile.error
  }

  if (!(await getSetupCompleted(supabase, user.id))) {
    throw new Error('Setup could not be verified after saving. Please try again.')
  }

  return setup
}
