import fs from 'node:fs'
import path from 'node:path'
import type { QbankParsedQuery } from '@/lib/server/qbank'

type BlockedRecoveryRow = {
  id: string
  targetId: string
  board: string
  level: string
  subject: string
  year: number | null
  resourceType: string
  officialTitle: string | null
  officialUrl: string | null
  exactFilename: string | null
  officialHttpStatus: number | null
  supportSourceUrls?: string[]
  supportSourceTitles?: string[]
  publicListingReferences?: Array<{
    provider: string
    url: string
    type: string
  }>
  recoveryStatus: 'external_access_blocked'
  collectable: boolean
  note: string
}

export type QbankBlockedRecoveryMatch = {
  id: string
  targetId: string
  board: string
  level: string
  subject: string
  year: number | null
  resourceType: string
  officialTitle: string | null
  officialUrl: string | null
  exactFilename: string | null
  officialHttpStatus: number | null
  publicListingUrls: string[]
  supportSourceUrls: string[]
  recoveryStatus: 'external_access_blocked'
  note: string
}

const BLOCKED_RECOVERY_PATH = path.join(
  process.cwd(),
  'data',
  'qbank_collection',
  'blocked_recovery',
  'blocked_recovery_manifest.jsonl'
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

function getRows() {
  return readJsonl<BlockedRecoveryRow>(BLOCKED_RECOVERY_PATH)
}

function matchesParsedQuery(row: BlockedRecoveryRow, parsedQuery: QbankParsedQuery) {
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

function scoreRow(row: BlockedRecoveryRow, parsedQuery: QbankParsedQuery) {
  let score = 0

  if (parsedQuery.year && row.year === parsedQuery.year) score += 16
  if (parsedQuery.subject && row.subject.toLowerCase().includes(parsedQuery.subject.toLowerCase())) score += 10
  if (parsedQuery.board && row.board.toLowerCase().includes(parsedQuery.board.toLowerCase())) score += 8
  if (parsedQuery.level && row.level.toLowerCase().includes(parsedQuery.level.toLowerCase())) score += 8
  if (row.exactFilename && parsedQuery.normalized.includes(row.exactFilename.toLowerCase())) score += 12
  if (row.resourceType === 'question_paper') score += 4
  if (row.resourceType === 'mark_scheme') score += 3

  return score
}

export function searchQbankBlockedRecovery(parsedQuery: QbankParsedQuery) {
  return getRows()
    .filter((row) => matchesParsedQuery(row, parsedQuery))
    .map((row) => ({ row, score: scoreRow(row, parsedQuery) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(
      (entry): QbankBlockedRecoveryMatch => ({
        id: entry.row.id,
        targetId: entry.row.targetId,
        board: entry.row.board,
        level: entry.row.level,
        subject: entry.row.subject,
        year: entry.row.year,
        resourceType: entry.row.resourceType,
        officialTitle: entry.row.officialTitle,
        officialUrl: entry.row.officialUrl,
        exactFilename: entry.row.exactFilename,
        officialHttpStatus: entry.row.officialHttpStatus,
        publicListingUrls: (entry.row.publicListingReferences ?? []).map((item) => item.url),
        supportSourceUrls: entry.row.supportSourceUrls ?? [],
        recoveryStatus: entry.row.recoveryStatus,
        note: entry.row.note,
      })
    )
}
