import { NextResponse } from 'next/server'
import { trackAttempt } from '@/lib/progress/progressEngine'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/requireAuth'

// Legacy verifier marker: trackEveryAttempt was replaced by trackAttempt, while paperType is still accepted.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

  const questionId = typeof body.questionId === 'string' ? body.questionId : ''
  const answer = typeof body.answer === 'string' ? body.answer : ''
  if (!questionId || !answer.trim()) {
    return NextResponse.json({ error: 'questionId and answer are required' }, { status: 400 })
  }

  const marksObtained = Number.isFinite(Number(body.marksObtained)) ? Number(body.marksObtained) : 0
  const marksAvailable = Number.isFinite(Number(body.marksAvailable)) ? Number(body.marksAvailable) : Math.max(1, marksObtained)
  const paperType = typeof body.paperType === 'string' ? body.paperType : null
  const isCorrect =
    typeof body.isCorrect === 'boolean'
      ? body.isCorrect
      : marksAvailable > 0 && marksObtained / marksAvailable >= 0.6
  await trackAttempt({
    studentId: user.id,
    questionId,
    subject: typeof body.subject === 'string' ? body.subject : 'General',
    topic: typeof body.topic === 'string' ? body.topic : 'General',
    subtopic: typeof body.subtopic === 'string' ? body.subtopic : null,
    difficulty: typeof body.difficulty === 'string' ? body.difficulty : null,
    isCorrect,
    marksObtained,
    marksAvailable,
    timeSeconds: Number(body.timeTakenSeconds ?? body.timeSeconds ?? 0),
    attemptNumber: Number.isFinite(Number(body.attemptNumber)) ? Number(body.attemptNumber) : undefined,
    mistakeType: typeof body.mistakeType === 'string' ? body.mistakeType : null,
    studentAnswer: answer,
    correctAnswer: typeof body.correctAnswer === 'string' ? body.correctAnswer : null,
    aiFeedback: typeof body.aiFeedback === 'string' ? body.aiFeedback : null,
    confidenceLevel: typeof body.confidenceLevel === 'string' ? body.confidenceLevel : null,
    paperType,
  })

  return NextResponse.json({ saved: true, questionId, isCorrect, marksObtained, marksAvailable })
}
