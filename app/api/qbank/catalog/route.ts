import { cookies } from 'next/headers'
import { resolveRequestIdentity } from '@/lib/server/auth'
import { browseQbankPapers } from '@/lib/server/qbank-papers'
import { createRequestId, logError } from '@/lib/server/logger'
import { requireAuth } from '@/lib/auth/requireAuth'

function parseYear(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function GET(req: Request) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError

  const requestId = createRequestId()

  try {
    const cookieStore = await cookies()
    const identity = await resolveRequestIdentity(cookieStore)

    if (!identity.isAuthenticated) {
      return Response.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401, headers: { 'x-request-id': requestId } }
      )
    }

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
    }, {
      headers: { 'x-request-id': requestId },
    })
  } catch (error) {
    logError('qbank_catalog_failed', error, {
      request_id: requestId,
      route: '/api/qbank/catalog',
    })
    return Response.json(
      { error: 'Something went wrong' },
      { status: 500, headers: { 'x-request-id': requestId } }
    )
  }
}
