export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'
import { upsertStudentProfile } from '@/lib/server/profile'
import { BOARDS, EXPLANATION_STYLES, LANGUAGES, LEVELS, STAGES, SUBJECTS } from '@/lib/profile/setupOptions'

function isMissingTable(error: unknown) {
  const code = (error as { code?: string })?.code
  const message = String((error as { message?: string })?.message ?? '')
  return code === '42P01' || code === 'PGRST205' || /schema cache|does not exist/i.test(message)
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((entry) => String(entry).trim()).filter(Boolean)
    : []
}

function validateSetup(body: Record<string, unknown>) {
  const level = String(body.level ?? '').trim()
  const board = String(body.board ?? '').trim()
  const stage = String(body.stage ?? '').trim()
  const subjects = stringArray(body.subjects)
  const languagePreference = String(body.languagePreference ?? '').trim()
  const explanationStyle = String(body.explanationStyle ?? '').trim()

  if (!LEVELS.includes(level as never)) throw new Error('Choose O Level or A Level.')
  if (!BOARDS.includes(board as never)) throw new Error('Choose Cambridge or Edexcel.')
  if (!LANGUAGES.includes(languagePreference as never)) throw new Error('Choose a language preference.')
  if (!EXPLANATION_STYLES.includes(explanationStyle as never)) throw new Error('Choose an explanation style.')

  const allowedSubjects = new Set(SUBJECTS[level as keyof typeof SUBJECTS])
  const cleanSubjects = Array.from(new Set(subjects.filter((subject) => allowedSubjects.has(subject as never))))
  if (cleanSubjects.length === 0) throw new Error('Choose at least one subject.')

  const allowedStages = new Set(STAGES[level as keyof typeof STAGES])
  const cleanStage = stage && allowedStages.has(stage as never) ? stage : null

  return {
    level,
    board,
    stage: cleanStage,
    subjects: cleanSubjects,
    languagePreference,
    explanationStyle,
  }
}

function toLegacyLanguage(value: string) {
  return value === 'English' ? 'en' : 'bn'
}

export async function POST(req: Request) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = (await req.json()) as Record<string, unknown>
    const setup = validateSetup(body)

    let userProfileSaved = false
    try {
      const supabase = getSupabaseAdmin()
      const { error } = await supabase.from('user_profiles').upsert(
        {
          user_id: user.id,
          level: setup.level,
          board: setup.board,
          stage: setup.stage,
          subjects: setup.subjects,
          language_preference: setup.languagePreference,
          explanation_style: setup.explanationStyle,
          setup_completed: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      if (error) throw error
      userProfileSaved = true

      await supabase.from('student_profiles').upsert(
        {
          id: user.id,
          name:
            String(user.user_metadata?.full_name ?? '').trim() ||
            String(user.email ?? '').trim() ||
            'Student',
          level: setup.level,
          subjects: setup.subjects,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
    } catch (error) {
      if (!isMissingTable(error)) throw error
    }

    const profile = await upsertStudentProfile(user.id, {
      defaultProduct: 'qbank',
      preferredBoard: setup.board,
      preferredLevel: setup.level,
      preferredSubjects: setup.subjects,
      preferredLanguage: toLegacyLanguage(setup.languagePreference),
      nationality: 'Bangladesh',
      wantsDeadlineAlerts: false,
      onboardingCompleted: true,
    })

    return NextResponse.json({
      success: true,
      profile,
      setup,
      userProfileSaved,
      redirectTo: '/solver',
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Could not save setup.' },
      { status: 400 }
    )
  }
}
