import fs from 'node:fs'
import path from 'node:path'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'

export type AbroadScholarshipRow = {
  id: string
  title: string
  provider: string | null
  jurisdiction: string | null
  degreeLevels: string[]
  fieldsOfStudy: string[]
  fundingType: string | null
  fundingAmountText: string | null
  deadlineAnnual: string | null
  deadlineNotes: string | null
  officialUrl: string | null
  lastChecked: string | null
  authenticityStatus: string | null
  liveAnswerMode: string | null
  caution: string | null
  searchText: string
}

export type AbroadParsedQuery = {
  raw: string
  normalized: string
  jurisdiction: string | null
  degreeLevel: string | null
  field: string | null
  fundingNeed: 'full' | 'partial' | 'any'
  profileHints: string[]
}

export type AbroadScholarshipMatch = {
  id: string
  title: string
  provider: string | null
  jurisdiction: string | null
  degreeLevels: string[]
  fieldsOfStudy: string[]
  fundingType: string | null
  fundingAmountText: string | null
  deadlineAnnual: string | null
  deadlineNotes: string | null
  officialUrl: string | null
  lastChecked: string | null
  authenticityStatus: string | null
  liveAnswerMode: string | null
  caution: string | null
  matchScore: number
  matchReasons: string[]
}

const DATA_PATH = path.join(process.cwd(), 'data', 'abroad_scholarship_seed.jsonl')
let cachedRows: AbroadScholarshipRow[] | null = null

const JURISDICTION_ALIASES: Record<string, string[]> = {
  Australia: ['australia', 'aussie'],
  Canada: ['canada'],
  Germany: ['germany', 'german'],
  Japan: ['japan'],
  Hungary: ['hungary'],
  Korea: ['korea', 'south korea'],
  Turkey: ['turkey', 'turkiye'],
  'United Kingdom': ['uk', 'united kingdom', 'britain', 'england'],
  'United States': ['usa', 'us', 'united states', 'america'],
  Belgium: ['belgium'],
  Switzerland: ['switzerland', 'swiss'],
  China: ['china'],
  France: ['france'],
  Netherlands: ['netherlands', 'holland'],
}

const DEGREE_ALIASES: Record<string, string[]> = {
  Bachelors: ['bachelor', 'bachelors', 'undergraduate', 'undergrad', 'hsc'],
  Masters: ['masters', 'master', 'msc', 'ma', 'mba', 'postgraduate'],
  PhD: ['phd', 'doctorate', 'doctoral', 'research'],
}

const FIELD_ALIASES: Record<string, string[]> = {
  Engineering: ['engineering', 'engineer', 'eee', 'civil', 'mechanical', 'electrical'],
  'Computer Science': ['cse', 'computer science', 'software', 'ai', 'data science', 'cs'],
  Business: ['business', 'bba', 'mba', 'management', 'finance', 'marketing'],
  Economics: ['economics', 'econ', 'development'],
  Biology: ['biology', 'bio', 'biotech', 'biotechnology'],
  Chemistry: ['chemistry', 'chem'],
  Physics: ['physics'],
  Medicine: ['medicine', 'mbbs', 'medical', 'public health'],
  Any: ['any', 'open subject', 'all subject'],
}

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

function getRows() {
  if (cachedRows) {
    return cachedRows
  }

  cachedRows = readJsonl<AbroadScholarshipRow>(DATA_PATH)
  return cachedRows
}

function isMissingAbroadScholarshipTableError(error: unknown) {
  const code = (error as { code?: string })?.code
  const message = String((error as { message?: string })?.message ?? '')
  return code === '42P01' || code === 'PGRST205' || /abroad_scholarships/i.test(message)
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractAliasMatch(
  normalized: string,
  aliasMap: Record<string, string[]>
) {
  for (const [canonical, aliases] of Object.entries(aliasMap)) {
    if (aliases.some((alias) => normalized.includes(alias))) {
      return canonical
    }
  }

  return null
}

export function parseAbroadQuery(query: string): AbroadParsedQuery {
  const normalized = normalize(query)
  const fundingNeed = normalized.includes('full') || normalized.includes('fully funded')
    ? 'full'
    : normalized.includes('partial') || normalized.includes('partially funded')
      ? 'partial'
      : 'any'

  const profileHints = [
    'cgpa',
    'research',
    'publication',
    'ielts',
    'gre',
    'work experience',
    'leadership',
    'women',
    'low budget',
  ].filter((hint) => normalized.includes(hint))

  return {
    raw: query,
    normalized,
    jurisdiction: extractAliasMatch(normalized, JURISDICTION_ALIASES),
    degreeLevel: extractAliasMatch(normalized, DEGREE_ALIASES),
    field: extractAliasMatch(normalized, FIELD_ALIASES),
    fundingNeed,
    profileHints,
  }
}

function includesLoose(haystack: string | null | undefined, needle: string | null | undefined) {
  if (!haystack || !needle) {
    return false
  }

  return normalize(haystack).includes(normalize(needle))
}

function scoreRow(row: AbroadScholarshipRow, parsed: AbroadParsedQuery) {
  const reasons: string[] = []
  let score = 0

  if (parsed.jurisdiction && includesLoose(row.jurisdiction, parsed.jurisdiction)) {
    score += 16
    reasons.push(`country fit: ${row.jurisdiction}`)
  }

  if (
    parsed.degreeLevel &&
    row.degreeLevels.some((level) => includesLoose(level, parsed.degreeLevel))
  ) {
    score += 14
    reasons.push(`degree fit: ${parsed.degreeLevel}`)
  }

  if (
    parsed.field &&
    row.fieldsOfStudy.some(
      (field) =>
        includesLoose(field, parsed.field) ||
        includesLoose(parsed.field, field) ||
        includesLoose(field, 'any')
    )
  ) {
    score += 12
    reasons.push(`field fit: ${parsed.field}`)
  }

  if (parsed.fundingNeed === 'full' && includesLoose(row.fundingType, 'full')) {
    score += 10
    reasons.push('fully funded')
  } else if (parsed.fundingNeed === 'partial' && includesLoose(row.fundingType, 'partial')) {
    score += 6
    reasons.push('partial funding')
  } else if (parsed.fundingNeed === 'any' && row.fundingType) {
    score += 2
  }

  for (const token of parsed.normalized.split(' ')) {
    if (token.length > 2 && normalize(row.searchText).includes(token)) {
      score += 1
    }
  }

  if (row.authenticityStatus === 'verified-live') {
    score += 6
  }

  if (row.liveAnswerMode?.includes('ready')) {
    score += 4
  }

  return { score, reasons }
}

export function searchAbroadScholarships(query: string, limit = 8) {
  const parsed = parseAbroadQuery(query)
  const matches = getRows()
    .map((row) => {
      const { score, reasons } = scoreRow(row, parsed)
      return {
        ...row,
        matchScore: score,
        matchReasons: reasons,
      }
    })
    .filter((row) => row.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit)

  return {
    parsed,
    matches,
  }
}

export async function searchAbroadScholarshipsWithDb(query: string, limit = 8) {
  const parsed = parseAbroadQuery(query)

  try {
    const supabaseAdmin = getSupabaseAdmin()
    const searchTerms = [
      parsed.jurisdiction,
      parsed.degreeLevel,
      parsed.field,
      parsed.fundingNeed !== 'any' ? parsed.fundingNeed : null,
      ...parsed.profileHints,
      ...parsed.normalized.split(' ').filter((token) => token.length > 2),
    ]
      .filter(Boolean)
      .join(' ')

    const { data, error } = await supabaseAdmin
      .from('abroad_scholarships')
      .select(
        'id, title, provider, jurisdiction, degree_levels, fields_of_study, funding_type, funding_amount_text, deadline_annual, deadline_notes, official_url, last_checked, authenticity_status, live_answer_mode, caution, search_text'
      )
      .textSearch('fts', searchTerms, { type: 'websearch', config: 'english' })
      .limit(limit * 2)

    if (error) {
      throw error
    }

    const rows =
      ((data as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
        id: String(row.id),
        title: String(row.title),
        provider: (row.provider as string | null) ?? null,
        jurisdiction: (row.jurisdiction as string | null) ?? null,
        degreeLevels: (row.degree_levels as string[] | null) ?? [],
        fieldsOfStudy: (row.fields_of_study as string[] | null) ?? [],
        fundingType: (row.funding_type as string | null) ?? null,
        fundingAmountText: (row.funding_amount_text as string | null) ?? null,
        deadlineAnnual: (row.deadline_annual as string | null) ?? null,
        deadlineNotes: (row.deadline_notes as string | null) ?? null,
        officialUrl: (row.official_url as string | null) ?? null,
        lastChecked: (row.last_checked as string | null) ?? null,
        authenticityStatus: (row.authenticity_status as string | null) ?? null,
        liveAnswerMode: (row.live_answer_mode as string | null) ?? null,
        caution: (row.caution as string | null) ?? null,
        searchText: (row.search_text as string) ?? '',
      })) as AbroadScholarshipRow[]

    const rescored = rows
      .map((row) => {
        const { score, reasons } = scoreRow(row, parsed)
        return {
          ...row,
          matchScore: score,
          matchReasons: reasons,
        }
      })
      .filter((row) => row.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit)

    if (rescored.length > 0) {
      return {
        parsed,
        matches: rescored,
        source: 'db' as const,
      }
    }
  } catch (error) {
    if (!isMissingAbroadScholarshipTableError(error)) {
      throw error
    }
  }

  return {
    ...searchAbroadScholarships(query, limit),
    source: 'seed' as const,
  }
}

export function getAbroadScholarshipStats() {
  const rows = getRows()
  const countBy = (values: string[]) =>
    Object.fromEntries(
      Object.entries(
        values.reduce<Record<string, number>>((acc, value) => {
          acc[value] = (acc[value] ?? 0) + 1
          return acc
        }, {})
      ).sort((a, b) => b[1] - a[1])
    )

  return {
    total: rows.length,
    jurisdictions: countBy(rows.map((row) => row.jurisdiction ?? 'Unknown')),
    degrees: countBy(rows.flatMap((row) => row.degreeLevels)),
    fundingTypes: countBy(rows.map((row) => row.fundingType ?? 'Unknown')),
  }
}
