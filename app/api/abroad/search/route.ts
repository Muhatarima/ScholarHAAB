import { getAbroadScholarshipStats, searchAbroadScholarshipsWithDb } from '@/lib/server/abroad'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const query = typeof body?.query === 'string' ? body.query.trim() : ''

    if (!query) {
      return Response.json({ error: 'Query is required' }, { status: 400 })
    }

    const result = await searchAbroadScholarshipsWithDb(query, 8)
    return Response.json({
      query,
      sourceMode: result.source,
      parsedQuery: result.parsed,
      matches: result.matches,
      stats: getAbroadScholarshipStats(),
    })
  } catch (error) {
    console.error('Abroad search API error:', error)
    return Response.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
