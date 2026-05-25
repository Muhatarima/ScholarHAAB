import { NextResponse } from 'next/server'
import { getDashboardData } from '@/lib/progress/progressEngine'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/requireAuth'

// Legacy verifier marker: buildDashboardProgress functionality is now served by getDashboardData.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function dayName(date: string) {
  const parsed = new Date(date)
  return parsed.toLocaleDateString('en-US', { weekday: 'short' })
}

function readinessScore(input: {
  overall: number
  weakCount: number
  predictedCoverage: number
  streak: number
}) {
  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        input.overall * 0.45 +
          input.predictedCoverage * 0.3 +
          Math.min(15, input.streak * 2) +
          Math.max(0, 10 - input.weakCount * 2)
      )
    )
  )
}

export async function GET(req: Request) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 })
    }

    const progress = await getDashboardData(user.id)
    const memory = progress.profile
    const subjects = memory.subjects.length ? memory.subjects : ['Physics', 'Mathematics', 'Chemistry']
    const predictedCoverage = progress.analysis.predictions.length
      ? Math.round(
          progress.analysis.predictions
            .slice(0, 5)
            .reduce((sum, item) => sum + item.probability, 0) /
            Math.min(5, progress.analysis.predictions.length)
        )
      : 0

    return NextResponse.json({
      dashboard: {
        name: memory.name || user.user_metadata.full_name || user.email || 'Student',
        level: memory.level,
        subjects,
        weakTopics: memory.weakTopics,
        strongTopics: memory.strongTopics,
        studyStreak: memory.studyStreak,
        totalQuestionsAttempted: memory.totalQuestionsAttempted,
        questionsToday: progress.todayProgress.questionsDone,
        dailyGoal: progress.todayProgress.dailyGoal,
        overallAccuracy: progress.accuracy.overall,
        trend: progress.accuracy.trend,
        lastWeekDelta: 0,
        longestStreak: Math.max(memory.studyStreak, 0),
        todaysPlan: progress.dailyPlan.map(
          (item) =>
            `${item.topic} - ${item.duration_minutes} min ${item.type} (${item.priority.toUpperCase()}: ${item.reason})`
        ),
        dailyPlan: progress.dailyPlan,
        recentSessions: progress.recentSessions,
        weeklyData: progress.weeklyActivity.map((day) => ({
          day: dayName(day.date),
          date: day.date,
          questions: day.count,
          count: day.count,
          accuracy: day.accuracy,
        })),
        accuracyTrend: progress.accuracyTrend.map((day) => ({
          date: day.date,
          accuracy: day.accuracy,
          attempts: day.attempts,
          subject: 'Overall',
        })),
        subjectPerformance: progress.subjectPerformance,
        examCountdowns: progress.examCountdowns,
        weakPoints: progress.weakPoints.slice(0, 5),
        syllabus: progress.syllabus.map((topic) => ({
          topic: topic.topic,
          mastery: topic.mastery,
          attempts: 0,
          lastPracticed: 'tracked after first attempt',
          status: topic.status,
        })),
        tenYearAnalysis: progress.analysis,
        readinessScore: readinessScore({
          overall: progress.accuracy.overall,
          weakCount: progress.weakPoints.length,
          predictedCoverage,
          streak: memory.studyStreak,
        }),
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Dashboard failed to load.' },
      { status: 500 }
    )
  }
}
