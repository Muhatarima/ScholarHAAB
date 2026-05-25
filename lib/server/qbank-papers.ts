import fs from 'node:fs'
import path from 'node:path'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'
import type { QbankParsedQuery } from '@/lib/server/qbank'

type QbankPaperRow = {
  id: string
  board: string
  level: string
  subject: string
  year?: number | null
  paper: string
  paper_code?: string | null
  paper_title: string
  session?: string | null
  focus_topics?: string[]
  source_label?: string | null
  source_url?: string | null
  quality_tier?: string | null
}

export type QbankPaperMatch = {
  id: string
  board: string
  level: string
  subject: string
  year: number | null
  paper: string
  paperCode: string | null
  paperTitle: string
  session: string | null
  focusTopics: string[]
  sourceLabel: string | null
  sourceUrl: string | null
  qualityTier: string | null
}

export type QbankPaperCatalogFilters = {
  board?: string | null
  level?: string | null
  subject?: string | null
  year?: number | null
  limit?: number | null
}

const DATA_DIR = path.join(process.cwd(), 'data')
let cachedPaperRows: QbankPaperRow[] | null = null

function isMissingPaperTableError(error: unknown): boolean {
  const code = (error as { code?: string })?.code
  const message = String((error as { message?: string })?.message ?? '')
  return code === '42P01' || code === 'PGRST205' || /qbank_papers/i.test(message)
}

function getPaperRows() {
  if (cachedPaperRows) {
    return cachedPaperRows
  }

  if (!fs.existsSync(DATA_DIR)) {
    cachedPaperRows = []
    return cachedPaperRows
  }

  const manifestFiles = fs
    .readdirSync(DATA_DIR)
    .filter((file) => /^qbank_paper.*\.jsonl$/i.test(file))
    .sort()

  cachedPaperRows = manifestFiles.flatMap((file) =>
    fs
      .readFileSync(path.join(DATA_DIR, file), 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as QbankPaperRow)
  )

  return cachedPaperRows
}

function matchesParsedQuery(row: QbankPaperRow, parsedQuery: QbankParsedQuery) {
  if (parsedQuery.board && !row.board.toLowerCase().includes(parsedQuery.board.toLowerCase())) {
    return false
  }

  if (parsedQuery.level && !row.level.toLowerCase().includes(parsedQuery.level.toLowerCase())) {
    return false
  }

  if (parsedQuery.subject && !row.subject.toLowerCase().includes(parsedQuery.subject.toLowerCase())) {
    return false
  }

  if (parsedQuery.year && row.year && row.year !== parsedQuery.year) {
    return false
  }

  if (parsedQuery.paper) {
    const normalizedRowPaper = `${row.paper} ${row.paper_code ?? ''} ${row.paper_title}`.toLowerCase()
    const normalizedQueryPaper = parsedQuery.paper.toLowerCase()
    if (
      !normalizedRowPaper.includes(normalizedQueryPaper) &&
      !normalizedQueryPaper.includes((row.paper ?? '').toLowerCase())
    ) {
      return false
    }
  }

  return true
}

function scorePaper(row: QbankPaperRow, parsedQuery: QbankParsedQuery) {
  let score = 0
  const haystack = [
    row.board,
    row.level,
    row.subject,
    row.paper,
    row.paper_code,
    row.paper_title,
    row.session,
    ...(row.focus_topics ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  for (const token of parsedQuery.normalized.split(' ')) {
    if (token.length > 2 && haystack.includes(token)) {
      score += 3
    }
  }

  if (parsedQuery.year && row.year === parsedQuery.year) {
    score += 6
  }

  if (parsedQuery.paper && haystack.includes(parsedQuery.paper.toLowerCase())) {
    score += 6
  }

  if (parsedQuery.paper && row.paper.toLowerCase() === parsedQuery.paper.toLowerCase()) {
    score += 10
  }

  if (parsedQuery.subject && row.subject.toLowerCase().includes(parsedQuery.subject.toLowerCase())) {
    score += 4
  }

  if (parsedQuery.board && row.board.toLowerCase().includes(parsedQuery.board.toLowerCase())) {
    score += 4
  }

  if (parsedQuery.topicHints.some((topic) => haystack.includes(topic))) {
    score += 5
  }

  if (/\b(important|repeat|focus)\b/.test(parsedQuery.normalized) && (row.focus_topics?.length ?? 0) > 0) {
    score += 8
  }

  if (/^official pdf paper$/i.test(row.paper) && (row.focus_topics?.length ?? 0) === 0) {
    score -= 10
  }

  return score
}

async function searchPapersInDb(parsedQuery: QbankParsedQuery): Promise<QbankPaperMatch[]> {
  const supabaseAdmin = getSupabaseAdmin()
  const searchTerms = [
    parsedQuery.board,
    parsedQuery.level,
    parsedQuery.subject,
    parsedQuery.year ? String(parsedQuery.year) : null,
    parsedQuery.paper,
    ...parsedQuery.topicHints,
  ]
    .filter(Boolean)
    .join(' ')

  const { data, error } = await supabaseAdmin
    .from('qbank_papers')
    .select(
      'id, board, level, subject, year, paper, paper_code, paper_title, session, focus_topics, source_label, source_url, quality_tier'
    )
    .textSearch('fts', searchTerms, {
      type: 'websearch',
      config: 'english',
    })
    .order('year', { ascending: false })
    .limit(6)

  if (error) {
    throw error
  }

  return (
    (data as
      | Array<{
          id: string
          board: string
          level: string
          subject: string
          year: number | null
          paper: string
          paper_code: string | null
          paper_title: string
          session: string | null
          focus_topics: string[] | null
          source_label: string | null
          source_url: string | null
          quality_tier: string | null
        }>
      | null) ?? []
  ).map((row) => ({
    id: row.id,
    board: row.board,
    level: row.level,
    subject: row.subject,
    year: row.year,
    paper: row.paper,
    paperCode: row.paper_code,
    paperTitle: row.paper_title,
    session: row.session,
    focusTopics: row.focus_topics ?? [],
    sourceLabel: row.source_label,
    sourceUrl: row.source_url,
    qualityTier: row.quality_tier,
  }))
}

function searchPapersInSeed(parsedQuery: QbankParsedQuery): QbankPaperMatch[] {
  return getPaperRows()
    .filter((row) => matchesParsedQuery(row, parsedQuery))
    .map((row) => ({ row, score: scorePaper(row, parsedQuery) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(({ row }) => ({
      id: row.id,
      board: row.board,
      level: row.level,
      subject: row.subject,
      year: row.year ?? null,
      paper: row.paper,
      paperCode: row.paper_code ?? null,
      paperTitle: row.paper_title,
      session: row.session ?? null,
      focusTopics: row.focus_topics ?? [],
      sourceLabel: row.source_label ?? null,
      sourceUrl: row.source_url ?? null,
      qualityTier: row.quality_tier ?? null,
    }))
}

export async function searchQbankPapers(parsedQuery: QbankParsedQuery) {
  try {
    const matches = await searchPapersInDb(parsedQuery)
    if (matches.length > 0) {
      return {
        enabled: true,
        source: 'db',
        matches,
      }
    }
  } catch (error) {
    if (!isMissingPaperTableError(error)) {
      throw error
    }
  }

  return {
    enabled: false,
    source: 'seed',
    matches: searchPapersInSeed(parsedQuery),
  }
}

function applyCatalogFilters(rows: QbankPaperRow[], filters: QbankPaperCatalogFilters) {
  return rows.filter((row) => {
    if (filters.board && !row.board.toLowerCase().includes(filters.board.toLowerCase())) {
      return false
    }

    if (filters.level && !row.level.toLowerCase().includes(filters.level.toLowerCase())) {
      return false
    }

    if (filters.subject && !row.subject.toLowerCase().includes(filters.subject.toLowerCase())) {
      return false
    }

    if (filters.year && row.year !== filters.year) {
      return false
    }

    return true
  })
}

function mapPaperRow(row: QbankPaperRow): QbankPaperMatch {
  return {
    id: row.id,
    board: row.board,
    level: row.level,
    subject: row.subject,
    year: row.year ?? null,
    paper: row.paper,
    paperCode: row.paper_code ?? null,
    paperTitle: row.paper_title,
    session: row.session ?? null,
    focusTopics: row.focus_topics ?? [],
    sourceLabel: row.source_label ?? null,
    sourceUrl: row.source_url ?? null,
    qualityTier: row.quality_tier ?? null,
  }
}

export async function browseQbankPapers(filters: QbankPaperCatalogFilters) {
  const limit = Math.min(Math.max(filters.limit ?? 12, 1), 30)

  try {
    const supabaseAdmin = getSupabaseAdmin()
    let query = supabaseAdmin
      .from('qbank_papers')
      .select(
        'id, board, level, subject, year, paper, paper_code, paper_title, session, focus_topics, source_label, source_url, quality_tier'
      )
      .order('year', { ascending: false })
      .limit(limit)

    if (filters.board) {
      query = query.ilike('board', `%${filters.board}%`)
    }

    if (filters.level) {
      query = query.ilike('level', `%${filters.level}%`)
    }

    if (filters.subject) {
      query = query.ilike('subject', `%${filters.subject}%`)
    }

    if (filters.year) {
      query = query.eq('year', filters.year)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    const matches =
      (data as
        | Array<{
            id: string
            board: string
            level: string
            subject: string
            year: number | null
            paper: string
            paper_code: string | null
            paper_title: string
            session: string | null
            focus_topics: string[] | null
            source_label: string | null
            source_url: string | null
            quality_tier: string | null
          }>
        | null) ?? []

    return {
      enabled: true,
      source: 'db',
      matches: matches.map((row) => ({
        id: row.id,
        board: row.board,
        level: row.level,
        subject: row.subject,
        year: row.year,
        paper: row.paper,
        paperCode: row.paper_code,
        paperTitle: row.paper_title,
        session: row.session,
        focusTopics: row.focus_topics ?? [],
        sourceLabel: row.source_label,
        sourceUrl: row.source_url,
        qualityTier: row.quality_tier,
      })),
    }
  } catch (error) {
    if (!isMissingPaperTableError(error)) {
      throw error
    }
  }

  return {
    enabled: false,
    source: 'seed',
    matches: applyCatalogFilters(getPaperRows(), filters).slice(0, limit).map(mapPaperRow),
  }
}
