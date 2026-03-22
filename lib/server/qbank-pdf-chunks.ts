import fs from 'node:fs'
import path from 'node:path'
import type { QbankParsedQuery } from '@/lib/server/qbank'

type QbankPdfChunkRow = {
  id: string
  document_id: string
  board: string
  level: string
  subject: string
  title: string
  year?: number | null
  resource_type: string
  chunk_index: number
  score?: number
  visual_rich?: boolean
  visual_risk?: string
  image_objects?: number
  visual_tags?: string[]
  content: string
  source_url?: string | null
  source_page_url?: string | null
  local_path?: string | null
}

export type QbankPdfChunkMatch = {
  id: string
  documentId: string
  board: string
  level: string
  subject: string
  title: string
  year: number | null
  resourceType: string
  content: string
  visualRich: boolean
  visualRisk: string | null
  imageObjects: number
  visualTags: string[]
  sourceUrl: string | null
}

const CHUNK_PATH = path.join(
  process.cwd(),
  'data',
  'qbank_collection',
  'extracted_text',
  'pdf_text_chunks.jsonl'
)

let cachedRows: QbankPdfChunkRow[] | null = null

function getRows() {
  if (cachedRows) {
    return cachedRows
  }

  if (!fs.existsSync(CHUNK_PATH)) {
    cachedRows = []
    return cachedRows
  }

  cachedRows = fs
    .readFileSync(CHUNK_PATH, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as QbankPdfChunkRow)

  return cachedRows
}

function scoreRow(row: QbankPdfChunkRow, parsedQuery: QbankParsedQuery) {
  const haystack = [
    row.board,
    row.level,
    row.subject,
    row.title,
    row.resource_type,
    ...(row.visual_tags ?? []),
    row.content,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  let score = row.score ?? 0

  for (const token of parsedQuery.normalized.split(' ')) {
    if (token.length > 2 && haystack.includes(token)) {
      score += 3
    }
  }

  if (parsedQuery.board && row.board.toLowerCase().includes(parsedQuery.board.toLowerCase())) {
    score += 5
  }

  if (parsedQuery.level && row.level.toLowerCase().includes(parsedQuery.level.toLowerCase())) {
    score += 4
  }

  if (parsedQuery.subject && row.subject.toLowerCase().includes(parsedQuery.subject.toLowerCase())) {
    score += 5
  }

  if (parsedQuery.year && row.year === parsedQuery.year) {
    score += 6
  }

  if (parsedQuery.paper && haystack.includes(parsedQuery.paper.toLowerCase())) {
    score += 6
  }

  if (parsedQuery.topicHints.some((topic) => haystack.includes(topic))) {
    score += 5
  }

  if (row.visual_rich) {
    score += 1
  }

  if (parsedQuery.topicHints.some((topic) => (row.visual_tags ?? []).includes(topic))) {
    score += 6
  }

  return score
}

function matchesFilters(row: QbankPdfChunkRow, parsedQuery: QbankParsedQuery) {
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

  return true
}

function mapRow(row: QbankPdfChunkRow): QbankPdfChunkMatch {
  return {
    id: row.id,
    documentId: row.document_id,
    board: row.board,
    level: row.level,
    subject: row.subject,
    title: row.title,
    year: row.year ?? null,
    resourceType: row.resource_type,
    content: row.content,
    visualRich: Boolean(row.visual_rich),
    visualRisk: row.visual_risk ?? null,
    imageObjects: row.image_objects ?? 0,
    visualTags: row.visual_tags ?? [],
    sourceUrl: row.source_url ?? null,
  }
}

export function searchQbankPdfChunks(parsedQuery: QbankParsedQuery) {
  const rows = getRows()
  const candidates = rows.filter((row) => matchesFilters(row, parsedQuery))
  const activeRows = candidates.length > 0 ? candidates : rows

  return activeRows
    .map((row) => ({ row, score: scoreRow(row, parsedQuery) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((entry) => mapRow(entry.row))
}
