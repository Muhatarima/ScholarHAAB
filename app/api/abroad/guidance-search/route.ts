import { getAbroadGuidanceStats, searchAbroadGuidanceWithDb } from '@/lib/server/abroad-guidance'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const query = typeof body?.query === 'string' ? body.query.trim() : ''

    if (!query) {
      return Response.json({ error: 'Query is required' }, { status: 400 })
    }

    const result = await searchAbroadGuidanceWithDb(query, 8)
    return Response.json({
      query,
      sourceMode: result.source,
      parsedQuery: result.parsed,
      matches: result.matches,
      stats: getAbroadGuidanceStats(),
    })
  } catch (error) {
    console.error('Abroad guidance search API error:', error)
    return Response.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
