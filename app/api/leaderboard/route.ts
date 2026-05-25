import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { getLeaderboard, getUserRank } from '@/lib/analytics/leaderboard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError

  const url = new URL(req.url)
  const limit = Number(url.searchParams.get('limit') ?? 10)
  const [rows, rank] = await Promise.all([getLeaderboard(limit), getUserRank(user?.id)])

  return NextResponse.json({ leaderboard: rows, userRank: rank })
}
