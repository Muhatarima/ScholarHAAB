import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getAdminStats, getActiveUsers, getRecentLogs } from '@/lib/admin/data'
import { resolveRequestIdentity } from '@/lib/server/auth'
import { isAdminUser } from '@/lib/server/admin'
import { createRequestId, logError } from '@/lib/server/logger'
import { requireAuth } from '@/lib/auth/requireAuth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError

  const requestId = createRequestId()

  try {
    const cookieStore = await cookies()
    const identity = await resolveRequestIdentity(cookieStore, req.headers)
    if (!identity.isAuthenticated || !(await isAdminUser(identity.authUserId))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'x-request-id': requestId } })
    }

    const [stats, logs, activeUsers] = await Promise.all([
      getAdminStats(),
      getRecentLogs(50),
      getActiveUsers(7),
    ])

    return NextResponse.json(
      {
        success: true,
        stats,
        logs,
        activeUsers,
      },
      { headers: { 'x-request-id': requestId } }
    )
  } catch (error) {
    logError('admin_stats_failed', error, { request_id: requestId, route: '/api/admin/stats' })
    return NextResponse.json(
      { success: false, error: 'Could not load admin stats.' },
      { status: 500, headers: { 'x-request-id': requestId } }
    )
  }
}
