import fs from 'node:fs'
import path from 'node:path'

type CoverageTargetRow = {
  id?: string
  board?: string
  level?: string
  subject?: string
  year?: number | null
  expected_resources?: string[]
}

type IndexedPaperRow = {
  board?: string
  level?: string
  subject?: string
  year?: number | null
  resource_type?: string
  title?: string
  url?: string
  local_path?: string
  source_page_url?: string
}

type MissingRow = {
  id: string
  board: string
  level: string
  subject: string
  year: number | null
  resource_type: string
  queue_status?: string
}

type CompletionStatus =
  | 'indexed'
  | 'blocked_exact'
  | 'unresolved'
  | 'excluded_window'
  | 'optional_secondary'
  | 'not_yet_published'

type GroupStats = {
  board: string
  level: string
  subject: string
  targetYears: number[]
  actionableResources: number
  indexedResources: number
  blockedResources: number
  unresolvedResources: number
  operationalResources: number
  indexedCoverageRatio: number
  operationalCoverageRatio: number
  fullyOperationalYears: number[]
  unresolvedYears: number[]
}

const DATA_DIR = path.join(process.cwd(), 'data')
const TARGETS_PATH = path.join(DATA_DIR, 'qbank_coverage_targets.jsonl')
const INDEX_PATH = path.join(DATA_DIR, 'qbank_collection', 'indexed', 'downloaded_pdf_index.jsonl')
const MISSING_QUEUE_PATH = path.join(
  DATA_DIR,
  'qbank_collection',
  'missing_coverage',
  'missing_coverage_queue.jsonl'
)
const EXCLUDED_WINDOW_PATH = path.join(
  DATA_DIR,
  'qbank_collection',
  'missing_coverage',
  'excluded_window_rows.jsonl'
)
const SECONDARY_OPTIONAL_PATH = path.join(
  DATA_DIR,
  'qbank_collection',
  'missing_coverage',
  'secondary_optional_queue.jsonl'
)
const NOT_YET_PUBLISHED_PATH = path.join(
  DATA_DIR,
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

function groupKey(row: { board?: string; level?: string; subject?: string }) {
  return [row.board || 'Unknown', row.level || 'Unknown', row.subject || 'Unknown'].join('|')
}

function groupYearKey(row: { board?: string; level?: string; subject?: string; year?: number | null }) {
  return `${groupKey(row)}|${String(row.year ?? 'unknown')}`
}

function isCoverageEvidenceRow(row: IndexedPaperRow) {
  const resourceType = String(row.resource_type || '').toLowerCase()
  const haystack = `${row.title || ''} ${row.url || ''} ${row.local_path || ''} ${row.source_page_url || ''}`.toLowerCase()

  if (resourceType === 'examiner_report') {
    if (/summary of examiner reports|er-summary|teaching and learning materials/.test(haystack)) {
      return false
    }
  }

  return true
}

function normalizeIndexedKinds(row: IndexedPaperRow) {
  const resourceType = String(row.resource_type || '').toLowerCase()

  switch (resourceType) {
    case 'question_paper':
      return { actual: ['question_paper'], fallback: [] }
    case 'mark_scheme':
      return { actual: ['mark_scheme'], fallback: [] }
    case 'examiner_report':
      return { actual: ['examiner_report'], fallback: [] }
    case 'confidential_instructions':
      return { actual: ['confidential_instructions'], fallback: [] }
    case 'specimen_question_paper':
      return { actual: [], fallback: ['question_paper'] }
    case 'specimen_mark_scheme':
      return { actual: [], fallback: ['mark_scheme'] }
    default:
      return { actual: [], fallback: [] }
  }
}

function toRatio(numerator: number, denominator: number) {
  if (!denominator) {
    return 1
  }

  return Number((numerator / denominator).toFixed(3))
}

function buildSummary() {
  const targets = readJsonl<CoverageTargetRow>(TARGETS_PATH).filter(
    (row) => row.board && row.level && row.subject && typeof row.year === 'number'
  )
  const indexedRows = readJsonl<IndexedPaperRow>(INDEX_PATH).filter(
    (row) => row.board && row.level && row.subject && typeof row.year === 'number' && isCoverageEvidenceRow(row)
  )
  const missingRows = readJsonl<MissingRow>(MISSING_QUEUE_PATH)
  const excludedRows = readJsonl<MissingRow>(EXCLUDED_WINDOW_PATH)
  const optionalRows = readJsonl<MissingRow>(SECONDARY_OPTIONAL_PATH)
  const notYetRows = readJsonl<MissingRow>(NOT_YET_PUBLISHED_PATH)

  const indexedMap = new Map<string, { actual: Set<string>; fallback: Set<string> }>()
  for (const row of indexedRows) {
    const key = groupYearKey(row)
    const current = indexedMap.get(key) ?? {
      actual: new Set<string>(),
      fallback: new Set<string>(),
    }

    const kinds = normalizeIndexedKinds(row)
    for (const kind of kinds.actual) {
      current.actual.add(kind)
    }
    for (const kind of kinds.fallback) {
      current.fallback.add(kind)
    }

    indexedMap.set(key, current)
  }

  const missingMap = new Map(missingRows.map((row) => [row.id, row]))
  const excludedSet = new Set(excludedRows.map((row) => row.id))
  const optionalSet = new Set(optionalRows.map((row) => row.id))
  const notYetSet = new Set(notYetRows.map((row) => row.id))

  const groupStatsMap = new Map<string, GroupStats>()
  const statusCounts: Record<CompletionStatus, number> = {
    indexed: 0,
    blocked_exact: 0,
    unresolved: 0,
    excluded_window: 0,
    optional_secondary: 0,
    not_yet_published: 0,
  }

  const yearStatusMap = new Map<string, Map<number, { actionable: number; operational: number; unresolved: number }>>()

  for (const target of targets) {
    const key = groupKey(target)
    const group =
      groupStatsMap.get(key) ??
      {
        board: target.board || 'Unknown',
        level: target.level || 'Unknown',
        subject: target.subject || 'Unknown',
        targetYears: [],
        actionableResources: 0,
        indexedResources: 0,
        blockedResources: 0,
        unresolvedResources: 0,
        operationalResources: 0,
        indexedCoverageRatio: 0,
        operationalCoverageRatio: 0,
        fullyOperationalYears: [],
        unresolvedYears: [],
      }

    if (typeof target.year === 'number' && !group.targetYears.includes(target.year)) {
      group.targetYears.push(target.year)
    }

    const groupYears = yearStatusMap.get(key) ?? new Map<number, { actionable: number; operational: number; unresolved: number }>()
    const yearBucket =
      groupYears.get(target.year as number) ?? { actionable: 0, operational: 0, unresolved: 0 }

    for (const expectedResource of target.expected_resources ?? []) {
      const resourceId = `${target.id || `${key}|${target.year}`}__${expectedResource}`
      let status: CompletionStatus

      if (excludedSet.has(resourceId)) {
        status = 'excluded_window'
      } else if (optionalSet.has(resourceId)) {
        status = 'optional_secondary'
      } else if (notYetSet.has(resourceId)) {
        status = 'not_yet_published'
      } else {
        const indexed = indexedMap.get(groupYearKey(target))
        const covered =
          indexed?.actual.has(expectedResource) || indexed?.fallback.has(expectedResource) || false
        if (covered) {
          status = 'indexed'
        } else {
          const missing = missingMap.get(resourceId)
          if (missing?.queue_status === 'access_blocked') {
            status = 'blocked_exact'
          } else {
            status = 'unresolved'
          }
        }
      }

      statusCounts[status] += 1

      if (status === 'indexed' || status === 'blocked_exact' || status === 'unresolved') {
        group.actionableResources += 1
        yearBucket.actionable += 1
      }

      if (status === 'indexed') {
        group.indexedResources += 1
        group.operationalResources += 1
        yearBucket.operational += 1
      }

      if (status === 'blocked_exact') {
        group.blockedResources += 1
        group.operationalResources += 1
        yearBucket.operational += 1
      }

      if (status === 'unresolved') {
        group.unresolvedResources += 1
        yearBucket.unresolved += 1
      }
    }

    groupYears.set(target.year as number, yearBucket)
    yearStatusMap.set(key, groupYears)
    groupStatsMap.set(key, group)
  }

  const groups = Array.from(groupStatsMap.values())
    .map((group) => {
      const yearBuckets = yearStatusMap.get(groupKey(group)) ?? new Map()
      const fullyOperationalYears = Array.from(yearBuckets.entries())
        .filter(([, bucket]) => bucket.actionable > 0 && bucket.operational >= bucket.actionable)
        .map(([year]) => year)
        .sort((a, b) => a - b)
      const unresolvedYears = Array.from(yearBuckets.entries())
        .filter(([, bucket]) => bucket.unresolved > 0)
        .map(([year]) => year)
        .sort((a, b) => a - b)

      return {
        ...group,
        targetYears: group.targetYears.sort((a, b) => a - b),
        fullyOperationalYears,
        unresolvedYears,
        indexedCoverageRatio: toRatio(group.indexedResources, group.actionableResources),
        operationalCoverageRatio: toRatio(group.operationalResources, group.actionableResources),
      }
    })
    .sort((a, b) => {
      const delta =
        b.operationalCoverageRatio - a.operationalCoverageRatio ||
        a.unresolvedResources - b.unresolvedResources ||
        a.board.localeCompare(b.board) ||
        a.level.localeCompare(b.level) ||
        a.subject.localeCompare(b.subject)
      return delta
    })

  const actionableResources =
    statusCounts.indexed + statusCounts.blocked_exact + statusCounts.unresolved
  const operationalResources = statusCounts.indexed + statusCounts.blocked_exact

  return {
    targetRows: targets.length,
    targetResourceRows: targets.reduce(
      (sum, row) => sum + (row.expected_resources?.length ?? 0),
      0
    ),
    actionableResources,
    indexedResources: statusCounts.indexed,
    blockedExactResources: statusCounts.blocked_exact,
    unresolvedResources: statusCounts.unresolved,
    excludedWindowResources: statusCounts.excluded_window,
    optionalSecondaryResources: statusCounts.optional_secondary,
    notYetPublishedResources: statusCounts.not_yet_published,
    indexedCoverageRatio: toRatio(statusCounts.indexed, actionableResources),
    operationalCoverageRatio: toRatio(operationalResources, actionableResources),
    operationallyComplete: statusCounts.unresolved === 0,
    fullyIndexed: statusCounts.unresolved === 0 && statusCounts.blocked_exact === 0,
    statusCounts,
    groups,
    groupStats: {
      totalGroups: groups.length,
      fullyOperationalGroups: groups.filter((group) => group.unresolvedResources === 0).length,
      partiallyOperationalGroups: groups.filter(
        (group) =>
          group.operationalResources > 0 && group.unresolvedResources > 0
      ).length,
      unresolvedGroups: groups.filter((group) => group.operationalResources === 0).length,
      blockedOnlyGroups: groups.filter(
        (group) => group.blockedResources > 0 && group.indexedResources === 0 && group.unresolvedResources === 0
      ).length,
    },
  }
}

export function getQbankCompletionSummary() {
  return buildSummary()
}
