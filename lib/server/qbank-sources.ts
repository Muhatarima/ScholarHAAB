import fs from 'node:fs'
import path from 'node:path'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'
import type { QbankParsedQuery } from '@/lib/server/qbank'

type QbankSourceRow = {
  id: string
  provider: string
  source_kind: string
  board: string
  level: string
  subject: string
  title: string
  url: string
  quality_tier: string
  allowed_use: string
}

export type QbankSourceMatch = {
  id: string
  provider: string
  sourceKind: string
  board: string
  level: string
  subject: string
  title: string
  url: string
  qualityTier: string
  allowedUse: string
}

const DATA_DIR = path.join(process.cwd(), 'data')
const GENERATED_SOURCE_MANIFEST_PATH = path.join(
  process.cwd(),
  'data',
  'qbank_collection',
  'queues',
  'generated_source_manifest.jsonl'
)
let cachedSourceRows: QbankSourceRow[] | null = null

function isMissingSourceTableError(error: unknown): boolean {
  const code = (error as { code?: string })?.code
  const message = String((error as { message?: string })?.message ?? '')
  return code === '42P01' || code === 'PGRST205' || /qbank_sources/i.test(message)
}

function getSourceRows() {
  if (cachedSourceRows) {
    return cachedSourceRows
  }

  const sourceFiles: string[] = []

  if (fs.existsSync(DATA_DIR)) {
    sourceFiles.push(
      ...fs
        .readdirSync(DATA_DIR)
        .filter((file) => /^qbank_source.*\.jsonl$/i.test(file))
        .sort()
        .map((file) => path.join(DATA_DIR, file))
    )
  }

  if (fs.existsSync(GENERATED_SOURCE_MANIFEST_PATH)) {
    sourceFiles.push(GENERATED_SOURCE_MANIFEST_PATH)
  }

  if (sourceFiles.length === 0) {
    cachedSourceRows = []
    return cachedSourceRows
  }

  cachedSourceRows = sourceFiles.flatMap((filePath) =>
    fs
      .readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as QbankSourceRow)
  )

  return cachedSourceRows
}

function matchesParsedQuery(row: QbankSourceRow, parsedQuery: QbankParsedQuery) {
  if (parsedQuery.board && row.board !== 'Mixed' && !row.board.toLowerCase().includes(parsedQuery.board.toLowerCase())) {
    return false
  }

  if (parsedQuery.level && row.level !== 'Mixed' && !row.level.toLowerCase().includes(parsedQuery.level.toLowerCase())) {
    return false
  }

  if (parsedQuery.subject && row.subject !== 'Mixed' && !row.subject.toLowerCase().includes(parsedQuery.subject.toLowerCase())) {
    return false
  }

  return true
}

function scoreSource(row: QbankSourceRow, parsedQuery: QbankParsedQuery) {
  let score = 0
  const haystack = [
    row.provider,
    row.source_kind,
    row.board,
    row.level,
    row.subject,
    row.title,
  ]
    .join(' ')
    .toLowerCase()

  for (const token of parsedQuery.normalized.split(' ')) {
    if (token.length > 2 && haystack.includes(token)) {
      score += 3
    }
  }

  if (row.quality_tier === 'tier1_official') {
    score += 8
  }

  if (row.allowed_use === 'truth') {
    score += 4
  }

  if (parsedQuery.board && row.board.toLowerCase().includes(parsedQuery.board.toLowerCase())) {
    score += 5
  }

  if (parsedQuery.subject && row.subject.toLowerCase().includes(parsedQuery.subject.toLowerCase())) {
    score += 4
  }

  if (parsedQuery.level && row.level.toLowerCase().includes(parsedQuery.level.toLowerCase())) {
    score += 4
  }

  if (parsedQuery.intent === 'topic_review' && /syllabus|specification|pdf/i.test(row.source_kind)) {
    score += 4
  }

  if (parsedQuery.intent === 'question_lookup' && /past_papers|public_qbank/i.test(row.source_kind)) {
    score += 4
  }

  return score
}

async function searchSourcesInDb(parsedQuery: QbankParsedQuery): Promise<QbankSourceMatch[]> {
  const supabaseAdmin = getSupabaseAdmin()
  const filters = supabaseAdmin
    .from('qbank_sources')
    .select(
      'id, provider, source_kind, board, level, subject, title, url, quality_tier, allowed_use'
    )
    .order('quality_tier', { ascending: true })
    .limit(6)

  let query = filters

  if (parsedQuery.board) {
    query = query.or(`board.ilike.%${parsedQuery.board}%,board.eq.Mixed`)
  }

  if (parsedQuery.level) {
    query = query.or(`level.ilike.%${parsedQuery.level}%,level.eq.Mixed`)
  }

  if (parsedQuery.subject) {
    query = query.or(`subject.ilike.%${parsedQuery.subject}%,subject.eq.Mixed`)
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  return (
    (data as
      | Array<{
          id: string
          provider: string
          source_kind: string
          board: string
          level: string
          subject: string
          title: string
          url: string
          quality_tier: string
          allowed_use: string
        }>
      | null) ?? []
  ).map((row) => ({
    id: row.id,
    provider: row.provider,
    sourceKind: row.source_kind,
    board: row.board,
    level: row.level,
    subject: row.subject,
    title: row.title,
    url: row.url,
    qualityTier: row.quality_tier,
    allowedUse: row.allowed_use,
  }))
}

function searchSourcesInSeed(parsedQuery: QbankParsedQuery): QbankSourceMatch[] {
  return getSourceRows()
    .filter((row) => matchesParsedQuery(row, parsedQuery))
    .map((row) => ({ row, score: scoreSource(row, parsedQuery) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(({ row }) => ({
      id: row.id,
      provider: row.provider,
      sourceKind: row.source_kind,
      board: row.board,
      level: row.level,
      subject: row.subject,
      title: row.title,
      url: row.url,
      qualityTier: row.quality_tier,
      allowedUse: row.allowed_use,
    }))
}

export async function searchQbankSources(parsedQuery: QbankParsedQuery) {
  try {
    const matches = await searchSourcesInDb(parsedQuery)
    if (matches.length > 0) {
      return {
        enabled: true,
        source: 'db',
        matches,
      }
    }
  } catch (error) {
    if (!isMissingSourceTableError(error)) {
      throw error
    }
  }

  return {
    enabled: false,
    source: 'seed',
    matches: searchSourcesInSeed(parsedQuery),
  }
}
