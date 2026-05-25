import fs from 'node:fs'
import path from 'node:path'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'

export type AbroadDocumentCaseRow = {
  id: string
  rubricType: string
  qualityBand: string
  inputText: string
  outputText: string
  tags: string[]
  searchText: string
}

export type AbroadDocumentCaseMatch = AbroadDocumentCaseRow & {
  matchScore: number
  matchReasons: string[]
}

const DATA_PATH = path.join(process.cwd(), 'data', 'abroad_document_cases_seed.jsonl')
let cachedRows: AbroadDocumentCaseRow[] | null = null

function readJsonl<T>(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return [] as T[]
  }

  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T)
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getRows() {
  if (cachedRows) {
    return cachedRows
  }

  cachedRows = readJsonl<AbroadDocumentCaseRow>(DATA_PATH)
  return cachedRows
}

function isMissingAbroadDocumentCasesTableError(error: unknown) {
  const code = (error as { code?: string })?.code
  const message = String((error as { message?: string })?.message ?? '')
  return code === '42P01' || code === 'PGRST205' || /abroad_document_cases/i.test(message)
}

function scoreDocumentCase(row: AbroadDocumentCaseRow, query: string) {
  const normalizedQuery = normalize(query)
  const haystack = normalize(row.searchText)
  const reasons: string[] = []
  let score = 0

  for (const token of normalizedQuery.split(' ')) {
    if (token.length > 2 && haystack.includes(token)) {
      score += 2
    }
  }

  for (const tag of row.tags) {
    if (normalizedQuery.includes(String(tag).replace(/_/g, ' '))) {
      score += 6
      reasons.push(`tag: ${tag}`)
    }
  }

  if (row.qualityBand === 'mid') score += 2
  if (row.qualityBand === 'low') score += 1

  return { score, reasons }
}

export function searchAbroadDocumentCases(query: string, limit = 4) {
  const matches = getRows()
    .map((row) => {
      const { score, reasons } = scoreDocumentCase(row, query)
      return {
        ...row,
        matchScore: score,
        matchReasons: reasons,
      }
    })
    .filter((row) => row.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit)

  return matches
}

export async function searchAbroadDocumentCasesWithDb(query: string, limit = 4) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const searchTerms = normalize(query)

    const { data, error } = await supabaseAdmin
      .from('abroad_document_cases')
      .select('id, rubric_type, quality_band, input_text, output_text, tags, search_text')
      .textSearch('fts', searchTerms, { type: 'websearch', config: 'english' })
      .limit(limit * 2)

    if (error) {
      throw error
    }

    const rows =
      ((data as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
        id: String(row.id),
        rubricType: String(row.rubric_type),
        qualityBand: String(row.quality_band ?? ''),
        inputText: String(row.input_text),
        outputText: String(row.output_text),
        tags: (row.tags as string[] | null) ?? [],
        searchText: String(row.search_text),
      })) as AbroadDocumentCaseRow[]

    const rescored = rows
      .map((row) => {
        const { score, reasons } = scoreDocumentCase(row, query)
        return { ...row, matchScore: score, matchReasons: reasons }
      })
      .filter((row) => row.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit)

    if (rescored.length > 0) {
      return rescored
    }
  } catch (error) {
    if (!isMissingAbroadDocumentCasesTableError(error)) {
      throw error
    }
  }

  return searchAbroadDocumentCases(query, limit)
}

export function runDocumentChecklist(summary: string) {
  const normalized = normalize(summary)
  const issues: Array<{ label: string; severity: 'high' | 'medium' | 'low'; detail: string }> = []
  const nextSteps: string[] = []
  const hasPassportRecordPair =
    normalized.includes('passport') &&
    (normalized.includes('transcript') ||
      normalized.includes('academic record') ||
      normalized.includes('academic file') ||
      normalized.includes('certificate'))
  const hasNameMismatchSignal =
    normalized.includes('mismatch') ||
    normalized.includes('different name') ||
    normalized.includes('name mismatch') ||
    normalized.includes('names are different') ||
    normalized.includes('name are different') ||
    (normalized.includes('passport name') &&
      normalized.includes('transcript name') &&
      normalized.includes('different')) ||
    /\bmd\b/.test(normalized)
  const hasMissingAcademicRecord =
    normalized.includes('missing semester') ||
    normalized.includes('missing marksheet') ||
    normalized.includes('one semester missing') ||
    normalized.includes('semester marksheet') ||
    normalized.includes('marksheet is missing') ||
    normalized.includes('transcript is incomplete') ||
    normalized.includes('incomplete transcript') ||
    (normalized.includes('consolidated transcript') && normalized.includes('incomplete'))

  if (hasPassportRecordPair && hasNameMismatchSignal) {
    issues.push({
      label: 'Name consistency risk',
      severity: 'high',
      detail: 'Passport name and academic-record name look inconsistent enough to trigger verification questions.',
    })
    nextSteps.push('Prepare an affidavit or official supporting explanation for name variation.')
  }

  if (hasMissingAcademicRecord) {
    issues.push({
      label: 'Missing academic record',
      severity: 'high',
      detail: 'A missing semester mark sheet or incomplete transcript can block serious applications.',
    })
    nextSteps.push('Collect the missing semester mark sheet or an official consolidated transcript before applying.')
  }

  if (normalized.includes('top 5') || normalized.includes('rank') || normalized.includes('class position')) {
    issues.push({
      label: 'Unsupported rank claim',
      severity: 'medium',
      detail: 'Ranking claims should not be used unless the institution can certify them.',
    })
    nextSteps.push('Remove ranking claims from SOP/CV unless you have official proof.')
  }

  if (normalized.includes('sealed') || normalized.includes('attest') || normalized.includes('certified')) {
    issues.push({
      label: 'Attestation handling',
      severity: 'low',
      detail: 'Country or university rules may differ for attestation, sealed copies, and certified translations.',
    })
    nextSteps.push('Check the destination university requirement for attestation, sealed copies, and translations.')
  }

  if (normalized.includes('passport exp') || normalized.includes('passport expired') || normalized.includes('passport expiry')) {
    issues.push({
      label: 'Passport validity risk',
      severity: 'high',
      detail: 'Weak passport validity can delay application or visa steps.',
    })
    nextSteps.push('Renew the passport early if the validity window is weak.')
  }

  if (issues.length === 0) {
    issues.push({
      label: 'No major checklist red flag detected',
      severity: 'low',
      detail: 'The summary does not show an obvious blocker, but country-specific document rules still need checking.',
    })
    nextSteps.push('Do a country-specific document checklist pass before submission.')
  }

  return {
    issues,
    nextSteps: nextSteps.slice(0, 4),
  }
}

export function getAbroadDocumentCaseStats() {
  const rows = getRows()

  return {
    total: rows.length,
    byRubric: Object.fromEntries(
      Object.entries(
        rows.reduce<Record<string, number>>((acc, row) => {
          acc[row.rubricType] = (acc[row.rubricType] ?? 0) + 1
          return acc
        }, {})
      ).sort((a, b) => b[1] - a[1])
    ),
    byQualityBand: Object.fromEntries(
      Object.entries(
        rows.reduce<Record<string, number>>((acc, row) => {
          const key = row.qualityBand || 'unknown'
          acc[key] = (acc[key] ?? 0) + 1
          return acc
        }, {})
      ).sort((a, b) => b[1] - a[1])
    ),
  }
}
