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

function clean(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 200) : fallback
}

function safeQuestion(input: {
  subject: string
  topic: string
  level: string
  board: string
  paper: string
  difficulty: string
}) {
  const marks = 5
  return {
    id: `safe-${Date.now()}`,
    questionText:
      `Exam-style ${input.subject} question on ${input.topic}: explain the key idea and apply it clearly using syllabus keywords.`,
    markScheme:
      `Award marks for: correct definition or formula; clear application to ${input.topic}; correct units or keywords where relevant; final conclusion.`,
    marks,
    subject: input.subject,
    topic: input.topic,
    level: input.level,
    board: input.board,
    paper: input.paper,
    difficulty: input.difficulty,
  }
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function POST(req: Request) {
  let userId = 'demo-user'
  let body: Record<string, unknown> = {}

  try {
    try {
      const auth = await requireAuth(req)
      if (auth.error) return auth.error
      if (auth.user?.id) userId = auth.user.id
    } catch {
      userId = 'demo-user'
    }

    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return json({ error: 'Invalid JSON body.' }, 400)
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

    const type = clean(body.type, 'question')
    const difficulty = clean(body.difficulty, 'medium')
    const count = Math.max(1, Math.min(10, Number(body.count ?? 1) || 1))

    try {
      if (type === 'paper') {
        const mockPaper = await generateFullMockPaper(subject, level, paper, userId)
        return json({
          type: 'paper',
          label: 'Exam-style mock based on A/O Level pattern',
          board,
          mockPaper,
        })
      }

      if (type === 'drill') {
        const questions = await generateTargetedDrillSet(userId, topic, count, {
          subject,
          level,
          paper,
        })

        return json({
          type: 'drill',
          label: 'Exam-style mock based on A/O Level pattern',
          board,
          level,
          subject,
          paper,
          questions,
        })
      }

      const question = await generateMockQuestion(subject, topic, difficulty, userId, level, paper)
      return json({
        type: 'question',
        label: 'Exam-style mock based on A/O Level pattern',
        board,
        level,
        subject,
        paper,
        question,
      })
    } catch {
      const question = safeQuestion({ subject, topic, level, board, paper, difficulty })
      const questions = Array.from({ length: count }, (_, index) => ({
        ...question,
        id: `${question.id}-${index + 1}`,
        questionText:
          count > 1
            ? `Question ${index + 1}: ${question.questionText}`
            : question.questionText,
      }))

      return json({
        type: count > 1 ? 'drill' : 'question',
        label: 'Exam-style mock fallback',
        board,
        level,
        subject,
        paper,
        question: questions[0],
        questions,
        recovered: true,
      })
    }
  } catch (error) {
    return json(
      {
        error: error instanceof Error ? error.message : 'Could not generate mock.',
        recovered: true,
      },
      200
    )
  }
}
