import { NextResponse } from 'next/server'
import { syllabusCompletionMap } from '@/lib/progress/tracker'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/requireAuth'

type RouteContext = {
  params: Promise<{
    subject: string
  }>
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, context: RouteContext) {
  const { error: authError } = await requireAuth(_req)
  if (authError) return authError

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 })
  }

  const { subject } = await context.params
  const map = await syllabusCompletionMap(user.id, decodeURIComponent(subject))

  return NextResponse.json({
    subject: decodeURIComponent(subject),
    map,
  })
}
