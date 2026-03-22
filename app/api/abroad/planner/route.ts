import { buildAbroadPlan } from '@/lib/server/abroad-planner'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const query = typeof body?.query === 'string' ? body.query.trim() : ''

    if (!query) {
      return Response.json({ error: 'Planning query is required' }, { status: 400 })
    }

    return Response.json(buildAbroadPlan(query))
  } catch (error) {
    console.error('Abroad planner API error:', error)
    return Response.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
