import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'
import { trackSolvedTopic } from '@/lib/progress/autoTrack'
import { gradeMockAnswer } from '@/lib/mock/gradeMock'
import { generateJson } from '@/lib/llm/failover'

export const runtime = 'nodejs'
export const maxDuration = 30
export const dynamic = 'force-dynamic'

function isUuid(value: string | undefined): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
}

function cleanString(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 4000) : fallback
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

function fallbackGrade(answer: string, markScheme: string, marks: number) {
  const answerWords = new Set(answer.toLowerCase().match(/[a-z0-9]+/g) ?? [])
  const schemeWords = (markScheme.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((word) => word.length > 3)
  const hits = schemeWords.filter((word) => answerWords.has(word)).length
  const percentage = schemeWords.length ? Math.min(100, Math.round((hits / Math.max(4, schemeWords.length)) * 100)) : 40
  const score = Math.max(0, Math.min(marks, Math.round((percentage / 100) * marks)))

  return {
    score,
    totalMarks: marks,
    percentage,
    isCorrect: percentage >= 60,
    feedback:
      percentage >= 60
        ? 'Good attempt. You included some relevant mark-scheme ideas.'
        : 'Add more exact keywords from the mark scheme and make the final point clearer.',
    got: [],
    missing: [],
  }
}

type LlmGrade = {
  hitPoints?: unknown[]
  isCorrect?: boolean
  missingPoints?: unknown[]
  score?: number
}

function pointText(value: unknown) {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value)
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of ['point', 'text', 'criterion', 'mark', 'missing', 'feedback', 'reason']) {
      const clean = cleanString(record[key], '')
      if (clean) return clean
    }

    try {
      const json = JSON.stringify(value)
      return json === '{}' ? '' : json
    } catch {
      return ''
    }
  }

  return ''
}

function normalizePoints(value: unknown, fallback: string[]) {
  const source = Array.isArray(value) ? value : fallback
  const points = source
    .map((item) => pointText(item))
    .filter((item) => item && item !== '[object Object]')
    .slice(0, 6)

  return points.length ? points : fallback
}

async function gradeWithMarkScheme(input: {
  answer: string
  markScheme: string
  marks: number
  questionText: string
}) {
  const fallback = gradeMockAnswer({
    answer: input.answer,
    markScheme: input.markScheme,
    marks: input.marks,
  })

  try {
    const result = await generateJson<LlmGrade>({
      maxTokens: 700,
      prompt: [
        `Question: ${input.questionText}`,
        '',
        `Mark scheme: ${input.markScheme}`,
        '',
        `Student answer: ${input.answer}`,
        '',
        `Maximum marks: ${input.marks}`,
        '',
        'Return JSON only: {"score":0,"isCorrect":false,"hitPoints":[],"missingPoints":[]}',
      ].join('\n'),
      system:
        'Grade only against the supplied mark scheme. Do not create a new solution. Award marks for equivalent wording when scientifically correct.',
      temperature: 0,
    })

    const score = Math.max(0, Math.min(input.marks, Math.round(Number(result.data.score ?? fallback.score))))
    const percentage = Math.round((score / Math.max(1, input.marks)) * 100)
    return {
      ...fallback,
      hitPoints: normalizePoints(result.data.hitPoints, fallback.hitPoints),
      isCorrect: typeof result.data.isCorrect === 'boolean' ? result.data.isCorrect : percentage >= 60,
      missingPoints: normalizePoints(result.data.missingPoints, fallback.missingPoints),
      percentage,
      score,
    }
  } catch {
    return fallback
  }
}

export async function POST(req: Request) {
  let userId: string | undefined

  try {
    try {
      const auth = await requireAuth(req)
      if (auth.error) return auth.error
      userId = auth.user?.id
    } catch {
      userId = undefined
    }

    const body = (await req.json()) as Record<string, unknown>
    const answer = cleanString(body.answer, '')
    const markScheme = cleanString(body.markScheme, '')
    const questionText = cleanString(body.questionText, 'Mock question')
    const subject = cleanString(body.subject, 'General')
    const topic = cleanString(body.topic, subject)
    const level = cleanString(body.level, 'A Level')
    const board = cleanString(body.board, 'Cambridge')
    const paper = cleanString(body.paper, 'Paper 2')
    const difficulty = cleanString(body.difficulty, 'medium')
    const marks = Math.max(1, Math.min(30, Number(body.marks ?? 4) || 4))

    if (!answer) return json({ error: 'Write an answer first.' }, 400)

    const grade = markScheme
      ? await gradeWithMarkScheme({ answer, markScheme, marks, questionText })
      : fallbackGrade(answer, questionText, marks)

    if (userId) {
      try {
        await trackSolvedTopic({
          userId,
          subject,
          topic,
          isCorrect: grade.isCorrect,
          confidenceScore: grade.percentage,
          profile: { board, level },
        })
      } catch {}
    }

    let savedAttempt = false
    if (isUuid(userId)) {
      try {
        const supabase = getSupabaseAdmin()
        const { error } = await supabase.from('mock_attempts').insert({
          user_id: userId,
          level,
          board,
          subject,
          topic,
          score: grade.score,
          total_marks: grade.totalMarks,
          feedback_json: {
            ...grade,
            paper,
            difficulty,
            questionText,
            label: 'Past paper mark scheme',
          },
        })
        if (!error) savedAttempt = true
      } catch {
        savedAttempt = false
      }
    }

    return json({
      success: true,
      label: 'Past paper mark scheme',
      grade,
      savedAttempt,
    })
  } catch (error) {
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Could not grade mock answer.',
      grade: fallbackGrade('', '', 4),
      savedAttempt: false,
      recovered: true,
    })
  }
}
