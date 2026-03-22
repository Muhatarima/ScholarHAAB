import fs from 'node:fs'
import path from 'node:path'
import { getAllQbankPaperPairs, getQbankPaperPairStats } from '@/lib/server/qbank-paper-pairs'

type IndexedPaperRow = {
  board?: string
  level?: string
  subject?: string
  resource_type?: string
  year?: number | null
  title?: string
  url?: string
  local_path?: string
  source_page_url?: string
}

type CoverageTargetRow = {
  board?: string
  level?: string
  subject?: string
  year?: number | null
  expected_resources?: string[]
}

type CoverageGroup = {
  board: string
  level: string
  subject: string
  years: number[]
  targetYears: number[]
  coveredYears: number[]
  missingYears: number[]
  targetYearCount: number
  coveredYearCount: number
  coverageRatio: number
  questionPapers: number
  markSchemes: number
  examinerReports: number
  practicalDocs: number
  fullPairs: number
  partialPairs: number
}

const INDEX_PATH = path.join(
  process.cwd(),
  'data',
  'qbank_collection',
  'indexed',
  'downloaded_pdf_index.jsonl'
)
const TARGET_PATH = path.join(process.cwd(), 'data', 'qbank_coverage_targets.jsonl')

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

export function getQbankCoverageSummary() {
  const rows = readJsonl<IndexedPaperRow>(INDEX_PATH).filter(
    (row) => row.board && row.level && row.subject && isCoverageEvidenceRow(row)
  )
  const targets = readJsonl<CoverageTargetRow>(TARGET_PATH).filter(
    (row) => row.board && row.level && row.subject && typeof row.year === 'number'
  )

  const grouped = new Map<string, CoverageGroup>()

  for (const target of targets) {
    const key = groupKey(target)
    const current =
      grouped.get(key) ??
      {
        board: target.board || 'Unknown',
        level: target.level || 'Unknown',
        subject: target.subject || 'Unknown',
        years: [],
        targetYears: [],
        coveredYears: [],
        missingYears: [],
        targetYearCount: 0,
        coveredYearCount: 0,
        coverageRatio: 0,
        questionPapers: 0,
        markSchemes: 0,
        examinerReports: 0,
        practicalDocs: 0,
        fullPairs: 0,
        partialPairs: 0,
      }

    if (typeof target.year === 'number' && !current.targetYears.includes(target.year)) {
      current.targetYears.push(target.year)
    }

    grouped.set(key, current)
  }

  for (const row of rows) {
    const key = groupKey(row)
    const current =
      grouped.get(key) ??
      {
        board: row.board || 'Unknown',
        level: row.level || 'Unknown',
        subject: row.subject || 'Unknown',
        years: [],
        targetYears: [],
        coveredYears: [],
        missingYears: [],
        targetYearCount: 0,
        coveredYearCount: 0,
        coverageRatio: 0,
        questionPapers: 0,
        markSchemes: 0,
        examinerReports: 0,
        practicalDocs: 0,
        fullPairs: 0,
        partialPairs: 0,
      }

    if (typeof row.year === 'number' && !current.years.includes(row.year)) {
      current.years.push(row.year)
    }

    if (row.resource_type === 'question_paper') {
      current.questionPapers += 1
    }

    if (row.resource_type === 'mark_scheme' || row.resource_type === 'specimen_mark_scheme') {
      current.markSchemes += 1
    }

    if (row.resource_type === 'examiner_report') {
      current.examinerReports += 1
    }

    if (row.resource_type === 'confidential_instructions') {
      current.practicalDocs += 1
    }

    grouped.set(key, current)
  }

  const pairStats = getQbankPaperPairStats()
  const pairRows = getAllQbankPaperPairs()

  for (const row of pairRows) {
    const key = groupKey(row)
    const current = grouped.get(key)
    if (!current) {
      continue
    }

    if (row.completeness === 'full') {
      current.fullPairs += 1
    } else {
      current.partialPairs += 1
    }
  }

  const groups = Array.from(grouped.values())
    .map((group) => ({
      ...group,
      years: group.years.sort((a, b) => a - b),
      targetYears: group.targetYears.sort((a, b) => a - b),
      coveredYears: (group.targetYears.length > 0 ? group.years.filter((year) => group.targetYears.includes(year)) : group.years).sort(
        (a, b) => a - b
      ),
      missingYears: group.targetYears.filter((year) => !group.years.includes(year)).sort((a, b) => a - b),
      targetYearCount: group.targetYears.length,
      coveredYearCount:
        group.targetYears.length > 0
          ? group.years.filter((year) => group.targetYears.includes(year)).length
          : group.years.length,
      coverageRatio:
        group.targetYears.length > 0
          ? Number(
              (
                group.years.filter((year) => group.targetYears.includes(year)).length /
                group.targetYears.length
              ).toFixed(2)
            )
          : group.years.length > 0
            ? 1
            : 0,
    }))
    .sort((a, b) => {
      const coverageA =
        a.coverageRatio * 100 + a.fullPairs * 10 + a.questionPapers + a.markSchemes
      const coverageB =
        b.coverageRatio * 100 + b.fullPairs * 10 + b.questionPapers + b.markSchemes
      return coverageB - coverageA
    })

  return {
    indexedRows: rows.length,
    targetRows: targets.length,
    pairStats,
    groups,
    targetStats: {
      boardLevelSubjectGroups: groups.length,
      targetedGroups: groups.filter((group) => group.targetYearCount > 0).length,
      fullyCoveredGroups: groups.filter(
        (group) => group.targetYearCount > 0 && group.coveredYearCount >= group.targetYearCount
      ).length,
      partiallyCoveredGroups: groups.filter(
        (group) =>
          group.targetYearCount > 0 &&
          group.coveredYearCount > 0 &&
          group.coveredYearCount < group.targetYearCount
      ).length,
      uncoveredGroups: groups.filter(
        (group) => group.targetYearCount > 0 && group.coveredYearCount === 0
      ).length,
    },
    boardCounts: groups.reduce<Record<string, number>>((acc, group) => {
      acc[group.board] = (acc[group.board] ?? 0) + 1
      return acc
    }, {}),
    subjectCounts: groups.reduce<Record<string, number>>((acc, group) => {
      acc[group.subject] = (acc[group.subject] ?? 0) + 1
      return acc
    }, {}),
  }
}
