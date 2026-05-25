import { buildTenYearDashboardAnalysis } from '@/lib/analysis/qbankAnalyzer'
import { updateScore } from '@/lib/analytics/leaderboard'
import { getSyllabusTopics, normalizeTopic } from '@/lib/learning/syllabus'
import { loadStudentMemory, updateMemoryAfterSession } from '@/lib/memory/studentMemory'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'

export type AttemptData = {
  questionId: string
  subject: string
  topic: string
  subtopic?: string | null
  difficulty?: string | null
  isCorrect: boolean
  marksObtained: number
  marksAvailable: number
  timeSeconds: number
  attemptNumber?: number
  mistakeType?: string | null
  studentAnswer?: string | null
  correctAnswer?: string | null
  aiFeedback?: string | null
  confidenceLevel?: string | null
  paperType?: string | null
}

export type TrackAttemptInput = AttemptData & {
  studentId: string
}

export type AccuracyReport = {
  overall: number
  bySubject: Record<string, number>
  byTopic: Record<string, number>
  byDifficulty: Record<string, number>
  byPaperType: Record<string, number>
  trend: 'improving' | 'declining' | 'stable'
  last30Days: Array<{ date: string; accuracy: number; attempts: number }>
}

export type AccuracySummary = AccuracyReport

export type WeakPoint = {
  topic: string
  subject: string
  accuracy: number
  attempts: number
  mistakePattern: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM'
  recommendedAction: string
  recommended_action: string
  examProbability?: number
  examFlag?: string
}

export type LearningPoint = {
  week: string
  accuracy: number
  trend: 'improving' | 'plateau' | 'declining' | 'stable'
  attempts: number
}

export type DailyPlanItem = {
  topic: string
  subject: string
  duration_minutes: number
  type: 'drill' | 'revision' | 'mock'
  reason: string
  priority: 'high' | 'medium' | 'low'
}

export type DashboardData = {
  profile: Awaited<ReturnType<typeof loadStudentMemory>>
  todayProgress: {
    questionsDone: number
    correctCount: number
    accuracyPercentage: number
    dailyGoal: number
  }
  weeklyActivity: Array<{ date: string; count: number; accuracy: number }>
  accuracyTrend: Array<{ date: string; accuracy: number; attempts: number }>
  weakPoints: WeakPoint[]
  subjectPerformance: Array<{
    subject: string
    mastery: number
    strongCount: number
    weakCount: number
    lastStudied: string | null
  }>
  recentSessions: Array<{
    id: string
    subject: string | null
    topic: string | null
    questionsAttempted: number
    questionsCorrect: number
    aiNotes: string | null
    startedAt?: string | null
  }>
  examCountdowns: Array<{ subject: string; paper: string; date: string; days: number }>
  dailyPlan: DailyPlanItem[]
  accuracy: AccuracyReport
  syllabus: Array<{
    topic: string
    mastery: number
    status: 'mastered' | 'learning' | 'weak' | 'not_attempted'
  }>
  analysis: Awaited<ReturnType<typeof buildTenYearDashboardAnalysis>>
}

type AttemptRow = {
  question_id?: string | null
  subject?: string | null
  topic?: string | null
  subtopic?: string | null
  difficulty?: string | null
  is_correct?: boolean | null
  marks_obtained?: number | null
  marks_available?: number | null
  time_taken_seconds?: number | null
  attempt_number?: number | null
  mistake_type?: string | null
  confidence_level?: string | null
  attempted_at?: string | null
}

type TopicMasteryRow = {
  subject?: string | null
  topic?: string | null
  subtopic?: string | null
  total_attempts?: number | null
  correct_attempts?: number | null
  accuracy_percentage?: number | null
  mastery_level?: string | null
  mistake_patterns?: unknown
  last_attempted?: string | null
  trend?: string | null
}

type StudentProfileRow = {
  study_streak?: number | null
  longest_streak?: number | null
  last_study_date?: string | null
  total_questions_attempted?: number | null
  total_correct?: number | null
  weak_topics?: unknown
  strong_topics?: unknown
  daily_goal?: number | null
  exam_dates?: unknown
}

type DailyProgressRow = {
  questions_done?: number | null
  correct_count?: number | null
  accuracy_percentage?: number | null
  time_studied_minutes?: number | null
  topics_covered?: unknown
}

function getAdminClientOrNull() {
  try {
    return getSupabaseAdmin()
  } catch {
    return null
  }
}

function percent(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function daysBetween(fromDate: string, toDate: string) {
  const from = new Date(`${fromDate}T00:00:00.000Z`).getTime()
  const to = new Date(`${toDate}T00:00:00.000Z`).getTime()
  return Math.round((to - from) / (24 * 60 * 60 * 1000))
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function masteryLevel(accuracy: number) {
  if (accuracy >= 80) {
    return 'mastered'
  }
  if (accuracy >= 50) {
    return 'learning'
  }
  if (accuracy > 0) {
    return 'weak'
  }
  return 'not_started'
}

function weakSeverity(accuracy: number, attempts: number, trend: string | null | undefined): WeakPoint['severity'] {
  if (accuracy < 40 || (attempts >= 3 && accuracy < 50)) {
    return 'CRITICAL'
  }
  if (accuracy < 60 || (attempts >= 3 && accuracy < 70) || trend === 'declining') {
    return 'HIGH'
  }
  return 'MEDIUM'
}

function groupAccuracy(rows: AttemptRow[], key: keyof AttemptRow) {
  const grouped: Record<string, { correct: number; total: number }> = {}
  for (const row of rows) {
    const label = String(row[key] ?? 'Unknown').trim() || 'Unknown'
    grouped[label] ??= { correct: 0, total: 0 }
    grouped[label].total += 1
    if (row.is_correct) {
      grouped[label].correct += 1
    }
  }

  return Object.fromEntries(
    Object.entries(grouped).map(([label, data]) => [label, percent(data.correct, data.total)])
  )
}

function trendFromRows(rows: AttemptRow[]) {
  if (rows.length < 4) {
    return 'stable' as const
  }

  const midpoint = Math.floor(rows.length / 2)
  const first = rows.slice(0, midpoint)
  const second = rows.slice(midpoint)
  const firstScore = percent(first.filter((row) => row.is_correct).length, first.length)
  const secondScore = percent(second.filter((row) => row.is_correct).length, second.length)

  if (secondScore > firstScore + 8) {
    return 'improving' as const
  }
  if (secondScore < firstScore - 8) {
    return 'declining' as const
  }
  return 'stable' as const
}

function dailyAccuracy(rows: AttemptRow[], days = 30) {
  const dayMap = new Map<string, { correct: number; total: number }>()
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(Date.now() - index * 24 * 60 * 60 * 1000)
    dayMap.set(dateKey(date), { correct: 0, total: 0 })
  }

  for (const row of rows) {
    const date = row.attempted_at ? new Date(row.attempted_at) : null
    if (!date || Number.isNaN(date.getTime())) {
      continue
    }
    const key = dateKey(date)
    const current = dayMap.get(key)
    if (!current) {
      continue
    }
    current.total += 1
    if (row.is_correct) {
      current.correct += 1
    }
  }

  return Array.from(dayMap.entries()).map(([date, data]) => ({
    date,
    accuracy: data.total ? percent(data.correct, data.total) : 0,
    attempts: data.total,
  }))
}

async function getAttempts(
  studentId: string,
  filters: { subject?: string | null; topic?: string | null; days?: number | null } = {}
) {
  const supabase = getAdminClientOrNull()
  if (!supabase || !studentId) {
    return [] as AttemptRow[]
  }

  try {
    let query = supabase
      .from('question_attempts')
      .select(
        'question_id, subject, topic, subtopic, difficulty, is_correct, marks_obtained, marks_available, time_taken_seconds, attempt_number, mistake_type, confidence_level, attempted_at'
      )
      .eq('student_id', studentId)
      .order('attempted_at', { ascending: true })

    if (filters.subject) {
      query = query.ilike('subject', `%${filters.subject}%`)
    }
    if (filters.topic) {
      query = query.ilike('topic', `%${filters.topic}%`)
    }
    if (filters.days) {
      query = query.gte(
        'attempted_at',
        new Date(Date.now() - filters.days * 24 * 60 * 60 * 1000).toISOString()
      )
    }

    const { data, error } = await query
    if (error) {
      throw error
    }
    return (data ?? []) as AttemptRow[]
  } catch {
    return []
  }
}

async function getTopicMasteryRows(studentId: string) {
  const supabase = getAdminClientOrNull()
  if (!supabase || !studentId) {
    return [] as TopicMasteryRow[]
  }

  try {
    const { data, error } = await supabase
      .from('topic_mastery')
      .select(
        'subject, topic, subtopic, total_attempts, correct_attempts, accuracy_percentage, mastery_level, mistake_patterns, last_attempted, trend'
      )
      .eq('student_id', studentId)

    if (error) {
      throw error
    }
    return (data ?? []) as TopicMasteryRow[]
  } catch {
    return []
  }
}

function buildMistakePattern(mistakeType?: string | null) {
  if (mistakeType === 'calculation') {
    return 'Repeated calculation slips'
  }
  if (mistakeType === 'formula') {
    return 'Forgetting or choosing the wrong formula'
  }
  if (mistakeType === 'reading') {
    return 'Misreading command words or data'
  }
  if (mistakeType === 'concept') {
    return 'Concept gap detected'
  }
  return 'Needs more attempt data'
}

async function updateTopicMastery(data: TrackAttemptInput) {
  const supabase = getAdminClientOrNull()
  if (!supabase) {
    return
  }

  const { data: current } = await supabase
    .from('topic_mastery')
    .select('total_attempts, correct_attempts, mistake_patterns, trend')
    .eq('student_id', data.studentId)
    .eq('subject', data.subject)
    .eq('topic', data.topic)
    .maybeSingle()

  const currentRow = (current ?? {}) as TopicMasteryRow
  const totalAttempts = Number(currentRow.total_attempts ?? 0) + 1
  const correctAttempts = Number(currentRow.correct_attempts ?? 0) + (data.isCorrect ? 1 : 0)
  const accuracy = percent(correctAttempts, totalAttempts)
  const recentRows = await getAttempts(data.studentId, {
    subject: data.subject,
    topic: data.topic,
    days: 30,
  })
  const trend = trendFromRows([...recentRows, { is_correct: data.isCorrect, attempted_at: new Date().toISOString() }])
  const mistakePatterns = asStringArray(currentRow.mistake_patterns)
  const nextMistakePatterns =
    data.isCorrect || !data.mistakeType
      ? mistakePatterns
      : Array.from(new Set([...mistakePatterns, data.mistakeType]))

  await supabase.from('topic_mastery').upsert(
    {
      student_id: data.studentId,
      subject: data.subject,
      topic: data.topic,
      subtopic: data.subtopic ?? null,
      total_attempts: totalAttempts,
      correct_attempts: correctAttempts,
      accuracy_percentage: accuracy,
      mastery_level: masteryLevel(accuracy),
      mistake_patterns: nextMistakePatterns,
      last_attempted: new Date().toISOString(),
      trend,
    },
    { onConflict: 'student_id,subject,topic' }
  )
}

async function updateStudentTotals(data: TrackAttemptInput) {
  const supabase = getAdminClientOrNull()
  if (!supabase) {
    return
  }

  const { data: profile } = await supabase
    .from('student_profiles')
    .select('total_questions_attempted, total_correct, weak_topics, strong_topics')
    .eq('id', data.studentId)
    .maybeSingle()
  const current = (profile ?? {}) as StudentProfileRow
  const total = Number(current.total_questions_attempted ?? 0) + 1
  const correct = Number(current.total_correct ?? 0) + (data.isCorrect ? 1 : 0)
  const weakTopics = new Set(asStringArray(current.weak_topics))
  const strongTopics = new Set(asStringArray(current.strong_topics))

  if (!data.isCorrect) {
    weakTopics.add(data.topic)
    strongTopics.delete(data.topic)
  } else if (total > 0) {
    const rows = await getAttempts(data.studentId, { subject: data.subject, topic: data.topic })
    const accuracy = percent(rows.filter((row) => row.is_correct).length + 1, rows.length + 1)
    if (accuracy >= 85) {
      strongTopics.add(data.topic)
      weakTopics.delete(data.topic)
    }
  }

  await supabase
    .from('student_profiles')
    .update({
      total_questions_attempted: total,
      total_correct: correct,
      weak_topics: Array.from(weakTopics),
      strong_topics: Array.from(strongTopics),
      updated_at: new Date().toISOString(),
    })
    .eq('id', data.studentId)
}

async function updateDailyProgress(data: TrackAttemptInput) {
  const supabase = getAdminClientOrNull()
  if (!supabase) {
    return
  }

  const today = todayKey()
  const { data: existing } = await supabase
    .from('daily_progress')
    .select('questions_done, correct_count, time_studied_minutes, topics_covered')
    .eq('student_id', data.studentId)
    .eq('date', today)
    .eq('subject', data.subject)
    .maybeSingle()

  const current = (existing ?? {}) as DailyProgressRow
  const questionsDone = Number(current.questions_done ?? 0) + 1
  const correctCount = Number(current.correct_count ?? 0) + (data.isCorrect ? 1 : 0)
  const topicsCovered = new Set(asStringArray(current.topics_covered))
  topicsCovered.add(data.topic)

  await supabase.from('daily_progress').upsert(
    {
      student_id: data.studentId,
      date: today,
      subject: data.subject,
      questions_done: questionsDone,
      correct_count: correctCount,
      accuracy_percentage: percent(correctCount, questionsDone),
      time_studied_minutes:
        Number(current.time_studied_minutes ?? 0) + Math.max(1, Math.round(data.timeSeconds / 60)),
      topics_covered: Array.from(topicsCovered),
      goal_met: questionsDone >= 20,
    },
    { onConflict: 'student_id,date,subject' }
  )
}

export async function updateStreak(studentId: string): Promise<{ streak: number; maintained: boolean }> {
  const supabase = getAdminClientOrNull()
  if (!supabase || !studentId) {
    return { streak: 0, maintained: false }
  }

  const today = todayKey()
  const { data } = await supabase
    .from('student_profiles')
    .select('study_streak, longest_streak, last_study_date')
    .eq('id', studentId)
    .maybeSingle()
  const profile = (data ?? {}) as StudentProfileRow
  const lastStudyDate = profile.last_study_date
  let streak = Number(profile.study_streak ?? 0)
  let maintained = true

  if (lastStudyDate === today) {
    maintained = true
  } else if (lastStudyDate && daysBetween(lastStudyDate, today) === 1) {
    streak += 1
  } else {
    streak = 1
    maintained = false
  }

  const longest = Math.max(Number(profile.longest_streak ?? 0), streak)
  await supabase
    .from('student_profiles')
    .update({
      study_streak: streak,
      longest_streak: longest,
      last_study_date: today,
      updated_at: new Date().toISOString(),
    })
    .eq('id', studentId)

  await supabase
    .from('daily_progress')
    .update({ streak_maintained: maintained })
    .eq('student_id', studentId)
    .eq('date', today)

  return { streak, maintained }
}

export async function trackAttempt(data: TrackAttemptInput): Promise<void> {
  const supabase = getAdminClientOrNull()
  if (!supabase || !data.studentId) {
    return
  }

  const { data: previousAttempts } = await supabase
    .from('question_attempts')
    .select('id')
    .eq('student_id', data.studentId)
    .eq('question_id', data.questionId)

  await supabase.from('question_attempts').insert({
    student_id: data.studentId,
    question_id: data.questionId,
    subject: data.subject,
    topic: data.topic,
    subtopic: data.subtopic ?? null,
    difficulty: data.difficulty ?? 'medium',
    student_answer: data.studentAnswer ?? null,
    correct_answer: data.correctAnswer ?? null,
    is_correct: data.isCorrect,
    marks_obtained: data.marksObtained,
    marks_available: Math.max(1, data.marksAvailable),
    time_taken_seconds: Math.max(0, Math.round(data.timeSeconds)),
    attempt_number: data.attemptNumber ?? (previousAttempts?.length ?? 0) + 1,
    mistake_type: data.mistakeType ?? null,
    ai_feedback: data.aiFeedback ?? null,
    confidence_level:
      data.confidenceLevel === 'VERIFIED' ||
      data.confidenceLevel === 'PARTIAL' ||
      data.confidenceLevel === 'UNVERIFIED'
        ? data.confidenceLevel
        : null,
  })

  await Promise.all([
    updateTopicMastery(data),
    updateStudentTotals(data),
    updateDailyProgress(data),
    updateStreak(data.studentId),
    data.isCorrect
      ? updateScore({
          userId: data.studentId,
          points: 10,
          reason: 'correct_answer',
        })
      : Promise.resolve(null),
    updateMemoryAfterSession(data.studentId, {
      subject: data.subject,
      topic: data.topic,
      sessionType: 'practice',
      questionsAttempted: 1,
      questionsCorrect: data.isCorrect ? 1 : 0,
      weakPointsIdentified: data.isCorrect
        ? []
        : ([data.subtopic, data.topic, data.mistakeType].filter(Boolean) as string[]),
      aiNotes: data.aiFeedback ?? `Attempt tracked for ${data.topic}.`,
    }),
  ])
}

export async function trackEveryAttempt(studentId: string, attemptData: AttemptData) {
  await trackAttempt({ ...attemptData, studentId })
  return { saved: true }
}

export async function calculateAccuracy(
  studentId: string,
  filters: { subject?: string | null; topic?: string | null; days?: number | null } = {}
): Promise<AccuracyReport> {
  const rows = await getAttempts(studentId, filters)
  const correct = rows.filter((row) => row.is_correct).length
  const last30 = rows.filter((row) => {
    const time = row.attempted_at ? new Date(row.attempted_at).getTime() : 0
    return time >= Date.now() - 30 * 24 * 60 * 60 * 1000
  })
  const last7 = rows.filter((row) => {
    const time = row.attempted_at ? new Date(row.attempted_at).getTime() : 0
    return time >= Date.now() - 7 * 24 * 60 * 60 * 1000
  })
  const previous7 = rows.filter((row) => {
    const time = row.attempted_at ? new Date(row.attempted_at).getTime() : 0
    return (
      time >= Date.now() - 14 * 24 * 60 * 60 * 1000 &&
      time < Date.now() - 7 * 24 * 60 * 60 * 1000
    )
  })
  const recentScore = percent(last7.filter((row) => row.is_correct).length, last7.length)
  const previousScore = percent(previous7.filter((row) => row.is_correct).length, previous7.length)
  const trend =
    last7.length === 0 || previous7.length === 0
      ? trendFromRows(last30.length ? last30 : rows)
      : recentScore > previousScore + 8
        ? 'improving'
        : recentScore < previousScore - 8
          ? 'declining'
          : 'stable'

  return {
    overall: percent(correct, rows.length),
    bySubject: groupAccuracy(rows, 'subject'),
    byTopic: groupAccuracy(rows, 'topic'),
    byDifficulty: groupAccuracy(rows, 'difficulty'),
    byPaperType: {},
    trend,
    last30Days: dailyAccuracy(last30),
  }
}

export async function detectMistakePatterns(studentId: string, topic: string) {
  const rows = (await getAttempts(studentId, { topic })).filter((row) => !row.is_correct)
  if (rows.length === 0) {
    return {
      topic,
      pattern: 'No repeated mistake pattern detected yet.',
      mistakeType: 'none',
      tip: 'Keep logging answers so ScholarHAAB can detect patterns accurately.',
    }
  }

  const mistakeCounts: Record<string, number> = {}
  for (const row of rows) {
    const key = row.mistake_type ?? 'concept'
    mistakeCounts[key] = (mistakeCounts[key] ?? 0) + 1
  }
  const [mistakeType, count] = Object.entries(mistakeCounts).sort((left, right) => right[1] - left[1])[0]
  const avgWrongTime = average(rows.map((row) => Number(row.time_taken_seconds ?? 0)).filter(Boolean))
  const correctRows = (await getAttempts(studentId, { topic })).filter((row) => row.is_correct)
  const avgCorrectTime = average(correctRows.map((row) => Number(row.time_taken_seconds ?? 0)).filter(Boolean))
  const timePressure = avgCorrectTime > 0 && avgWrongTime > 0 && avgWrongTime < avgCorrectTime * 0.65

  return {
    topic,
    pattern: `${mistakeType} mistake repeated ${count} time${count === 1 ? '' : 's'}.`,
    mistakeType,
    timePressure,
    tip: timePressure
      ? `You are likely rushing ${topic}. Slow down and write the formula or keyword before calculating.`
      : `For ${topic}, drill the ${mistakeType} step until it becomes automatic.`,
  }
}

function weakPointsFromAttempts(rows: AttemptRow[]) {
  const topicMap = new Map<string, AttemptRow[]>()
  for (const row of rows) {
    const topic = row.topic ?? 'Unknown'
    topicMap.set(topic, [...(topicMap.get(topic) ?? []), row])
  }

  const weakPoints: WeakPoint[] = []
  for (const [topic, attempts] of topicMap.entries()) {
    const correct = attempts.filter((row) => row.is_correct).length
    const accuracy = percent(correct, attempts.length)
    const wrongRows = attempts.filter((row) => !row.is_correct)
    const mistakeCounts: Record<string, number> = {}
    for (const row of wrongRows) {
      const key = row.mistake_type ?? 'concept'
      mistakeCounts[key] = (mistakeCounts[key] ?? 0) + 1
    }
    const repeatedMistake = Object.values(mistakeCounts).some((count) => count >= 3)
    const avgTime = average(attempts.map((row) => Number(row.time_taken_seconds ?? 0)).filter(Boolean))
    const slow = avgTime > 240
    const recent = attempts.slice(-5)
    const recentAccuracy = percent(recent.filter((row) => row.is_correct).length, recent.length)
    const earlier = attempts.slice(0, Math.max(0, attempts.length - 5))
    const earlierAccuracy = percent(earlier.filter((row) => row.is_correct).length, earlier.length)
    const declining = attempts.length >= 6 && recentAccuracy < earlierAccuracy - 10

    if (accuracy < 60 || repeatedMistake || slow || declining || (attempts.length >= 3 && accuracy < 70)) {
      const topMistake =
        Object.entries(mistakeCounts).sort((left, right) => right[1] - left[1])[0]?.[0] ?? 'concept'
      const severity = weakSeverity(accuracy, attempts.length, declining ? 'declining' : 'stable')
      const recommendedAction =
        severity === 'CRITICAL'
          ? 'Restart from basics'
          : severity === 'HIGH'
            ? 'Practice focused drill set'
            : 'Do timed mixed practice'
      weakPoints.push({
        topic,
        subject: attempts[0]?.subject ?? 'General',
        accuracy,
        attempts: attempts.length,
        mistakePattern: buildMistakePattern(topMistake),
        severity,
        recommendedAction,
        recommended_action: recommendedAction,
      })
    }
  }
  return weakPoints
}

export async function detectWeakPoints(studentId: string): Promise<WeakPoint[]> {
  const masteryRows = await getTopicMasteryRows(studentId)
  const fromMastery = masteryRows
    .filter((row) => {
      const accuracy = Number(row.accuracy_percentage ?? 0)
      const attempts = Number(row.total_attempts ?? 0)
      return accuracy < 60 || (attempts >= 3 && accuracy < 70) || row.trend === 'declining'
    })
    .map((row): WeakPoint => {
      const accuracy = Number(row.accuracy_percentage ?? 0)
      const attempts = Number(row.total_attempts ?? 0)
      const severity = weakSeverity(accuracy, attempts, row.trend)
      const patterns = asStringArray(row.mistake_patterns)
      const recommendedAction =
        severity === 'CRITICAL'
          ? 'Restart from basics'
          : severity === 'HIGH'
            ? 'Practice focused drill set'
            : 'Do timed mixed practice'
      return {
        topic: row.topic ?? 'Unknown',
        subject: row.subject ?? 'General',
        accuracy,
        attempts,
        mistakePattern: buildMistakePattern(patterns[0] ?? 'concept'),
        severity,
        recommendedAction,
        recommended_action: recommendedAction,
      }
    })

  const attemptRows = await getAttempts(studentId)
  const fromAttempts = weakPointsFromAttempts(attemptRows)
  const merged = new Map<string, WeakPoint>()
  for (const point of [...fromAttempts, ...fromMastery]) {
    const key = `${normalizeTopic(point.subject)}:${normalizeTopic(point.topic)}`
    const existing = merged.get(key)
    if (!existing || point.severity === 'CRITICAL' || point.accuracy < existing.accuracy) {
      merged.set(key, point)
    }
  }

  const memory = await loadStudentMemory(studentId)
  for (const topic of memory.weakTopics) {
    const key = `memory:${normalizeTopic(topic)}`
    if (!Array.from(merged.values()).some((point) => normalizeTopic(point.topic) === normalizeTopic(topic))) {
      merged.set(key, {
        topic,
        subject: memory.subjects[0] ?? 'General',
        accuracy: 0,
        attempts: 0,
        mistakePattern: 'Flagged by tutor memory',
        severity: 'MEDIUM',
        recommendedAction: 'Do a diagnostic drill',
        recommended_action: 'Do a diagnostic drill',
      })
    }
  }

  return Array.from(merged.values()).sort((left, right) => {
    const severityScore = { CRITICAL: 3, HIGH: 2, MEDIUM: 1 }
    return severityScore[right.severity] - severityScore[left.severity] || left.accuracy - right.accuracy
  })
}

export async function buildLearningCurve(
  studentId: string,
  subject: string,
  topic: string
): Promise<LearningPoint[]> {
  const rows = await getAttempts(studentId, { subject, topic })
  const weekMap = new Map<string, AttemptRow[]>()
  for (const row of rows) {
    const date = row.attempted_at ? new Date(row.attempted_at) : null
    if (!date || Number.isNaN(date.getTime())) {
      continue
    }
    const weekStart = new Date(date)
    weekStart.setDate(date.getDate() - date.getDay())
    const key = dateKey(weekStart)
    weekMap.set(key, [...(weekMap.get(key) ?? []), row])
  }

  const curve = Array.from(weekMap.entries()).map(([week, attempts], index, all) => {
    const accuracy = percent(attempts.filter((row) => row.is_correct).length, attempts.length)
    const previous = index > 0 ? all[index - 1][1] : []
    const previousAccuracy = previous.length
      ? percent(previous.filter((row) => row.is_correct).length, previous.length)
      : accuracy
    const delta = accuracy - previousAccuracy
    const trend = delta > 8 ? 'improving' : delta < -8 ? 'declining' : Math.abs(delta) <= 4 ? 'plateau' : 'stable'
    return { week, accuracy, trend: trend as LearningPoint['trend'], attempts: attempts.length }
  })

  return curve
}

function parseExamDates(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [] as Array<{ subject: string; paper: string; date: string; days: number }>
  }

  return Object.entries(value as Record<string, unknown>)
    .map(([label, rawDate]) => {
      const date = typeof rawDate === 'string' ? rawDate : ''
      const [subject, paper = 'Exam'] = label.split(':')
      return {
        subject,
        paper,
        date,
        days: date ? Math.ceil((new Date(date).getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : 999,
      }
    })
    .filter((item) => item.date)
    .sort((left, right) => left.days - right.days)
}

export async function generateDailyPlan(studentId: string): Promise<DailyPlanItem[]> {
  const [memory, weakPoints] = await Promise.all([loadStudentMemory(studentId), detectWeakPoints(studentId)])
  const plan: DailyPlanItem[] = []
  const examDates = parseExamDates((memory as unknown as { examDates?: unknown }).examDates)
  const nearestExam = examDates[0]

  for (const point of weakPoints.slice(0, 2)) {
    plan.push({
      topic: point.topic,
      subject: point.subject,
      duration_minutes: point.severity === 'CRITICAL' ? 20 : 15,
      type: 'drill',
      reason: `${point.severity} weak point at ${point.accuracy}% accuracy`,
      priority: point.severity === 'CRITICAL' ? 'high' : 'medium',
    })
  }

  if (nearestExam && nearestExam.days < 7) {
    plan.push({
      topic: `${nearestExam.paper} high-frequency topics`,
      subject: nearestExam.subject,
      duration_minutes: 25,
      type: 'revision',
      reason: `Exam in ${nearestExam.days} day${nearestExam.days === 1 ? '' : 's'}`,
      priority: 'high',
    })
  }

  const lastSession = memory.recentSessions[0]
  if (lastSession?.topic) {
    plan.push({
      topic: lastSession.topic,
      subject: lastSession.subject ?? memory.subjects[0] ?? 'General',
      duration_minutes: 10,
      type: 'revision',
      reason: 'Continue where you left off yesterday',
      priority: 'medium',
    })
  }

  if (plan.length < 3) {
    plan.push({
      topic: 'Mixed Paper 2 timing',
      subject: memory.subjects[0] ?? 'Physics',
      duration_minutes: 30,
      type: 'mock',
      reason: 'Build exam timing and confidence',
      priority: 'low',
    })
  }

  return plan.slice(0, 4)
}

export async function getDashboardData(studentId: string): Promise<DashboardData> {
  const [memory, accuracy, weakPoints, dailyPlan, masteryRows] = await Promise.all([
    loadStudentMemory(studentId),
    calculateAccuracy(studentId),
    detectWeakPoints(studentId),
    generateDailyPlan(studentId),
    getTopicMasteryRows(studentId),
  ])
  const subjects = memory.subjects.length ? memory.subjects : ['Physics', 'Mathematics', 'Chemistry']
  const subject = subjects[0] ?? 'Physics'
  const analysis = await buildTenYearDashboardAnalysis({
    studentId,
    subject,
    level: memory.level,
    paper: 'Paper 2',
  })
  const predictionMap = new Map(analysis.predictions.map((item) => [normalizeTopic(item.topic), item]))
  const enrichedWeakPoints = weakPoints.map((point) => {
    const prediction = predictionMap.get(normalizeTopic(point.topic))
    return {
      ...point,
      examProbability: prediction?.probability,
      examFlag:
        prediction?.studentFlag ??
        (prediction?.probability && prediction.probability >= 75 ? 'HIGH EXAM CHANCE' : undefined),
    }
  })
  const syllabus = getSyllabusTopics(subject).map((topic) => {
    const mastery = accuracy.byTopic[topic] ?? 0
    return {
      topic,
      mastery,
      status:
        mastery >= 80
          ? 'mastered'
          : mastery >= 50
            ? 'learning'
            : mastery > 0
              ? 'weak'
              : 'not_attempted',
    } as DashboardData['syllabus'][number]
  })
  const today = dailyAccuracy(await getAttempts(studentId, { days: 1 }), 1)[0]
  const subjectPerformance = subjects.map((subjectName) => {
    const matchingMastery = masteryRows.filter(
      (row) => normalizeTopic(row.subject) === normalizeTopic(subjectName)
    )
    const mastery = matchingMastery.length
      ? Math.round(
          average(matchingMastery.map((row) => Number(row.accuracy_percentage ?? 0)))
        )
      : accuracy.bySubject[subjectName] ?? accuracy.overall
    return {
      subject: subjectName,
      mastery,
      strongCount: memory.strongTopics.filter((topic) => normalizeTopic(topic).includes(normalizeTopic(subjectName))).length,
      weakCount: enrichedWeakPoints.filter((point) => normalizeTopic(point.subject) === normalizeTopic(subjectName)).length,
      lastStudied: memory.recentSessions.find((session) => session.subject === subjectName)?.startedAt ?? null,
    }
  })

  return {
    profile: memory,
    todayProgress: {
      questionsDone: today?.attempts ?? 0,
      correctCount: Math.round(((today?.accuracy ?? 0) / 100) * (today?.attempts ?? 0)),
      accuracyPercentage: today?.accuracy ?? 0,
      dailyGoal: 20,
    },
    weeklyActivity: dailyAccuracy(await getAttempts(studentId, { days: 7 }), 7).map((day) => ({
      date: day.date,
      count: day.attempts,
      accuracy: day.accuracy,
    })),
    accuracyTrend: accuracy.last30Days,
    weakPoints: enrichedWeakPoints,
    subjectPerformance,
    recentSessions: memory.recentSessions,
    examCountdowns: parseExamDates((memory as unknown as { examDates?: unknown }).examDates),
    dailyPlan,
    accuracy,
    syllabus,
    analysis,
  }
}

export async function buildDashboardProgress(studentId: string, preferredSubject = 'Physics') {
  const dashboard = await getDashboardData(studentId)
  const subject = dashboard.profile.subjects[0] ?? preferredSubject
  const fallbackAnalysis =
    dashboard.analysis ??
    (await buildTenYearDashboardAnalysis({
      studentId,
      subject,
      level: dashboard.profile.level,
      paper: 'Paper 2',
    }))

  return {
    memory: dashboard.profile,
    accuracy: dashboard.accuracy,
    weakPoints: dashboard.weakPoints,
    analysis: fallbackAnalysis,
    syllabus: dashboard.syllabus,
    dailyPlan: dashboard.dailyPlan.map(
      (item) =>
        `${item.topic} - ${item.duration_minutes} min ${item.type} (${item.priority.toUpperCase()}: ${item.reason})`
    ),
  }
}
