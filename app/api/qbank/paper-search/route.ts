import { parseQbankQuery } from '@/lib/server/qbank'
import { searchQbankPapers } from '@/lib/server/qbank-papers'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const query = typeof body?.query === 'string' ? body.query.trim() : ''

    if (!query) {
      return Response.json({ error: 'Query is required' }, { status: 400 })
    }

    const parsedQuery = parseQbankQuery(query)
    const result = await searchQbankPapers(parsedQuery)

    return Response.json({
      query,
      parsedQuery,
      enabled: result.enabled,
      sourceMode: result.source,
      matches: result.matches,
    })
  } catch (error) {
    console.error('QBank paper search API error:', error)
    return Response.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
