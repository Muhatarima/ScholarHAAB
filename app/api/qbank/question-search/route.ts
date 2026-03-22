import { parseQbankQuery, searchQbankQuestions } from '@/lib/server/qbank'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const query = typeof body?.query === 'string' ? body.query.trim() : ''

    if (!query) {
      return Response.json({ error: 'Query is required' }, { status: 400 })
    }

    const result = await searchQbankQuestions(query)
    return Response.json({
      query,
      parsedQuery: parseQbankQuery(query),
      enabled: result.enabled,
      sourceMode: result.source,
      matches: result.matches,
    })
  } catch (error) {
    console.error('QBank question search API error:', error)
    return Response.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
