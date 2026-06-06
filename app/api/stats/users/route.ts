// app/api/stats/users/route.ts
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = getSupabaseAdmin()

    // Get total user count via auth admin — no custom table/RPC needed
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 })
    if (error) throw error

    // data.total = total users in auth.users
    // Subtract obvious test accounts from the total
    const { data: allData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const smokeCount = (allData?.users ?? []).filter(
      (u) => u.email?.includes('auth-smoke') || u.email?.endsWith('@test.com')
    ).length

    const realCount = Math.max(0, (data.total ?? 0) - smokeCount)

    return NextResponse.json(
      { count: realCount },
      { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' } }
    )
  } catch {
    return NextResponse.json({ count: 0 })
  }
}