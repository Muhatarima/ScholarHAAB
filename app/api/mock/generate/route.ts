import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { getPastPaperQuestions } from '@/lib/mock/pastPaperDocuments'

export const runtime = 'nodejs'
export const maxDuration = 30
export const dynamic = 'force-dynamic'

function clean(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 200) : fallback
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function POST(req: Request) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError

  try {
    const body = (await req.json()) as Record<string, unknown>
    const subject = clean(body.subject, 'Physics')
    const topic = clean(body.topic)
    const count = Math.max(1, Math.min(10, Number(body.count ?? body.questionCount ?? 1) || 1))

    if (!subject || !topic) {
      return json({ error: 'Subject and topic are required.' }, 400)
    }

    const questions = await getPastPaperQuestions({ count, subject, topic })

    if (!questions.length) {
      return json(
        {
          error: `No real past paper questions found for ${subject} / ${topic}. Try another topic name from the database.`,
          questions: [],
        },
        404
      )
    }

    return json({
      questions,
      subject,
      topic,
      type: 'past_paper_mock',
    })
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'Could not load past paper questions.' },
      500
    )
  }
}
