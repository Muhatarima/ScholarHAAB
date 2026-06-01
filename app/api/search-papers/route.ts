export const runtime = 'nodejs'
export const maxDuration = 30
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { classifyIntent } from '@/lib/rag/classifyIntent'
import { retrievePastPaper } from '@/lib/rag/retrievePastPaper'
import { getStudentProfile } from '@/lib/server/profile'

export async function POST(req: Request) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError

  try {
    const body = (await req.json()) as Record<string, unknown>
    const query = String(body.query ?? body.message ?? '').trim()
    if (!query) return NextResponse.json({ error: 'query is required' }, { status: 400 })

    const intent = classifyIntent(query)
    const profile = user?.id && user.id !== 'test-anonymous-user'
      ? await getStudentProfile(user.id).catch(() => null)
      : {
          preferredBoard: 'Cambridge',
          preferredLevel: 'O Level',
          preferredSubjects: ['Physics', 'Chemistry'],
        }
    const profileSubjects = profile?.preferredSubjects ?? []
    const subject = intent.subject ?? (profileSubjects.length === 1 ? profileSubjects[0] : undefined)
    const subjectWarning =
      intent.subject && profileSubjects.length > 0 && !profileSubjects.some((item) => item.toLowerCase() === intent.subject?.toLowerCase())
        ? `${intent.subject} is not in your study profile. Add it in settings or search anyway.`
        : null
    const results = await retrievePastPaper(
      intent.normalizedQuery,
      {
        subject,
        level: intent.level ?? profile?.preferredLevel ?? undefined,
        board: intent.board?.toLowerCase() ?? profile?.preferredBoard?.toLowerCase() ?? undefined,
        topic: intent.topic ?? undefined,
        year_from: intent.year ?? undefined,
        year_to: intent.year ?? undefined,
      },
      Number.isFinite(Number(body.limit)) ? Math.max(1, Math.min(10, Number(body.limit))) : 5
    )

    return NextResponse.json({
      intent,
      profileFilters: {
        board: intent.board ?? profile?.preferredBoard ?? null,
        level: intent.level ?? profile?.preferredLevel ?? null,
        subjects: profileSubjects,
      },
      subjectWarning,
      results,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Search failed.' },
      { status: 500 }
    )
  }
}
