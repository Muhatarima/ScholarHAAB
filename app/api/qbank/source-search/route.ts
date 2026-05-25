import { NextResponse } from 'next/server'
import { parseQbankQuery } from '@/lib/server/qbank'
import { searchQbankSources } from '@/lib/server/qbank-sources'
import { withApiGuard } from '@/lib/server/api-guard'
import { readJsonBody } from '@/lib/server/request-body'
import { requireAuth } from '@/lib/auth/requireAuth'
import { validateQuestion } from '@/lib/validation/inputValidator'

export async function POST(req: Request) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError

  return withApiGuard(req, { product: 'qbank', messageHint: 'paper 2023' }, async (req) => {
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

    const parsedQuery = parseQbankQuery(query)
    const result = await searchQbankSources(parsedQuery)

    return NextResponse.json({
      query,
      parsedQuery,
      enabled: result.enabled,
      sourceMode: result.source,
      matches: result.matches,
    })
  })
}
