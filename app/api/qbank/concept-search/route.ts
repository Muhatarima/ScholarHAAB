import { parseQbankQuery } from '@/lib/server/qbank'
import { getQbankConceptStats, searchQbankConcepts } from '@/lib/server/qbank-concepts'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const query = typeof body?.query === 'string' ? body.query.trim() : ''

    if (!query) {
      return Response.json({ error: 'Query is required' }, { status: 400 })
    }

    const parsed = parseQbankQuery(query)
    const result = await searchQbankConcepts(parsed)

    return Response.json({
      query,
      sourceMode: result.source,
      parsedQuery: parsed,
      matches: result.matches,
      stats: getQbankConceptStats(),
    })
  } catch (error) {
    console.error('QBank concept search API error:', error)
    return Response.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
