export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { getDashboardData } from '@/lib/progress/progressEngine'
import { trackSolvedTopic } from '@/lib/progress/autoTrack'

export async function GET(req: Request) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const dashboard = await getDashboardData(user.id)
    return NextResponse.json({ dashboard })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not load progress.' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = (await req.json()) as Record<string, unknown>
    const subject = String(body.subject ?? '').trim() || 'General'
    const topic = String(body.topic ?? '').trim() || 'General'
    const isCorrect = typeof body.isCorrect === 'boolean' ? body.isCorrect : undefined
    const confidenceScore = Number.isFinite(Number(body.confidenceScore)) ? Number(body.confidenceScore) : undefined
    await trackSolvedTopic({ userId: user.id, subject, topic, isCorrect, confidenceScore })
    return NextResponse.json({ saved: true, subject, topic })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not update progress.' },
      { status: 400 }
    )
  }
}
