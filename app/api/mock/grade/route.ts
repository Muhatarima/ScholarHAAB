import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'
import { trackSolvedTopic } from '@/lib/progress/autoTrack'
import { gradeMockAnswer } from '@/lib/mock/gradeMock'

export const runtime = 'nodejs'
export const maxDuration = 30
export const dynamic = 'force-dynamic'

function isUuid(value: string | undefined): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
}

function cleanString(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 4000) : fallback
}

export async function POST(req: Request) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 })

  try {
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

    if (!answer) return NextResponse.json({ error: 'Write an answer first.' }, { status: 400 })
    if (!markScheme) return NextResponse.json({ error: 'Missing mark scheme.' }, { status: 400 })

    const grade = gradeMockAnswer({ answer, markScheme, marks })

    await trackSolvedTopic({
      userId: user.id,
      subject,
      topic,
      isCorrect: grade.isCorrect,
      confidenceScore: grade.percentage,
      profile: { board, level },
    })

    let savedAttempt = false
    if (isUuid(user.id)) {
      try {
        const supabase = getSupabaseAdmin()
        const { error } = await supabase.from('mock_attempts').insert({
          user_id: user.id,
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
            label: 'AI-generated mock based on A/O Level pattern',
          },
        })
        if (!error) savedAttempt = true
      } catch {
        savedAttempt = false
      }
    }

    return NextResponse.json({
      success: true,
      label: 'AI-generated mock based on A/O Level pattern',
      grade,
      savedAttempt,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not grade mock answer.' },
      { status: 400 }
    )
  }
}
