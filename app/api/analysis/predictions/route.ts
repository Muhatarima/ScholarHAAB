import { NextResponse } from 'next/server'
import { generateExamPredictions } from '@/lib/analysis/qbankAnalyzer'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/requireAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 })
  }

  const url = new URL(req.url)
  const subject = url.searchParams.get('subject') ?? 'Physics'
  const level = url.searchParams.get('level') ?? 'O Level'
  const paper = url.searchParams.get('paper') ?? 'Paper 2'
  const predictions = await generateExamPredictions(subject, level, paper)

  return NextResponse.json(
    { subject, level, paper, predictions },
    {
      headers: {
        'Cache-Control': 'private, max-age=86400',
      },
    }
  )
}
