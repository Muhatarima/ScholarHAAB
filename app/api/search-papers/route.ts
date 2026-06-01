export const runtime = 'nodejs'
export const maxDuration = 30
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { classifyIntent } from '@/lib/rag/classifyIntent'
import { retrievePastPaper } from '@/lib/rag/retrievePastPaper'

export async function POST(req: Request) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError

  try {
    const body = (await req.json()) as Record<string, unknown>
    const query = String(body.query ?? body.message ?? '').trim()
    if (!query) return NextResponse.json({ error: 'query is required' }, { status: 400 })

    const intent = classifyIntent(query)
    const results = await retrievePastPaper(
      intent.normalizedQuery,
      {
        subject: intent.subject ?? undefined,
        level: intent.level ?? undefined,
        board: intent.board?.toLowerCase(),
        topic: intent.topic ?? undefined,
        year_from: intent.year ?? undefined,
        year_to: intent.year ?? undefined,
      },
      Number.isFinite(Number(body.limit)) ? Math.max(1, Math.min(10, Number(body.limit))) : 5
    )

    return NextResponse.json({ intent, results })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Search failed.' },
      { status: 500 }
    )
  }
}
