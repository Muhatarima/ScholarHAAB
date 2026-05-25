import { getSupabaseAdmin } from '@/lib/server/supabase-admin'
import {
  getPrerequisites,
  getSyllabusTopics,
  normalizeTopic,
} from '@/lib/learning/syllabus'

export type StudentSessionMemory = {
  id: string
  subject: string | null
  topic: string | null
  sessionType: string | null
  questionsAttempted: number
  questionsCorrect: number
  weakPointsIdentified: string[]
  aiNotes: string | null
  startedAt: string | null
  endedAt: string | null
}

export type StudentMemory = {
  name: string
  level: string
  subjects: string[]
  weakTopics: string[]
  strongTopics: string[]
  skippedChapters: string[]
  recentSessions: StudentSessionMemory[]
  lastWeakPoints: string[]
  studyStreak: number
  totalQuestionsAttempted: number
}

export type SessionUpdateInput = {
  subject?: string | null
  topic?: string | null
  sessionType?: string | null
  questionsAttempted?: number
  questionsCorrect?: number
  weakPointsIdentified?: string[]
  aiNotes?: string | null
  skippedChapters?: string[]
}

const EMPTY_MEMORY: StudentMemory = {
  name: 'Student',
  level: 'A Level',
  subjects: [],
  weakTopics: [],
  strongTopics: [],
  skippedChapters: [],
  recentSessions: [],
  lastWeakPoints: [],
  studyStreak: 0,
  totalQuestionsAttempted: 0,
}

function getAdminClientOrNull() {
  try {
    return getSupabaseAdmin()
  } catch {
    return null
  }
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.map((item) => String(item ?? '').trim()).filter(Boolean)
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

function scorePercent(input: SessionUpdateInput) {
  const attempted = Math.max(0, Number(input.questionsAttempted ?? 0))
  const correct = Math.max(0, Number(input.questionsCorrect ?? 0))
  if (attempted === 0) {
    return null
  }

  return Math.round((correct / attempted) * 100)
}

function mapSession(row: Record<string, unknown>): StudentSessionMemory {
  return {
    id: String(row.id ?? ''),
    subject: typeof row.subject === 'string' ? row.subject : null,
    topic: typeof row.topic === 'string' ? row.topic : null,
    sessionType: typeof row.session_type === 'string' ? row.session_type : null,
    questionsAttempted: Number(row.questions_attempted ?? 0),
    questionsCorrect: Number(row.questions_correct ?? 0),
    weakPointsIdentified: asStringArray(row.weak_points_identified),
    aiNotes: typeof row.ai_notes === 'string' ? row.ai_notes : null,
    startedAt: typeof row.started_at === 'string' ? row.started_at : null,
    endedAt: typeof row.ended_at === 'string' ? row.ended_at : null,
  }
}

async function ensureStudentProfile(studentId: string) {
  const supabase = getAdminClientOrNull()
  if (!supabase) {
    return null
  }

  const { data: existing } = await supabase
    .from('student_profiles')
    .select('*')
    .eq('id', studentId)
    .maybeSingle()

  if (existing) {
    return existing as Record<string, unknown>
  }

  const { data: authUser } = await supabase.auth.admin.getUserById(studentId)
  const user = authUser?.user
  const name =
    String(user?.user_metadata?.full_name ?? '').trim() ||
    String(user?.email ?? '').trim() ||
    'Student'

  const { data } = await supabase
    .from('student_profiles')
    .insert({
      id: studentId,
      name,
      subjects: [],
      weak_topics: [],
      strong_topics: [],
      skipped_chapters: [],
    })
    .select('*')
    .maybeSingle()

  return (data as Record<string, unknown> | null) ?? null
}

export async function loadStudentMemory(studentId: string): Promise<StudentMemory> {
  const supabase = getAdminClientOrNull()
  if (!supabase || !studentId) {
    return EMPTY_MEMORY
  }

  try {
    const profile = await ensureStudentProfile(studentId)
    if (!profile) {
      return EMPTY_MEMORY
    }

    const { data: sessions } = await supabase
      .from('study_sessions')
      .select('*')
      .eq('student_id', studentId)
      .order('started_at', { ascending: false })
      .limit(6)

    const recentSessions = (sessions ?? []).map((row) =>
      mapSession(row as Record<string, unknown>)
    )
    const lastWeakPoints = uniqueStrings(
      recentSessions.flatMap((session) => session.weakPointsIdentified)
    ).slice(0, 8)

    return {
      name: String(profile.name ?? 'Student'),
      level: String(profile.level ?? 'A Level'),
      subjects: asStringArray(profile.subjects),
      weakTopics: asStringArray(profile.weak_topics),
      strongTopics: asStringArray(profile.strong_topics),
      skippedChapters: asStringArray(profile.skipped_chapters),
      recentSessions,
      lastWeakPoints,
      studyStreak: Number(profile.study_streak ?? 0),
      totalQuestionsAttempted: Number(profile.total_questions_attempted ?? 0),
    }
  } catch {
    return EMPTY_MEMORY
  }
}

export async function updateMemoryAfterSession(
  studentId: string,
  sessionData: SessionUpdateInput
) {
  const supabase = getAdminClientOrNull()
  if (!supabase || !studentId) {
    return { saved: false }
  }

  try {
    const memory = await loadStudentMemory(studentId)
    const attempted = Math.max(0, Number(sessionData.questionsAttempted ?? 0))
    const correct = Math.max(0, Number(sessionData.questionsCorrect ?? 0))
    const percent = scorePercent(sessionData)
    const topic = sessionData.topic?.trim()
    const weakTopics = [...memory.weakTopics]
    const strongTopics = [...memory.strongTopics]

    if (topic && percent !== null && percent < 60) {
      weakTopics.push(topic)
    }
    if (topic && percent !== null && percent > 85) {
      strongTopics.push(topic)
    }

    await supabase.from('study_sessions').insert({
      student_id: studentId,
      subject: sessionData.subject ?? null,
      topic: sessionData.topic ?? null,
      session_type: sessionData.sessionType ?? 'practice',
      questions_attempted: attempted,
      questions_correct: correct,
      weak_points_identified: sessionData.weakPointsIdentified ?? [],
      ai_notes: sessionData.aiNotes ?? null,
      ended_at: new Date().toISOString(),
    })

    const skippedChapters = uniqueStrings([
      ...memory.skippedChapters,
      ...(sessionData.skippedChapters ?? []),
    ])
    const totalQuestionsAttempted = memory.totalQuestionsAttempted + attempted
    const studyStreak = attempted > 0 ? Math.max(1, memory.studyStreak + 1) : memory.studyStreak

    await supabase
      .from('student_profiles')
      .update({
        weak_topics: uniqueStrings(weakTopics),
        strong_topics: uniqueStrings(strongTopics),
        skipped_chapters: skippedChapters,
        total_questions_attempted: totalQuestionsAttempted,
        study_streak: studyStreak,
        updated_at: new Date().toISOString(),
      })
      .eq('id', studentId)

    return { saved: true, percent }
  } catch {
    return { saved: false }
  }
}

export async function buildMemoryContext(studentId: string) {
  const memory = await loadStudentMemory(studentId)
  const lastSession = memory.recentSessions[0]
  const lastSessionSummary = lastSession
    ? `${lastSession.subject ?? 'General'} - ${lastSession.topic ?? 'mixed topics'} (${lastSession.questionsCorrect}/${lastSession.questionsAttempted})`
    : 'No previous session yet'

  return [
    `Student: ${memory.name}`,
    `Level: ${memory.level}`,
    `Subjects: ${memory.subjects.length ? memory.subjects.join(', ') : 'Not set yet'}`,
    `Weak topics: ${memory.weakTopics.length ? memory.weakTopics.join(', ') : 'None tracked yet'}`,
    `Strong topics: ${memory.strongTopics.length ? memory.strongTopics.join(', ') : 'None tracked yet'}`,
    `Skipped chapters: ${memory.skippedChapters.length ? memory.skippedChapters.join(', ') : 'None detected yet'}`,
    `Last session: ${lastSessionSummary}`,
    `Recent struggles: ${memory.lastWeakPoints.length ? memory.lastWeakPoints.join(', ') : 'None tracked yet'}`,
    `Study streak: ${memory.studyStreak} days`,
  ].join('\n')
}

export async function detectSkippedChapters(studentId: string, subject: string) {
  const supabase = getAdminClientOrNull()
  const syllabusTopics = getSyllabusTopics(subject)
  if (!supabase || syllabusTopics.length === 0) {
    return []
  }

  try {
    const { data } = await supabase
      .from('question_attempts')
      .select('topic')
      .eq('student_id', studentId)
      .ilike('subject', `%${subject}%`)

    const attempted = new Set(
      (data ?? [])
        .map((row) => normalizeTopic((row as { topic?: string | null }).topic))
        .filter(Boolean)
    )

    return syllabusTopics.filter((topic) => !attempted.has(normalizeTopic(topic)))
  } catch {
    return []
  }
}

export function getPrerequisiteGap(topic: string, memory: StudentMemory) {
  const attemptedTopics = new Set(
    [...memory.weakTopics, ...memory.strongTopics]
      .map((value) => normalizeTopic(value))
      .filter(Boolean)
  )

  return getPrerequisites(topic).find(
    (prerequisite) => !attemptedTopics.has(normalizeTopic(prerequisite))
  ) ?? null
}
