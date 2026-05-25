import { NextResponse } from 'next/server'
import { parseQbankQuery } from '@/lib/server/qbank'
import { getQbankConceptStats, searchQbankConcepts } from '@/lib/server/qbank-concepts'
import { withApiGuard } from '@/lib/server/api-guard'
import { readJsonBody } from '@/lib/server/request-body'
import { requireAuth } from '@/lib/auth/requireAuth'
import { validateQuestion } from '@/lib/validation/inputValidator'

export async function POST(req: Request) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError

  return withApiGuard(req, { product: 'qbank', messageHint: 'topic' }, async (req) => {
    const body = await readJsonBody(req)
    const rawQuery = typeof body.query === 'string' ? body.query.trim() : ''

    if (!rawQuery) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    let query: string
    try {
      query = validateQuestion(rawQuery)
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Invalid query' },
        { status: 400 }
      )
    }

    const parsed = parseQbankQuery(query)
    const result = await searchQbankConcepts(parsed)

    return NextResponse.json({
      query,
      sourceMode: result.source,
      parsedQuery: parsed,
      matches: result.matches,
      stats: getQbankConceptStats(),
    })
  })
}
