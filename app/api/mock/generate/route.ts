import { NextResponse } from 'next/server'
import {
  generateFullMockPaper,
  generateMockQuestion,
  generateTargetedDrillSet,
} from '@/lib/ai/mockGenerator'
import { requireAuth } from '@/lib/auth/requireAuth'
import { handleApiError } from '@/lib/errors/AppError'
import { validateQuestion, validateSubject } from '@/lib/validation/inputValidator'

export const runtime = 'nodejs'
export const maxDuration = 30
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError

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
  let board = 'Cambridge'
  let paper = 'Paper 2'
  let topic = 'Physics'
  try {
    subject = validateSubject(body.subject)
    level = typeof body.level === 'string' ? validateQuestion(body.level) : 'A Level'
    board = typeof body.board === 'string' ? validateQuestion(body.board) : 'Cambridge'
    paper = typeof body.paper === 'string' ? validateQuestion(body.paper) : 'Paper 2'
    topic = typeof body.topic === 'string' ? validateQuestion(body.topic) : subject
  } catch (error) {
    return handleApiError(error)
  }
  const type = typeof body.type === 'string' ? body.type : 'question'

  if (type === 'paper') {
    const mockPaper = await generateFullMockPaper(subject, level, paper, user.id)
    return NextResponse.json({
      type: 'paper',
      label: 'AI-generated mock based on A/O Level pattern',
      board,
      mockPaper,
    })
  }

  if (type === 'drill') {
    const count = Math.max(1, Math.min(10, Number(body.count ?? 5)))
    const questions = await generateTargetedDrillSet(user.id, topic, count)
    return NextResponse.json({
      type: 'drill',
      label: 'AI-generated mock based on A/O Level pattern',
      board,
      level,
      subject,
      paper,
      questions,
    })
  }

  const difficulty = typeof body.difficulty === 'string' ? body.difficulty : 'medium'
  const question = await generateMockQuestion(subject, topic, difficulty, user.id, level, paper)
  return NextResponse.json({
    type: 'question',
    label: 'AI-generated mock based on A/O Level pattern',
    board,
    level,
    subject,
    paper,
    question,
  })
}
