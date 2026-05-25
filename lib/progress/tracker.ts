import { getSyllabusTopics, normalizeTopic } from '@/lib/learning/syllabus'
import { loadStudentMemory, updateMemoryAfterSession } from '@/lib/memory/studentMemory'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'

export type TopicMastery = {
  topic: string
  attempted: number
  correct: number
  mastery: number
  trend: 'improving' | 'declining' | 'stable'
  lastAttempted: string
  recommendation: string
}

function getAdminClientOrNull() {
  try {
    return getSupabaseAdmin()
  } catch {
    return null
  }
}

function sameText(left: string, right: string) {
  return normalizeTopic(left) === normalizeTopic(right)
}

function inferCorrectness(answer: string, expected?: string | null) {
  if (!expected) {
    return null
  }

  const expectedTokens = new Set(normalizeTopic(expected).split(' ').filter((token) => token.length > 3))
  const answerTokens = new Set(normalizeTopic(answer).split(' ').filter((token) => token.length > 3))
  if (expectedTokens.size === 0) {
    return null
  }

  let overlap = 0
  for (const token of expectedTokens) {
    if (answerTokens.has(token)) {
      overlap += 1
    }
  }

  return overlap / expectedTokens.size >= 0.45
}

export async function trackQuestionAttempt(
  studentId: string,
  questionId: string,
  answer: string,
  timeTakenSeconds: number,
  options: {
    subject?: string | null
    topic?: string | null
    expectedAnswer?: string | null
    marksObtained?: number | null
    isCorrect?: boolean | null
    aiFeedback?: string | null
  } = {}
) {
  const supabase = getAdminClientOrNull()
  if (!supabase || !studentId) {
    return { saved: false, isCorrect: false }
  }

  const isCorrect = options.isCorrect ?? inferCorrectness(answer, options.expectedAnswer) ?? false
  const subject = options.subject ?? 'General'
  const topic = options.topic ?? 'General'

  try {
    const { data: previousAttempts } = await supabase
      .from('question_attempts')
      .select('id')
      .eq('student_id', studentId)
      .eq('question_id', questionId)

    await supabase.from('question_attempts').insert({
      student_id: studentId,
      question_id: questionId,
      subject,
      topic,
      student_answer: answer,
      is_correct: isCorrect,
      marks_obtained: options.marksObtained ?? (isCorrect ? 1 : 0),
      time_taken_seconds: Math.max(0, Math.round(timeTakenSeconds)),
      attempt_number: (previousAttempts?.length ?? 0) + 1,
      ai_feedback: options.aiFeedback ?? null,
    })

    await updateMemoryAfterSession(studentId, {
      subject,
      topic,
      sessionType: 'practice',
      questionsAttempted: 1,
      questionsCorrect: isCorrect ? 1 : 0,
      weakPointsIdentified: isCorrect ? [] : [topic],
      aiNotes: options.aiFeedback ?? `Attempt logged for ${topic}.`,
    })

    return { saved: true, isCorrect }
  } catch {
    return { saved: false, isCorrect }
  }
}

export async function calculateTopicMastery(
  studentId: string,
  subject: string,
  topic: string
): Promise<TopicMastery> {
  const supabase = getAdminClientOrNull()
  if (!supabase) {
    return {
      topic,
      attempted: 0,
      correct: 0,
      mastery: 0,
      trend: 'stable',
      lastAttempted: 'never',
      recommendation: 'Start with easy examples, then move to past-paper questions.',
    }
  }

  try {
    const { data } = await supabase
      .from('question_attempts')
      .select('is_correct, attempted_at')
      .eq('student_id', studentId)
      .ilike('subject', `%${subject}%`)
      .ilike('topic', `%${topic}%`)
      .order('attempted_at', { ascending: true })

    const attempts = data ?? []
    const attempted = attempts.length
    const correct = attempts.filter((row) => Boolean(row.is_correct)).length
    const mastery = attempted ? Math.round((correct / attempted) * 100) : 0
    const firstHalf = attempts.slice(0, Math.floor(attempted / 2))
    const secondHalf = attempts.slice(Math.floor(attempted / 2))
    const firstRate = firstHalf.length
      ? firstHalf.filter((row) => Boolean(row.is_correct)).length / firstHalf.length
      : 0
    const secondRate = secondHalf.length
      ? secondHalf.filter((row) => Boolean(row.is_correct)).length / secondHalf.length
      : firstRate
    const trend =
      secondRate > firstRate + 0.1 ? 'improving' : secondRate < firstRate - 0.1 ? 'declining' : 'stable'
    const last = attempts[attempts.length - 1]?.attempted_at

    return {
      topic,
      attempted,
      correct,
      mastery,
      trend,
      lastAttempted: last ? new Date(last).toLocaleDateString('en-US') : 'never',
      recommendation:
        mastery >= 80
          ? 'Ready for hard questions.'
          : mastery >= 40
            ? 'Keep doing medium past-paper questions with mark scheme checks.'
            : 'Relearn the concept, then do easy drills first.',
    }
  } catch {
    return {
      topic,
      attempted: 0,
      correct: 0,
      mastery: 0,
      trend: 'stable',
      lastAttempted: 'never',
      recommendation: 'Progress data is not available yet. Start with easy examples and log attempts.',
    }
  }
}

export async function generateWeeklyReport(studentId: string) {
  const supabase = getAdminClientOrNull()
  const memory = await loadStudentMemory(studentId)
  if (!supabase) {
    return `This week you kept a ${memory.studyStreak} day streak. Next focus: ${memory.weakTopics[0] ?? 'one weak topic'}.`
  }

  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from('question_attempts')
      .select('subject, topic, is_correct')
      .eq('student_id', studentId)
      .gte('attempted_at', since)

    const attempts = data ?? []
    const correct = attempts.filter((row) => Boolean(row.is_correct)).length
    const topics = Array.from(new Set(attempts.map((row) => String(row.topic ?? '')).filter(Boolean)))

    return [
      `This week you attempted ${attempts.length} questions.`,
      `Accuracy: ${attempts.length ? Math.round((correct / attempts.length) * 100) : 0}%.`,
      `Topics covered: ${topics.length ? topics.join(', ') : 'not enough tracked attempts yet'}.`,
      `Study streak: ${memory.studyStreak} days.`,
      `Next week focus: ${memory.weakTopics.slice(0, 3).join(', ') || 'build your first weak-topic list through practice'}.`,
    ].join('\n')
  } catch {
    return `Weekly report is not available until the learning tables are created. Current streak: ${memory.studyStreak} days.`
  }
}

export async function syllabusCompletionMap(studentId: string, subject: string) {
  const topics = getSyllabusTopics(subject)
  const rows = await Promise.all(
    topics.map(async (topic) => {
      const mastery = await calculateTopicMastery(studentId, subject, topic)
      const status =
        mastery.attempted === 0
          ? 'not_attempted'
          : mastery.mastery >= 80
            ? 'mastered'
            : mastery.mastery >= 40
              ? 'learning'
              : 'weak'

      return {
        topic,
        status,
        mastery: mastery.mastery,
        attempted: mastery.attempted,
      }
    })
  )

  return rows
}

export function summarizeDashboardPlan(input: {
  weakTopics: string[]
  strongTopics: string[]
  subjects: string[]
}) {
  return [
    input.weakTopics[0] ? `Practice ${input.weakTopics[0]} first - it is your current weak spot.` : 'Do one diagnostic question to identify your first weak topic.',
    input.subjects[0] ? `Revise one repeated ${input.subjects[0]} topic for 20 minutes.` : 'Set your subjects in onboarding.',
    input.strongTopics[0] ? `Finish with a hard question from ${input.strongTopics[0]}.` : 'End with one confidence-builder question.',
  ]
}
