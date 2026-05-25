import { NextResponse } from 'next/server'
import { generateExamBriefing } from '@/lib/ai/examPredictor'
import { updateMemoryAfterSession } from '@/lib/memory/studentMemory'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { handleApiError } from '@/lib/errors/AppError'
import { validateQuestion, validateSubject } from '@/lib/validation/inputValidator'

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

  let subject = 'Physics'
  let level = 'A Level'
  let paper = 'Paper 1'
  try {
    subject = validateSubject(body.subject)
    level = typeof body.level === 'string' ? validateQuestion(body.level) : 'A Level'
    paper = typeof body.paper === 'string' ? validateQuestion(body.paper) : 'Paper 1'
  } catch (error) {
    return handleApiError(error)
  }
  const examAt = typeof body.examAt === 'string' ? body.examAt : null
  const briefing = await generateExamBriefing(subject, level, paper)

  await updateMemoryAfterSession(user.id, {
    subject,
    topic: paper,
    sessionType: 'emergency',
    aiNotes: `Emergency mode activated for ${level} ${subject} ${paper}.`,
  })

  return NextResponse.json({
    activated: true,
    subject,
    level,
    paper,
    examAt,
    briefing,
    phases: [
      'Hour 1: top predicted topics and speed drills',
      'Hour 2: weak-topic rapid revision and formula sheet',
      'Hour 3: mini mock, instant marking, final tips',
    ],
  })
}
