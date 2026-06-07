import { NextResponse } from 'next/server'
import { requireRealAuth } from '@/lib/auth/requireAuth'
import { createRouteHandlerClient } from '@/lib/supabase/route'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const { user, error } = await requireRealAuth(req)
  if (error) return error
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createRouteHandlerClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, setup_completed, updated_at')
    .eq('id', user.id)
    .maybeSingle()

  return NextResponse.json(
    {
      authenticated: true,
      profile: profile ?? null,
      user: {
        email: user.email ?? null,
        id: user.id,
      },
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
