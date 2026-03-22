import { browseQbankPapers } from '@/lib/server/qbank-papers'

function parseYear(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const board = url.searchParams.get('board')
    const level = url.searchParams.get('level')
    const subject = url.searchParams.get('subject')
    const year = parseYear(url.searchParams.get('year'))
    const limit = parseYear(url.searchParams.get('limit'))

    const result = await browseQbankPapers({
      board,
      level,
      subject,
      year,
      limit,
    })

    return Response.json({
      filters: {
        board,
        level,
        subject,
        year,
        limit,
      },
      enabled: result.enabled,
      sourceMode: result.source,
      matches: result.matches,
    })
  } catch (error) {
    console.error('QBank catalog API error:', error)
    return Response.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
