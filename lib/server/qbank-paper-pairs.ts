import fs from 'node:fs'
import path from 'node:path'
import type { QbankParsedQuery } from '@/lib/server/qbank'

type IndexedPaperRow = {
  id: string
  board: string
  level: string
  subject: string
  title: string
  url: string
  local_path: string
  source_page_url?: string | null
  document_type?: string | null
  resource_type: string
  year?: number | null
  session?: string | null
  paper_code?: string | null
  provider?: string | null
  status?: string | null
}

export type QbankPaperPairMatch = {
  id: string
  board: string
  level: string
  subject: string
  year: number | null
  session: string | null
  paperCode: string | null
  questionPaperUrl: string | null
  markSchemeUrl: string | null
  examinerReportUrl: string | null
  confidentialInstructionsUrl: string | null
  specimenMarkSchemeUrl: string | null
  completeness: 'full' | 'partial'
}

type QbankGapLike = {
  board: string
  level: string
  subject: string
  year: number | null
  resourceType: string
}

export type QbankNearbyResourceMatch = {
  id: string
  board: string
  level: string
  subject: string
  year: number | null
  session: string | null
  paperCode: string | null
  resourceType: string
  title: string
  url: string
  yearDistance: number | null
  samePaper: boolean
  completeness: 'full' | 'partial'
}

const INDEX_PATH = path.join(
  process.cwd(),
  'data',
  'qbank_collection',
  'indexed',
  'downloaded_pdf_index.jsonl'
)

let cachedPairs: QbankPaperPairMatch[] | null = null

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

function buildPairKey(row: IndexedPaperRow) {
  return [
    row.board,
    row.level,
    row.subject,
    row.year ?? '',
    row.session ?? '',
    normalizePaperToken(row.paper_code),
  ].join('|')
}

function normalizePaperToken(value: string | null | undefined) {
  if (!value) {
    return ''
  }

  return value
    .toLowerCase()
    .replace(/\bpaper\b/g, '')
    .replace(/\bp\b/g, '')
    .replace(/\s+/g, '')
    .trim()
}

function getPairRows() {
  if (cachedPairs) {
    return cachedPairs
  }

  const rows = readJsonl<IndexedPaperRow>(INDEX_PATH).filter(
    (row) =>
      ['question_paper', 'mark_scheme', 'specimen_mark_scheme', 'examiner_report', 'confidential_instructions'].includes(
        row.resource_type
      ) && row.board && row.level && row.subject
  )

  const grouped = new Map<string, QbankPaperPairMatch>()

  for (const row of rows) {
    const key = buildPairKey(row)
    const current =
      grouped.get(key) ??
      {
        id: `pair-${Buffer.from(key).toString('base64url').slice(0, 24)}`,
        board: row.board,
        level: row.level,
        subject: row.subject,
        year: row.year ?? null,
        session: row.session ?? null,
        paperCode: row.paper_code ?? null,
        questionPaperUrl: null,
        markSchemeUrl: null,
        examinerReportUrl: null,
        confidentialInstructionsUrl: null,
        specimenMarkSchemeUrl: null,
        completeness: 'partial',
      }

    if (row.resource_type === 'question_paper' && !current.questionPaperUrl) {
      current.questionPaperUrl = row.url
    }

    if (row.resource_type === 'mark_scheme' && !current.markSchemeUrl) {
      current.markSchemeUrl = row.url
    }

    if (row.resource_type === 'examiner_report' && !current.examinerReportUrl) {
      current.examinerReportUrl = row.url
    }

    if (row.resource_type === 'confidential_instructions' && !current.confidentialInstructionsUrl) {
      current.confidentialInstructionsUrl = row.url
    }

    if (row.resource_type === 'specimen_mark_scheme' && !current.specimenMarkSchemeUrl) {
      current.specimenMarkSchemeUrl = row.url
    }

    current.completeness =
      current.questionPaperUrl && current.markSchemeUrl ? 'full' : 'partial'

    grouped.set(key, current)
  }

  cachedPairs = Array.from(grouped.values())
  return cachedPairs
}

function matchesQuery(row: QbankPaperPairMatch, parsedQuery: QbankParsedQuery) {
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

  if (parsedQuery.paper && row.paperCode) {
    const normalizedPaper = normalizePaperToken(row.paperCode)
    const queryPaper = normalizePaperToken(parsedQuery.paper)
    if (
      queryPaper &&
      normalizedPaper &&
      !normalizedPaper.includes(queryPaper) &&
      !queryPaper.includes(normalizedPaper)
    ) {
      return false
    }
  }

  return true
}

function scorePair(row: QbankPaperPairMatch, parsedQuery: QbankParsedQuery) {
  let score = 0

  if (row.completeness === 'full') score += 15
  if (row.questionPaperUrl) score += 8
  if (row.markSchemeUrl) score += 8
  if (row.examinerReportUrl) score += 3

  if (parsedQuery.year && row.year === parsedQuery.year) score += 8
  if (parsedQuery.subject && row.subject.toLowerCase().includes(parsedQuery.subject.toLowerCase())) score += 5
  if (parsedQuery.board && row.board.toLowerCase().includes(parsedQuery.board.toLowerCase())) score += 5
  if (parsedQuery.level && row.level.toLowerCase().includes(parsedQuery.level.toLowerCase())) score += 5
  if (
    parsedQuery.paper &&
    row.paperCode &&
    normalizePaperToken(parsedQuery.paper).includes(normalizePaperToken(row.paperCode))
  ) {
    score += 8
  }

  return score
}

function getResourceUrl(row: QbankPaperPairMatch, resourceType: string) {
  if (resourceType === 'question_paper') {
    return row.questionPaperUrl
  }

  if (resourceType === 'mark_scheme') {
    return row.markSchemeUrl
  }

  if (resourceType === 'examiner_report') {
    return row.examinerReportUrl
  }

  if (resourceType === 'confidential_instructions') {
    return row.confidentialInstructionsUrl
  }

  if (resourceType === 'specimen_mark_scheme') {
    return row.specimenMarkSchemeUrl
  }

  return null
}

function buildNearbyTitle(row: QbankPaperPairMatch, resourceType: string) {
  return `${row.board} ${row.level} ${row.subject} ${row.year ?? ''} ${row.paperCode ? `Paper ${row.paperCode} ` : ''}${resourceType.replace(/_/g, ' ')}`.replace(/\s+/g, ' ').trim()
}

export function searchNearbyQbankResources(
  parsedQuery: QbankParsedQuery,
  gapMatches: QbankGapLike[]
) {
  const gaps = gapMatches.filter((gap) => gap.resourceType && gap.board && gap.level && gap.subject)
  if (gaps.length === 0) {
    return [] as QbankNearbyResourceMatch[]
  }

  const queryPaper = normalizePaperToken(parsedQuery.paper)
  const seen = new Set<string>()
  const candidates: Array<{ row: QbankNearbyResourceMatch; score: number }> = []

  for (const gap of gaps) {
    for (const row of getPairRows()) {
      if (row.board.toLowerCase() !== gap.board.toLowerCase()) {
        continue
      }

      if (row.level.toLowerCase() !== gap.level.toLowerCase()) {
        continue
      }

      if (row.subject.toLowerCase() !== gap.subject.toLowerCase()) {
        continue
      }

      const resourceUrl = getResourceUrl(row, gap.resourceType)
      if (!resourceUrl) {
        continue
      }

      if (gap.year && row.year === gap.year) {
        continue
      }

      const samePaper =
        !!queryPaper && !!row.paperCode && normalizePaperToken(row.paperCode) === queryPaper

      if (queryPaper && row.paperCode && !samePaper) {
        continue
      }

      const yearDistance =
        gap.year && row.year ? Math.abs(row.year - gap.year) : null

      const dedupeKey = [gap.resourceType, resourceUrl].join('|')
      if (seen.has(dedupeKey)) {
        continue
      }

      let score = 0
      if (samePaper) score += 18
      if (row.completeness === 'full') score += 10
      if (gap.year && row.year) {
        score += Math.max(0, 18 - Math.min(Math.abs(row.year - gap.year), 6) * 3)
        if (row.year < gap.year) {
          score += 4
        }
      }
      if (row.examinerReportUrl && gap.resourceType === 'examiner_report') score += 6
      if (row.markSchemeUrl && gap.resourceType === 'mark_scheme') score += 6
      if (row.questionPaperUrl && gap.resourceType === 'question_paper') score += 6

      seen.add(dedupeKey)
      candidates.push({
        row: {
          id: `${row.id}:${gap.resourceType}`,
          board: row.board,
          level: row.level,
          subject: row.subject,
          year: row.year,
          session: row.session,
          paperCode: row.paperCode,
          resourceType: gap.resourceType,
          title: buildNearbyTitle(row, gap.resourceType),
          url: resourceUrl,
          yearDistance,
          samePaper,
          completeness: row.completeness,
        },
        score,
      })
    }
  }

  return candidates
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score
      }

      const aDistance = a.row.yearDistance ?? 999
      const bDistance = b.row.yearDistance ?? 999
      if (aDistance !== bDistance) {
        return aDistance - bDistance
      }

      return (b.row.year ?? 0) - (a.row.year ?? 0)
    })
    .slice(0, 4)
    .map((entry) => entry.row)
}

export function searchQbankPaperPairs(parsedQuery: QbankParsedQuery) {
  return getPairRows()
    .filter((row) => matchesQuery(row, parsedQuery))
    .map((row) => ({ row, score: scorePair(row, parsedQuery) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((entry) => entry.row)
}

export function getAllQbankPaperPairs() {
  return getPairRows()
}

export function getQbankPaperPairStats() {
  const rows = getPairRows()
  return {
    totalPairs: rows.length,
    fullPairs: rows.filter((row) => row.completeness === 'full').length,
    partialPairs: rows.filter((row) => row.completeness === 'partial').length,
  }
}
