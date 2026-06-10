export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { getDashboardData } from '@/lib/progress/progressEngine'
import { buildAlternativeExplanation } from '@/lib/rag/pipelines'
import { createRequestId, logError } from '@/lib/server/logger'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'
import { getStudentProfile } from '@/lib/server/profile'

type TopicProgressRow = {
  subject?: string | null
  topic?: string | null
  attempted_count?: number | null
  correct_count?: number | null
  wrong_count?: number | null
  accuracy?: number | null
  confidence_score?: number | null
  weak_score?: number | null
  last_practiced_at?: string | null
}

type LearningGapRow = {
  subject?: string | null
  skipped_chapter?: string | null
  current_topic?: string | null
  detection_count?: number | null
  status?: string | null
  updated_at?: string | null
}

type ConversationRow = {
  answer?: string | null
  created_at?: string | null
  id?: string
  question?: string | null
}

function isMissingTable(error: unknown) {
  const code = (error as { code?: string })?.code
  const message = String((error as { message?: string })?.message ?? '')
  return code === '42P01' || code === 'PGRST205' || /schema cache|does not exist/i.test(message)
}

function isDemoUserId(userId: string | undefined) {
  return !userId || userId === 'test-anonymous-user' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)
}

async function safeQuery<T>(query: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  try {
    const { data, error } = await query
    if (error) throw error
    return data ?? []
  } catch (error) {
    if (!isMissingTable(error)) {
      console.error('dashboard query failed:', error)
    }
    return []
  }
}

async function loadStableProfile(userId: string) {
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('user_profiles')
      .select('level, board, stage, subjects, language_preference, explanation_style, setup_completed')
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
    } | null
  } catch (error) {
    if (!isMissingTable(error)) {
      console.error('loadStableProfile failed:', error)
    }
    return null
  }
}

function dayName(date: string) {
  const parsed = new Date(date)
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString('en-US', { weekday: 'short' })
}

function fallbackPayload() {
  const profile = {
    level: 'O Level',
    board: 'Cambridge',
    stage: null,
    subjects: ['Physics', 'Chemistry'],
    languagePreference: 'Banglish',
    explanationStyle: 'Step-by-step teacher style',
    setupCompleted: false,
  }
  const dashboard = {
    name: 'Student',
    level: profile.level,
    board: profile.board,
    subjects: profile.subjects,
    questionsToday: 0,
    totalQuestionsAttempted: 0,
    overallAccuracy: 0,
    studyStreak: 0,
    examCountdowns: [],
    accuracyTrend: [],
    weeklyData: [],
    weakPoints: [],
    skippedChapters: [],
    recentSessions: [],
    recentExamSessions: [],
    recentExamPlans: [],
    recentConversations: [],
    syllabus: [],
    todaysPlan: ['Start solving questions and ScholarHAAB will detect your weak topics automatically.'],
  }

  return {
    profile,
    topicProgress: [],
    learningGaps: [],
    skippedChapters: [],
    recentExamSessions: [],
    recentExamPlans: [],
    todayFocus: dashboard.todaysPlan,
    dashboard,
  }
}

export async function GET(req: Request) {
  const requestId = createRequestId()
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (isDemoUserId(user.id)) {
    return NextResponse.json(fallbackPayload())
  }

  const supabase = getSupabaseAdmin()
  const [legacyProfile, stableProfile, topicProgress, learningGaps, examSessions, examPlans, conversations, legacyDashboard] =
    await Promise.all([
      getStudentProfile(user.id).catch(() => null),
      loadStableProfile(user.id),
      safeQuery<TopicProgressRow>(
        supabase
          .from('student_topic_progress')
          .select('subject, topic, attempted_count, correct_count, wrong_count, accuracy, confidence_score, weak_score, last_practiced_at')
          .eq('user_id', user.id)
          .order('weak_score', { ascending: false })
          .limit(50)
      ),
      safeQuery<LearningGapRow>(
        supabase
          .from('student_learning_gaps')
          .select('subject, skipped_chapter, current_topic, detection_count, status, updated_at')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('updated_at', { ascending: false })
          .limit(20)
      ),
      safeQuery<{
        id?: string
        subject?: string | null
        level?: string | null
        board?: string | null
        exam_date?: string | null
        paper_type?: string | null
        topic_focus?: string | null
        created_at?: string | null
      }>(
        supabase
          .from('exam_sessions')
          .select('id, subject, level, board, exam_date, paper_type, topic_focus, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(8)
      ),
      safeQuery<{ id?: string; exam_session_id?: string | null; created_at?: string | null }>(
        supabase
          .from('exam_plans')
          .select('id, exam_session_id, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(8)
      ),
      safeQuery<ConversationRow>(
        supabase
          .from('conversations')
          .select('id, question, answer, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(8)
      ),
      getDashboardData(user.id).catch(() => null),
    ])

  const level = stableProfile?.level ?? legacyProfile?.preferredLevel ?? legacyDashboard?.profile.level ?? 'Level not set'
  const board = stableProfile?.board ?? legacyProfile?.preferredBoard ?? 'Board not set'
  const subjects = stableProfile?.subjects?.length
    ? stableProfile.subjects
    : legacyProfile?.preferredSubjects?.length
      ? legacyProfile.preferredSubjects
      : legacyDashboard?.profile.subjects ?? []
  const weakPoints = topicProgress
    .filter((row) => Number(row.weak_score ?? 0) >= 30 || Number(row.wrong_count ?? 0) > 0 || Number(row.accuracy ?? 100) < 60)
    .map((row) => ({
      subject: row.subject ?? 'General',
      topic: row.topic ?? 'General',
      accuracy: Number(row.accuracy ?? 0),
      timesStruggled: Number(row.wrong_count ?? 0),
      weakScore: Number(row.weak_score ?? 0),
    }))
  const skippedChapters = learningGaps.map((gap) => ({
    subject: gap.subject ?? 'General',
    topic: gap.skipped_chapter ?? 'Skipped chapter',
    currentTopic: gap.current_topic,
    detectionCount: Number(gap.detection_count ?? 1),
    status: gap.status ?? 'active',
  }))
  const todaysPlan = [
    ...weakPoints.slice(0, 2).map((point) => `${point.topic} - 15 min weak topic drill`),
    ...skippedChapters.slice(0, 1).map((gap) => `${gap.topic} - 10 min prerequisite rescue`),
    ...(legacyDashboard?.dailyPlan ?? []).slice(0, 2).map((item) => `${item.topic} - ${item.duration_minutes} min ${item.type}`),
  ]

  const dashboard = {
    name: legacyProfile?.fullName || legacyProfile?.email || 'Student',
    level,
    board,
    subjects,
    questionsToday: legacyDashboard?.todayProgress.questionsDone ?? 0,
    totalQuestionsAttempted:
      legacyDashboard?.profile.totalQuestionsAttempted ??
      topicProgress.reduce((sum, row) => sum + Number(row.attempted_count ?? 0), 0),
    overallAccuracy:
      legacyDashboard?.accuracy.overall ??
      Math.round(
        topicProgress.reduce((sum, row) => sum + Number(row.accuracy ?? 0), 0) / Math.max(1, topicProgress.length)
      ),
    studyStreak: legacyDashboard?.profile.studyStreak ?? 0,
    examCountdowns: examSessions
      .filter((session) => session.exam_date)
      .map((session) => {
        const daysLeft = session.exam_date
          ? Math.ceil((new Date(session.exam_date).getTime() - Date.now()) / 86_400_000)
          : 0
        return { subject: session.subject ?? 'Exam', daysLeft }
      }),
    accuracyTrend: legacyDashboard?.accuracyTrend ?? [],
    weeklyData:
      legacyDashboard?.weeklyActivity.map((day) => ({
        day: dayName(day.date),
        date: day.date,
        questions: day.count,
        count: day.count,
        accuracy: day.accuracy,
      })) ?? [],
    weakPoints: weakPoints.length ? weakPoints : legacyDashboard?.weakPoints ?? [],
    skippedChapters,
    recentSessions: legacyDashboard?.recentSessions ?? [],
    recentExamSessions: examSessions,
    recentExamPlans: examPlans,
    recentConversations: conversations,
    syllabus: [
      ...(legacyDashboard?.syllabus ?? []),
      ...skippedChapters.map((gap) => ({ topic: gap.topic, status: 'skipped', mastery: 0 })),
    ],
    todaysPlan: todaysPlan.length
      ? todaysPlan
      : ['Start solving questions and ScholarHAAB will detect your weak topics automatically.'],
  }

  const recommendationSeeds = [
    ...weakPoints.slice(0, 2).map((point) => ({
      reason: 'weak_topic',
      subject: point.subject,
      topic: point.topic,
    })),
    ...skippedChapters.slice(0, 2).map((gap) => ({
      reason: 'skipped_or_difficult_topic',
      subject: gap.subject,
      topic: gap.topic,
    })),
  ]

  const alternativeExplanations = (
    await Promise.all(
      recommendationSeeds.map(async (seed) => {
        try {
          const explanation = await buildAlternativeExplanation({
            requestId,
            subject: seed.subject,
            topic: seed.topic,
          })
          return explanation ? { ...seed, ...explanation } : null
        } catch (error) {
          logError('dashboard_rag_recommendation_failed', error, {
            request_id: requestId,
            topic: seed.topic,
            user_id: user.id,
          })
          return null
        }
      })
    )
  ).filter(Boolean)

  return NextResponse.json({
    profile: {
      level,
      board,
      stage: stableProfile?.stage ?? null,
      subjects,
      languagePreference: stableProfile?.language_preference ?? null,
      explanationStyle: stableProfile?.explanation_style ?? null,
      setupCompleted: Boolean(stableProfile?.setup_completed || legacyProfile?.onboardingCompleted),
    },
    topicProgress,
    learningGaps,
    skippedChapters,
    recentExamSessions: examSessions,
    recentExamPlans: examPlans,
    recentConversations: conversations,
    ragRecommendations: alternativeExplanations,
    todayFocus: dashboard.todaysPlan,
    dashboard,
  })
}
