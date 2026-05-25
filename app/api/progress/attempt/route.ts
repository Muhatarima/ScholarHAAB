import { NextResponse } from 'next/server'
import { trackAttempt } from '@/lib/progress/progressEngine'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/requireAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function stringField(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function numberField(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export async function POST(req: Request) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const questionId = stringField(body.questionId, '')
  if (!questionId) {
    return NextResponse.json({ error: 'questionId is required' }, { status: 400 })
  }

  const marksObtained = numberField(body.marksObtained, 0)
  const marksAvailable = Math.max(1, numberField(body.marksAvailable, 1))
  const isCorrect =
    typeof body.isCorrect === 'boolean' ? body.isCorrect : marksObtained / marksAvailable >= 0.6

  await trackAttempt({
    studentId: user.id,
    questionId,
    subject: stringField(body.subject, 'General'),
    topic: stringField(body.topic, 'General'),
    subtopic: typeof body.subtopic === 'string' ? body.subtopic : null,
    difficulty: typeof body.difficulty === 'string' ? body.difficulty : 'medium',
    isCorrect,
    marksObtained,
    marksAvailable,
    timeSeconds: numberField(body.timeSeconds ?? body.timeTakenSeconds, 0),
    mistakeType: typeof body.mistakeType === 'string' ? body.mistakeType : null,
    studentAnswer: typeof body.answer === 'string' ? body.answer : null,
    correctAnswer: typeof body.correctAnswer === 'string' ? body.correctAnswer : null,
    aiFeedback: typeof body.aiFeedback === 'string' ? body.aiFeedback : null,
    confidenceLevel: typeof body.confidenceLevel === 'string' ? body.confidenceLevel : null,
  })

  return NextResponse.json({
    saved: true,
    topic: stringField(body.topic, 'General'),
    isCorrect,
    marksObtained,
    marksAvailable,
  })
}
