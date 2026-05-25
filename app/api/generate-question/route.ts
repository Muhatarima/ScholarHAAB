import { requireAuth } from '@/lib/auth/requireAuth'
import { checkRateLimit } from '@/lib/rateLimit/rateLimiter'
import {
  formatQuestionCard,
  generateAdaptiveQuestion,
  gradeAdaptiveAnswer,
  type Question,
} from '@/lib/ai/questionGenerator'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

export async function POST(req: Request) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError

  const demoMode =
    process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ||
    process.env.DEMO_MODE === 'true' ||
    process.env.NODE_ENV === 'development'

  if (!demoMode) {
    const rateCheck = checkRateLimit({
      maxRequests: 30,
      windowMs: 60 * 60 * 1000,
      identifier: `generate_question_${user?.id ?? 'anonymous'}`,
    })

    if (!rateCheck.allowed) {
      return Response.json({ error: 'Rate limit reached.' }, { status: 429 })
    }
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const subject = asString(body.subject, 'Physics')
  const topic = asString(body.topic, '')
  const userId = user?.id ?? 'test-anonymous-user'

  if (body.mode === 'grade' || body.action === 'grade') {
    const question = body.question as Question | undefined
    const studentAnswer = asString(body.answer || body.studentAnswer, '')

    if (!question || !studentAnswer) {
      return Response.json({ error: 'question and answer are required for grading' }, { status: 400 })
    }

    const result = await gradeAdaptiveAnswer({
      userId,
      subject: question.subject || subject,
      topic: question.topic || topic || 'General',
      studentAnswer,
      question,
    })

    return Response.json({ result, ...result })
  }

  const question = await generateAdaptiveQuestion(userId, subject, topic || undefined)
  const card = formatQuestionCard(question)

  return Response.json({
    question,
    card,
    answer: card,
    response: card,
    mode: 'adaptive_question_generator',
  })
}
