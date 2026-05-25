import { NextResponse } from 'next/server'
import {
  analyzePaperPatterns,
  generateExamBriefing,
  predictNextExam,
} from '@/lib/ai/examPredictor'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/requireAuth'

type RouteContext = {
  params: Promise<{
    subject: string
    paper: string
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

  const { subject, paper } = await context.params
  const url = new URL(req.url)
  const level = url.searchParams.get('level') ?? 'A Level'
  const examYear = Number(url.searchParams.get('year') ?? new Date().getFullYear())
  const decodedSubject = decodeURIComponent(subject)
  const decodedPaper = decodeURIComponent(paper)

  const [analysis, predictions, briefing] = await Promise.all([
    analyzePaperPatterns(decodedSubject, level, decodedPaper),
    predictNextExam(decodedSubject, level, decodedPaper, examYear),
    generateExamBriefing(decodedSubject, level, decodedPaper),
  ])

  return NextResponse.json({
    subject: decodedSubject,
    level,
    paper: decodedPaper,
    analysis,
    predictions,
    briefing,
  })
}
