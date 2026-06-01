import { updateScore } from '@/lib/analytics/leaderboard'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'

export type TopicStatus = 'unseen' | 'weak' | 'skipped' | 'reviewed' | 'confident'
export type InteractionType = 'skip' | 'example_request' | 'confused' | 'formula_request' | 'understood'

export type SessionStats = {
  topicsCovered?: number
  topicsSkipped?: number
  topicsWeak?: number
}

export type TopicPerformance = {
  id: string
  user_id: string | null
  subject: string
  topic: string
  level: string | null
  status: TopicStatus
  times_skipped: number
  times_reviewed: number
  times_asked_differently: number
  last_interaction: string
  confidence_score: number
  created_at: string
  updated_at: string
}

export type ExamPrepSession = {
  id: string
  user_id: string | null
  subject: string
  topic: string
  level: string | null
  started_at: string
  ended_at: string | null
  topics_covered: number
  topics_skipped: number
  topics_weak: number
  session_duration_minutes: number
}

export type StudentPerformanceProfile = {
  topics: TopicPerformance[]
  sessions: ExamPrepSession[]
  bySubject: Array<{
    subject: string
    total: number
    weak: number
    skipped: number
    confident: number
    reviewed: number
    unseen: number
    averageConfidence: number
  }>
  totals: {
    subjects: number
    confident: number
    weak: number
    skipped: number
    reviewed: number
    unseen: number
    studyStreak: number
  }
  trend: Array<{ date: string; questionsAsked: number; topicsCovered: number }>
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function normalizeUserId(userId: string | null | undefined) {
  return userId && UUID_RE.test(userId) ? userId : null
}

function isUuid(value: string | null | undefined) {
  return Boolean(value && UUID_RE.test(value))
}

function nowIso() {
  return new Date().toISOString()
}

function normalizeTopic(topic: string) {
  return topic.trim() || 'General'
}

function isOptionalAnalyticsTableMissing(error: unknown) {
  const code = (error as { code?: string })?.code
  const message = String((error as { message?: string })?.message ?? '')
  return code === '42P01' || code === 'PGRST205' || /topic_interactions/i.test(message)
}

async function getExistingPerformance(userId: string | null, subject: string, topic: string) {
  const supabase = getSupabaseAdmin()
  let query = supabase.from('student_topic_performance').select('*').eq('subject', subject).eq('topic', topic).limit(1)
  query = userId ? query.eq('user_id', userId) : query.is('user_id', null)
  const { data, error } = await query.maybeSingle()
  if (error) throw error
  return data as TopicPerformance | null
}

async function upsertPerformance(
  userIdRaw: string,
  subject: string,
  topicRaw: string,
  patch: Partial<Pick<TopicPerformance, 'status' | 'times_skipped' | 'times_reviewed' | 'times_asked_differently' | 'confidence_score' | 'level'>>
) {
  const supabase = getSupabaseAdmin()
  const userId = normalizeUserId(userIdRaw)
  const topic = normalizeTopic(topicRaw)
  const existing = await getExistingPerformance(userId, subject, topic)
  const payload = {
    user_id: userId,
    subject,
    topic,
    level: patch.level ?? existing?.level ?? null,
    status: patch.status ?? existing?.status ?? 'reviewed',
    times_skipped: patch.times_skipped ?? existing?.times_skipped ?? 0,
    times_reviewed: patch.times_reviewed ?? existing?.times_reviewed ?? 0,
    times_asked_differently: patch.times_asked_differently ?? existing?.times_asked_differently ?? 0,
    confidence_score: patch.confidence_score ?? existing?.confidence_score ?? 0,
    last_interaction: nowIso(),
    updated_at: nowIso(),
  }

  if (existing?.id) {
    const { error } = await supabase.from('student_topic_performance').update(payload).eq('id', existing.id)
    if (error) throw error
    return existing.id
  }

  const { data, error } = await supabase.from('student_topic_performance').insert(payload).select('id').single()
  if (error) throw error
  return (data as { id: string }).id
}

async function logInteraction(
  userIdRaw: string,
  subject: string,
  topic: string,
  sessionId: string | null | undefined,
  interactionType: InteractionType
) {
  const supabase = getSupabaseAdmin()
  const userId = normalizeUserId(userIdRaw)
  const safeSessionId = isUuid(sessionId) ? sessionId : null
  const { error } = await supabase.from('topic_interactions').insert({
    user_id: userId,
    session_id: safeSessionId,
    subject,
    topic: normalizeTopic(topic),
    interaction_type: interactionType,
  })
  if (error && !isOptionalAnalyticsTableMissing(error)) throw error
}

export async function trackSkip(userId: string, subject: string, topic: string, sessionId?: string | null) {
  try {
    const existing = await getExistingPerformance(normalizeUserId(userId), subject, normalizeTopic(topic))
    await upsertPerformance(userId, subject, topic, {
      status: 'skipped',
      times_skipped: (existing?.times_skipped ?? 0) + 1,
      confidence_score: Math.max(0, (existing?.confidence_score ?? 30) - 10),
    })
    await logInteraction(userId, subject, topic, sessionId, 'skip')
  } catch (error) {
    console.error('trackSkip failed:', error)
  }
}

export async function trackWeak(userId: string, subject: string, topic: string, sessionId?: string | null) {
  try {
    const existing = await getExistingPerformance(normalizeUserId(userId), subject, normalizeTopic(topic))
    const asked = (existing?.times_asked_differently ?? 0) + 1
    await upsertPerformance(userId, subject, topic, {
      status: asked >= 2 ? 'weak' : existing?.status ?? 'reviewed',
      times_asked_differently: asked,
      confidence_score: Math.min(existing?.confidence_score ?? 35, 45),
    })
    await logInteraction(userId, subject, topic, sessionId, 'confused')
  } catch (error) {
    console.error('trackWeak failed:', error)
  }
}

export async function trackConfident(userId: string, subject: string, topic: string, sessionId?: string | null) {
  try {
    const existing = await getExistingPerformance(normalizeUserId(userId), subject, normalizeTopic(topic))
    await upsertPerformance(userId, subject, topic, {
      status: 'confident',
      times_reviewed: (existing?.times_reviewed ?? 0) + 1,
      confidence_score: 90,
    })
    await logInteraction(userId, subject, topic, sessionId, 'understood')
    await updateScore({
      userId,
      points: 25,
      reason: 'topic_confident',
      topicsMasteredDelta: existing?.status === 'confident' ? 0 : 1,
    })
  } catch (error) {
    console.error('trackConfident failed:', error)
  }
}

export async function trackFormulaRequest(userId: string, subject: string, topic: string, sessionId?: string | null) {
  try {
    const existing = await getExistingPerformance(normalizeUserId(userId), subject, normalizeTopic(topic))
    await upsertPerformance(userId, subject, topic, {
      status: existing?.status === 'unseen' ? 'reviewed' : existing?.status ?? 'reviewed',
      times_reviewed: (existing?.times_reviewed ?? 0) + 1,
      confidence_score: Math.max(existing?.confidence_score ?? 0, 50),
    })
    await logInteraction(userId, subject, topic, sessionId, 'formula_request')
  } catch (error) {
    console.error('trackFormulaRequest failed:', error)
  }
}

export async function trackExampleRequest(userId: string, subject: string, topic: string, sessionId?: string | null) {
  try {
    const existing = await getExistingPerformance(normalizeUserId(userId), subject, normalizeTopic(topic))
    await upsertPerformance(userId, subject, topic, {
      status: existing?.status === 'unseen' ? 'reviewed' : existing?.status ?? 'reviewed',
      times_reviewed: (existing?.times_reviewed ?? 0) + 1,
      confidence_score: Math.max(existing?.confidence_score ?? 0, 55),
    })
    await logInteraction(userId, subject, topic, sessionId, 'example_request')
  } catch (error) {
    console.error('trackExampleRequest failed:', error)
  }
}

export async function trackSession(userId: string, subject: string, topic: string, level?: string | null) {
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('exam_prep_sessions')
      .insert({
        user_id: normalizeUserId(userId),
        subject,
        topic: normalizeTopic(topic),
        level: level ?? null,
      })
      .select('id')
      .single()

    if (error) throw error
    await updateScore({ userId, points: 5, reason: 'daily_session' })
    return (data as { id: string }).id
  } catch (error) {
    console.error('trackSession failed:', error)
    return null
  }
}

export async function endSession(sessionId: string, stats: SessionStats) {
  if (!isUuid(sessionId)) return
  try {
    const supabase = getSupabaseAdmin()
    const { data } = await supabase.from('exam_prep_sessions').select('started_at').eq('id', sessionId).maybeSingle()
    const startedAt = data && typeof data.started_at === 'string' ? new Date(data.started_at).getTime() : Date.now()
    const duration = Math.max(0, Math.round((Date.now() - startedAt) / 60000))
    const { error } = await supabase
      .from('exam_prep_sessions')
      .update({
        ended_at: nowIso(),
        session_duration_minutes: duration,
        topics_covered: stats.topicsCovered ?? 0,
        topics_skipped: stats.topicsSkipped ?? 0,
        topics_weak: stats.topicsWeak ?? 0,
      })
      .eq('id', sessionId)
    if (error) throw error
  } catch (error) {
    console.error('endSession failed:', error)
  }
}

export async function getWeakTopics(userId: string, subject?: string) {
  try {
    const supabase = getSupabaseAdmin()
    const safeUserId = normalizeUserId(userId)
    let query = supabase
      .from('student_topic_performance')
      .select('*')
      .in('status', ['weak', 'skipped'])
      .order('times_skipped', { ascending: false })
      .order('times_asked_differently', { ascending: false })

    query = safeUserId ? query.eq('user_id', safeUserId) : query.is('user_id', null)
    if (subject) query = query.eq('subject', subject)

    const { data, error } = await query
    if (error) throw error
    return (data ?? []) as TopicPerformance[]
  } catch (error) {
    console.error('getWeakTopics failed:', error)
    return []
  }
}

function calculateStudyStreak(sessions: ExamPrepSession[]) {
  const days = new Set(sessions.map((session) => session.started_at.slice(0, 10)))
  let streak = 0
  const cursor = new Date()
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

function buildWeeklyTrend(sessions: ExamPrepSession[]) {
  const today = new Date()
  const day = today.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const start = new Date(today)
  start.setHours(0, 0, 0, 0)
  start.setDate(today.getDate() + mondayOffset)

  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(start)
    current.setDate(start.getDate() + index)
    const iso = current.toISOString().slice(0, 10)
    const daySessions = sessions.filter((session) => session.started_at.slice(0, 10) === iso)
    return {
      date: current.toLocaleDateString('en-US', { weekday: 'short' }),
      questionsAsked: daySessions.length,
      topicsCovered: daySessions.reduce((sum, session) => sum + Math.max(1, session.topics_covered ?? 0), 0),
    }
  })
}

export async function getStudentProfile(userId: string): Promise<StudentPerformanceProfile> {
  try {
    const supabase = getSupabaseAdmin()
    const safeUserId = normalizeUserId(userId)
    const topicQuery = safeUserId
      ? supabase.from('student_topic_performance').select('*').eq('user_id', safeUserId)
      : supabase.from('student_topic_performance').select('*').is('user_id', null)
    const sessionQuery = safeUserId
      ? supabase.from('exam_prep_sessions').select('*').eq('user_id', safeUserId).order('started_at', { ascending: false }).limit(20)
      : supabase.from('exam_prep_sessions').select('*').is('user_id', null).order('started_at', { ascending: false }).limit(20)

    const [topicRes, sessionRes] = await Promise.all([topicQuery, sessionQuery])
    if (topicRes.error) throw topicRes.error
    if (sessionRes.error) throw sessionRes.error

    const topics = (topicRes.data ?? []) as TopicPerformance[]
    const sessions = (sessionRes.data ?? []) as ExamPrepSession[]
    const grouped = new Map<string, TopicPerformance[]>()
    for (const topic of topics) {
      grouped.set(topic.subject, [...(grouped.get(topic.subject) ?? []), topic])
    }

    const bySubject = Array.from(grouped.entries()).map(([subject, items]) => ({
      subject,
      total: items.length,
      weak: items.filter((item) => item.status === 'weak').length,
      skipped: items.filter((item) => item.status === 'skipped').length,
      confident: items.filter((item) => item.status === 'confident').length,
      reviewed: items.filter((item) => item.status === 'reviewed').length,
      unseen: items.filter((item) => item.status === 'unseen').length,
      averageConfidence: Math.round(items.reduce((sum, item) => sum + item.confidence_score, 0) / Math.max(1, items.length)),
    }))

    const trend = buildWeeklyTrend(sessions)

    return {
      topics,
      sessions,
      bySubject,
      totals: {
        subjects: bySubject.length,
        confident: topics.filter((item) => item.status === 'confident').length,
        weak: topics.filter((item) => item.status === 'weak').length,
        skipped: topics.filter((item) => item.status === 'skipped').length,
        reviewed: topics.filter((item) => item.status === 'reviewed').length,
        unseen: topics.filter((item) => item.status === 'unseen').length,
        studyStreak: calculateStudyStreak(sessions),
      },
      trend,
    }
  } catch (error) {
    console.error('getStudentProfile failed:', error)
    return {
      topics: [],
      sessions: [],
      bySubject: [],
      totals: { subjects: 0, confident: 0, weak: 0, skipped: 0, reviewed: 0, unseen: 0, studyStreak: 0 },
      trend: buildWeeklyTrend([]),
    }
  }
}
