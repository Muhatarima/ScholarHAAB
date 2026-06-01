export const runtime = 'nodejs'
export const maxDuration = 30
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { getStudentProfile } from '@/lib/server/profile'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'
import { analyzePastPapers } from '@/lib/exam/analyzePastPapers'
import { getWeakTopics } from '@/lib/analytics/topicTracker'

function isMissingTable(error: unknown) {
  const code = (error as { code?: string })?.code
  const message = String((error as { message?: string })?.message ?? '')
  return code === '42P01' || code === 'PGRST205' || /schema cache|does not exist/i.test(message)
}

function requiredString(value: unknown, name: string) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) throw new Error(`${name} is required.`)
  return text
}

function daysUntil(date: string) {
  const target = new Date(`${date}T00:00:00`)
  if (Number.isNaN(target.getTime())) return null
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000)
}

async function saveExamPlan(input: {
  userId: string
  level: string
  board: string
  subject: string
  examDate: string
  paperType: string | null
  topicFocus: string | null
  availableStudyMinutes: number | null
  targetGrade: string | null
  plan: unknown
}) {
  try {
    const supabase = getSupabaseAdmin()
    const { data: session, error: sessionError } = await supabase
      .from('exam_sessions')
      .insert({
        user_id: input.userId,
        level: input.level,
        board: input.board,
        subject: input.subject,
        exam_date: input.examDate,
        paper_type: input.paperType,
        topic_focus: input.topicFocus,
        available_study_minutes: input.availableStudyMinutes,
        target_grade: input.targetGrade,
      })
      .select('id')
      .single()

    if (sessionError) throw sessionError
    const sessionId = (session as { id: string }).id
    const { error: planError } = await supabase.from('exam_plans').insert({
      user_id: input.userId,
      exam_session_id: sessionId,
      plan_json: input.plan,
    })
    if (planError) throw planError
    return sessionId
  } catch (error) {
    if (!isMissingTable(error)) {
      console.error('saveExamPlan failed:', error)
    }
    return null
  }
}

export async function POST(req: Request) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = (await req.json()) as Record<string, unknown>
    let profile: Awaited<ReturnType<typeof getStudentProfile>> | null = null
    try {
      profile = await getStudentProfile(user.id)
    } catch {
      profile = null
    }

    const level = typeof body.level === 'string' && body.level.trim() ? body.level.trim() : profile?.preferredLevel ?? 'A Level'
    const board = typeof body.board === 'string' && body.board.trim() ? body.board.trim() : profile?.preferredBoard ?? 'Cambridge'
    const subject = requiredString(body.subject, 'subject')
    const examDate = requiredString(body.examDate, 'exam date')
    const paperType = typeof body.paperType === 'string' && body.paperType.trim() ? body.paperType.trim() : null
    const topicFocus = typeof body.topicFocus === 'string' && body.topicFocus.trim() ? body.topicFocus.trim() : null
    const availableStudyMinutes = Number.isFinite(Number(body.availableStudyMinutes))
      ? Math.max(1, Number(body.availableStudyMinutes))
      : null
    const targetGrade = typeof body.targetGrade === 'string' && body.targetGrade.trim() ? body.targetGrade.trim() : null
    const remainingDays = daysUntil(examDate)
    const examSoon = remainingDays !== null && remainingDays <= 3
    const emergencyMode = remainingDays !== null && remainingDays <= 1
    const analysis = await analyzePastPapers({ level, board, subject, paperType, topicFocus, yearsBack: 10 })
    const weakTopics = await getWeakTopics(user.id, subject)
    const topTopics = analysis.predictedImportantTopics.length
      ? analysis.predictedImportantTopics
      : [
          {
            topic: topicFocus ?? subject,
            whyImportant: 'Prediction based on available data.',
            estimatedExamChance: 'medium',
            confidence: 'medium' as const,
          },
        ]
    const formulas = analysis.recurringFormulas.length
      ? analysis.recurringFormulas
      : [{ formula: 'Write formula first', topic: topicFocus ?? subject, frequency: 1 }]

    const plan = {
      meta: {
        level,
        board,
        subject,
        paperType,
        topicFocus,
        examDate,
        remainingDays,
        examSoon,
        emergencyMode,
        dataLabel: analysis.dataLabel,
      },
      mostRepeatedTopics: analysis.repeatedTopics,
      highProbabilityTopics: topTopics,
      mostLikelyQuestionTypes: analysis.highFrequencyQuestionTypes.map((item) => ({
        questionStyle: item.type,
        frequency: item.frequency,
        markSchemePattern: analysis.markSchemePatterns[0] ?? 'method point, accuracy point, final answer point',
        practiceRecommendation: `Do one ${item.type} question under timed conditions.`,
      })),
      formulas: formulas.map((item) => ({
        formula: item.formula,
        topic: item.topic,
        whenToUse: `Use when the question mentions ${item.topic}.`,
        commonMistake: 'Skipping the formula or unit.',
        example: `${item.formula} -> substitute values with units.`,
      })),
      theoryRescue: topTopics.slice(0, 3).map((item) => ({
        topic: item.topic,
        explanation: `Know the definition, one example, and the mark-scheme keywords for ${item.topic}.`,
      })),
      studyPlan: {
        fifteenMinutePlan: emergencyMode
          ? ['Formula recall', 'One repeated pattern question', 'Mark scheme keywords only']
          : ['Revise top repeated topic', 'Do one short question', 'Check mark scheme keywords'],
        thirtyMinutePractice: ['One calculation', 'One explain question', 'Correct mistakes immediately'],
        sixtyMinuteDeepPractice: ['Timed mini mock', 'Review weak topic', 'Redo missed mark points'],
        doFirst: topTopics.slice(0, 3).map((item) => item.topic),
        skipForNow: ['Low-frequency reading', 'Long theory notes without practice'],
      },
      practiceQuestions: topTopics.slice(0, 3).map((item, index) => ({
        question: `${subject} ${paperType ?? 'paper'} practice ${index + 1}: Explain or calculate a key idea from ${item.topic}.`,
        marks: index === 0 ? 4 : 3,
        label: 'AI-generated mock based on A/O Level pattern',
      })),
      personalWeaknessBoost: {
        weakTopics: weakTopics.slice(0, 5).map((topic) => topic.topic),
        advice: weakTopics.length
          ? 'Start with these weak topics before broad revision.'
          : 'No weak topics detected yet. ScholarHAAB will learn from solver and mock attempts.',
      },
    }

    const sessionId = await saveExamPlan({
      userId: user.id,
      level,
      board,
      subject,
      examDate,
      paperType,
      topicFocus,
      availableStudyMinutes,
      targetGrade,
      plan,
    })

    return NextResponse.json({ plan, analysis, sessionId })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not generate exam plan.' },
      { status: 400 }
    )
  }
}
