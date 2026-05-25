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

type MirrorRecoveryRow = {
  id: string
  targetId: string
  board: string
  level: string
  subject: string
  year: number | null
  resourceType: string
  provider: string
  mirrorPageUrl: string | null
  mirrorPageTitle: string | null
  mirrorPageDescription: string | null
  mirrorEvidenceType: 'exact_file_name' | 'subject_year_support_page'
  mirrorSupportConfidence: 'high' | 'medium' | 'low'
  mirrorFileNames?: string[]
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
  mirrorProvider: string | null
  mirrorPageUrl: string | null
  mirrorPageTitle: string | null
  mirrorPageDescription: string | null
  mirrorEvidenceType: 'exact_file_name' | 'subject_year_support_page' | null
  mirrorSupportConfidence: 'high' | 'medium' | 'low' | null
  mirrorFileNames: string[]
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
const MIRROR_RECOVERY_PATH = path.join(
  process.cwd(),
  'data',
  'qbank_collection',
  'kingsbridge_mirror',
  'mirror_recovery_manifest.jsonl'
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
  const blockedRows = readJsonl<BlockedRecoveryRow>(BLOCKED_RECOVERY_PATH)
  const mirrorRows = readJsonl<MirrorRecoveryRow>(MIRROR_RECOVERY_PATH)
  const mirrorByTargetId = new Map(mirrorRows.map((row) => [row.targetId, row]))

  return blockedRows.map((row) => {
    const mirror = mirrorByTargetId.get(row.targetId)
    return {
      ...row,
      mirrorProvider: mirror?.provider ?? null,
      mirrorPageUrl: mirror?.mirrorPageUrl ?? null,
      mirrorPageTitle: mirror?.mirrorPageTitle ?? null,
      mirrorPageDescription: mirror?.mirrorPageDescription ?? null,
      mirrorEvidenceType: mirror?.mirrorEvidenceType ?? null,
      mirrorSupportConfidence: mirror?.mirrorSupportConfidence ?? null,
      mirrorFileNames: mirror?.mirrorFileNames ?? [],
    }
  })
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
  if ((row as BlockedRecoveryRow & { mirrorPageUrl?: string | null }).mirrorPageUrl) score += 6
  if ((row as BlockedRecoveryRow & { mirrorEvidenceType?: string | null }).mirrorEvidenceType === 'exact_file_name') score += 8

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
        mirrorProvider: (entry.row as BlockedRecoveryRow & { mirrorProvider?: string | null }).mirrorProvider ?? null,
        mirrorPageUrl: (entry.row as BlockedRecoveryRow & { mirrorPageUrl?: string | null }).mirrorPageUrl ?? null,
        mirrorPageTitle: (entry.row as BlockedRecoveryRow & { mirrorPageTitle?: string | null }).mirrorPageTitle ?? null,
        mirrorPageDescription:
          (entry.row as BlockedRecoveryRow & { mirrorPageDescription?: string | null }).mirrorPageDescription ??
          null,
        mirrorEvidenceType:
          (entry.row as BlockedRecoveryRow & {
            mirrorEvidenceType?: 'exact_file_name' | 'subject_year_support_page' | null
          }).mirrorEvidenceType ?? null,
        mirrorSupportConfidence:
          (entry.row as BlockedRecoveryRow & { mirrorSupportConfidence?: 'high' | 'medium' | 'low' | null })
            .mirrorSupportConfidence ?? null,
        mirrorFileNames:
          (entry.row as BlockedRecoveryRow & { mirrorFileNames?: string[] }).mirrorFileNames ?? [],
        recoveryStatus: entry.row.recoveryStatus,
        note: entry.row.note,
      })
    )
}
