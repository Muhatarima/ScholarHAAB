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

let cachedRows: QbankPdfChunkRow[] | null = null
const QUESTION_STYLE_RESOURCE_TYPES = new Set([
  'question_paper',
  'mark_scheme',
  'examiner_report',
  'confidential_instructions',
  'specimen_question_paper',
  'specimen_mark_scheme',
])

function getChunkPaths() {
  const dataDir = path.join(process.cwd(), 'data')
  const primaryPath = path.join(dataDir, 'qbank_collection', 'extracted_text', 'pdf_text_chunks.jsonl')
  const rootChunkPaths = fs
    .readdirSync(dataDir)
    .filter((file) => /^qbank_pdf_.*chunks.*\.jsonl$/i.test(file))
    .sort()
    .map((file) => path.join(dataDir, file))

  return [primaryPath, ...rootChunkPaths].filter((filePath, index, all) => all.indexOf(filePath) === index)
}

function countPattern(text: string, pattern: RegExp) {
  return text.match(pattern)?.length ?? 0
}

function extractionPenalty(text: string | null | undefined) {
  const compact = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!compact) {
    return 999
  }

  let penalty = 0
  penalty += countPattern(compact, /\b(?:[A-Za-z]\s+){3,}[A-Za-z]\b/g) * 18
  penalty += countPattern(compact, /\b[A-Za-z]\s+[a-z]{1,3}\b/g) * 5
  penalty += countPattern(compact, /[_/\\]{2,}|Â|Ã|25CBh|___/g) * 18
  penalty += countPattern(compact, /\b[a-z]{1,2}\s+[a-z]{1,2}\s+[a-z]{1,2}\b/g) * 8

  return penalty
}

function isLowQualityChunk(row: QbankPdfChunkRow) {
  return extractionPenalty(row.content) >= 36
}

function isBoilerplateChunk(row: QbankPdfChunkRow) {
  const normalized = String(row.content ?? '').toLowerCase()
  return (
    normalized.includes('official exam file indexed from the desktop folder') ||
    normalized.startsWith('contents ') ||
    normalized.startsWith('cambridge secondary') ||
    normalized.includes('why choose cambridge')
  )
}

function shouldUsePdfChunks(parsedQuery: QbankParsedQuery) {
  return (
    parsedQuery.intent === 'question_lookup' ||
    (parsedQuery.intent === 'solve' && Boolean(parsedQuery.year || parsedQuery.paper))
  )
}

function hasStrictFilters(parsedQuery: QbankParsedQuery) {
  return Boolean(
    parsedQuery.board || parsedQuery.level || parsedQuery.subject || parsedQuery.year || parsedQuery.paper
  )
}

function getRows() {
  if (cachedRows) {
    return cachedRows
  }

  const chunkPaths = getChunkPaths().filter((filePath) => fs.existsSync(filePath))

  if (chunkPaths.length === 0) {
    cachedRows = []
    return cachedRows
  }

  cachedRows = chunkPaths.flatMap((filePath) =>
    fs
      .readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as QbankPdfChunkRow)
  )

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

  score -= Math.min(extractionPenalty(row.content), 80)

  return score
}

function matchesFilters(row: QbankPdfChunkRow, parsedQuery: QbankParsedQuery) {
  if (
    (parsedQuery.intent === 'question_lookup' || parsedQuery.intent === 'solve') &&
    !QUESTION_STYLE_RESOURCE_TYPES.has(row.resource_type)
  ) {
    return false
  }

  if (parsedQuery.board && !row.board.toLowerCase().includes(parsedQuery.board.toLowerCase())) {
    return false
  }

  if (parsedQuery.level && !row.level.toLowerCase().includes(parsedQuery.level.toLowerCase())) {
    return false
  }

  if (parsedQuery.subject && !row.subject.toLowerCase().includes(parsedQuery.subject.toLowerCase())) {
    return false
  }

  if (parsedQuery.year && row.year !== parsedQuery.year) {
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
    content: row.content ?? '',
    visualRich: Boolean(row.visual_rich),
    visualRisk: row.visual_risk ?? null,
    imageObjects: row.image_objects ?? 0,
    visualTags: row.visual_tags ?? [],
    sourceUrl: row.source_url ?? null,
  }
}

export function searchQbankPdfChunks(parsedQuery: QbankParsedQuery) {
  if (!shouldUsePdfChunks(parsedQuery)) {
    return []
  }

  const rows = getRows()
  const candidates = rows.filter((row) => matchesFilters(row, parsedQuery))
  if (candidates.length === 0 && hasStrictFilters(parsedQuery)) {
    return []
  }
  const activeRows = candidates.length > 0 ? candidates : rows

  return activeRows
    .filter((row) => !isLowQualityChunk(row))
    .filter((row) => !isBoilerplateChunk(row))
    .map((row) => ({ row, score: scoreRow(row, parsedQuery) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((entry) => mapRow(entry.row))
}
