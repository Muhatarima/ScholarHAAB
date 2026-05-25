import { NextResponse } from 'next/server'
import { calculateTopicMastery } from '@/lib/progress/tracker'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/requireAuth'

type RouteContext = {
  params: Promise<{
    topic: string
  }>
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request, context: RouteContext) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 })
  }

  const { topic } = await context.params
  const url = new URL(req.url)
  const subject = url.searchParams.get('subject') ?? 'Physics'
  const mastery = await calculateTopicMastery(user.id, subject, decodeURIComponent(topic))

  return NextResponse.json({ mastery })
}
