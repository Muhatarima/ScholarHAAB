import { getAbroadScholarshipStats } from '@/lib/server/abroad'

export async function GET() {
  try {
    return Response.json(getAbroadScholarshipStats())
  } catch (error) {
    console.error('Abroad stats API error:', error)
    return Response.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
