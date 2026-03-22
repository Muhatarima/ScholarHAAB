import fs from 'node:fs'
import path from 'node:path'
import type { QbankParsedQuery } from '@/lib/server/qbank'

type GapRow = {
  id: string
  board: string
  level: string
  subject: string
  year: number | null
  resource_type: string
  queue_status?: string
  best_candidate_http_status?: number | null
  effective_min_year?: number | null
  effective_max_year?: number | null
  support_source_urls?: string[]
  support_source_titles?: string[]
}

type NotYetPublishedRow = {
  id: string
  board: string
  level: string
  subject: string
  year: number | null
  resource_type: string
  effective_min_year?: number | null
  effective_max_year?: number | null
  exclusion_reason?: string
}

export type QbankGapMatch = {
  id: string
  board: string
  level: string
  subject: string
  year: number | null
  resourceType: string
  status: 'access_blocked' | 'source_page_available' | 'not_yet_published'
  httpStatus: number | null
  effectiveMinYear: number | null
  effectiveMaxYear: number | null
  sourceUrls: string[]
}

const MISSING_QUEUE_PATH = path.join(
  process.cwd(),
  'data',
  'qbank_collection',
  'missing_coverage',
  'missing_coverage_queue.jsonl'
)
const NOT_YET_PUBLISHED_PATH = path.join(
  process.cwd(),
  'data',
  'qbank_collection',
  'missing_coverage',
  'not_yet_published_queue.jsonl'
)

function readJsonl<T>(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return []
  }

  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T)
}

function getMissingRows() {
  return readJsonl<GapRow>(MISSING_QUEUE_PATH)
}

function getNotYetPublishedRows() {
  return readJsonl<NotYetPublishedRow>(NOT_YET_PUBLISHED_PATH)
}

function matchesParsedQuery(
  row: { board: string; level: string; subject: string; year: number | null },
  parsedQuery: QbankParsedQuery
) {
  if (parsedQuery.subject && !row.subject.toLowerCase().includes(parsedQuery.subject.toLowerCase())) {
    return false
  }

  if (parsedQuery.board && !row.board.toLowerCase().includes(parsedQuery.board.toLowerCase())) {
    return false
  }

  if (parsedQuery.level && !row.level.toLowerCase().includes(parsedQuery.level.toLowerCase())) {
    return false
  }

  if (parsedQuery.year && row.year && row.year !== parsedQuery.year) {
    return false
  }

  if (!parsedQuery.year && !parsedQuery.subject) {
    return false
  }

  return true
}

function scoreGap(row: QbankGapMatch, parsedQuery: QbankParsedQuery) {
  let score = 0

  if (parsedQuery.year && row.year === parsedQuery.year) score += 16
  if (parsedQuery.subject && row.subject.toLowerCase().includes(parsedQuery.subject.toLowerCase())) score += 10
  if (parsedQuery.board && row.board.toLowerCase().includes(parsedQuery.board.toLowerCase())) score += 8
  if (parsedQuery.level && row.level.toLowerCase().includes(parsedQuery.level.toLowerCase())) score += 8

  if (row.status === 'access_blocked') score += 10
  if (row.status === 'source_page_available') score += 6
  if (row.status === 'not_yet_published') score += 4

  return score
}

export function searchQbankGapStatuses(parsedQuery: QbankParsedQuery) {
  const gapMatches: QbankGapMatch[] = getMissingRows()
    .filter((row) => row.queue_status === 'access_blocked' || row.queue_status === 'source_page_available')
    .filter((row) => matchesParsedQuery(row, parsedQuery))
    .map((row) => ({
      id: row.id,
      board: row.board,
      level: row.level,
      subject: row.subject,
      year: row.year ?? null,
      resourceType: row.resource_type,
      status: row.queue_status as 'access_blocked' | 'source_page_available',
      httpStatus: row.best_candidate_http_status ?? null,
      effectiveMinYear: row.effective_min_year ?? null,
      effectiveMaxYear: row.effective_max_year ?? null,
      sourceUrls: row.support_source_urls ?? [],
    }))

  const unpublishedMatches: QbankGapMatch[] = getNotYetPublishedRows()
    .filter((row) => matchesParsedQuery(row, parsedQuery))
    .map((row) => ({
      id: row.id,
      board: row.board,
      level: row.level,
      subject: row.subject,
      year: row.year ?? null,
      resourceType: row.resource_type,
      status: 'not_yet_published',
      httpStatus: null,
      effectiveMinYear: row.effective_min_year ?? null,
      effectiveMaxYear: row.effective_max_year ?? null,
      sourceUrls: [],
    }))

  return [...gapMatches, ...unpublishedMatches]
    .map((row) => ({ row, score: scoreGap(row, parsedQuery) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((entry) => entry.row)
}
