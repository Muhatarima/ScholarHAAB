import { NextResponse } from 'next/server'
import { searchSimilarQuestions, type QuestionSearchFilters } from '@/lib/rag/ragSystem'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { validateQuestion } from '@/lib/validation/inputValidator'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const rawQuery = typeof body.query === 'string' ? body.query.trim() : ''
  if (!rawQuery) {
    return NextResponse.json({ error: 'query is required' }, { status: 400 })
  }

  let query: string
  try {
    query = validateQuestion(rawQuery)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid query' },
      { status: 400 }
    )
  }

  const filters: QuestionSearchFilters = {
    subject: typeof body.subject === 'string' ? body.subject : undefined,
    level: typeof body.level === 'string' ? body.level : undefined,
    board: typeof body.board === 'string' ? body.board : undefined,
    topic: typeof body.topic === 'string' ? body.topic : undefined,
    difficulty: typeof body.difficulty === 'string' ? body.difficulty : undefined,
    year_from: typeof body.year_from === 'number' ? body.year_from : undefined,
    year_to: typeof body.year_to === 'number' ? body.year_to : undefined,
  }

  const limit = typeof body.limit === 'number' ? Math.min(Math.max(body.limit, 1), 20) : 5
  const results = await searchSimilarQuestions(query, filters, limit)

  return NextResponse.json({
    query,
    filters,
    results,
  })
}

export async function GET(req: Request) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError

  const url = new URL(req.url)
  const rawQuery = url.searchParams.get('q')?.trim() ?? ''
  if (!rawQuery) {
    return NextResponse.json({ error: 'q is required' }, { status: 400 })
  }

  let query: string
  try {
    query = validateQuestion(rawQuery)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid query' },
      { status: 400 }
    )
  }

  const filters: QuestionSearchFilters = {
    subject: url.searchParams.get('subject') ?? undefined,
    level: url.searchParams.get('level') ?? undefined,
    board: url.searchParams.get('board') ?? undefined,
    topic: url.searchParams.get('topic') ?? undefined,
    difficulty: url.searchParams.get('difficulty') ?? undefined,
    year_from: url.searchParams.get('year_from') ? Number(url.searchParams.get('year_from')) : undefined,
    year_to: url.searchParams.get('year_to') ? Number(url.searchParams.get('year_to')) : undefined,
  }

  const results = await searchSimilarQuestions(query, filters, 5)
  return NextResponse.json({ query, filters, results })
}
