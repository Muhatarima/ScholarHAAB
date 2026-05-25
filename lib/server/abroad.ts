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

export type AbroadScholarshipSearchResult = {
  parsed: AbroadParsedQuery
  matches: AbroadScholarshipMatch[]
  source: 'db' | 'seed'
  exactMatchCount: number
  broadened: boolean
}

const DATA_PATH = path.join(process.cwd(), 'data', 'abroad_scholarship_seed.jsonl')
let cachedRows: AbroadScholarshipRow[] | null = null

const JURISDICTION_ALIASES: Record<string, string[]> = {
  Australia: ['australia', 'aussie'],
  Canada: ['canada'],
  Germany: ['germany', 'german'],
  Japan: ['japan'],
  Europe: ['europe', 'european'],
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
  Italy: ['italy'],
  Sweden: ['sweden'],
  Finland: ['finland'],
  Norway: ['norway'],
  Denmark: ['denmark'],
  Austria: ['austria'],
}

const EUROPEAN_JURISDICTIONS = new Set([
  'Austria',
  'Belgium',
  'Denmark',
  'Finland',
  'France',
  'Germany',
  'Hungary',
  'Italy',
  'Netherlands',
  'Norway',
  'Sweden',
  'Switzerland',
  'Turkey',
  'United Kingdom',
])

const DEGREE_ALIASES: Record<string, string[]> = {
  Bachelors: ['bachelor', 'bachelors', 'bsc', 'bs', 'undergraduate', 'undergrad', 'hsc'],
  Masters: ['masters', 'master', 'ms', 'msc', 'mtech', 'ma', 'mba', 'postgraduate'],
  PhD: ['phd', 'ph d', 'doctorate', 'doctoral'],
  Research: ['research', 'research based', 'research-based'],
}

const FIELD_ALIASES: Record<string, string[]> = {
  'Computer Science': ['cse', 'computer science', 'software', 'ai', 'data science', 'cs'],
  Engineering: ['engineering', 'engineer', 'eee', 'civil', 'mechanical', 'electrical', 'electronic'],
  Business: ['business', 'bba', 'mba', 'management', 'finance', 'marketing'],
  Economics: ['economics', 'econ', 'development'],
  Biology: ['biology', 'bio', 'biotech', 'biotechnology'],
  Chemistry: ['chemistry', 'chem'],
  Physics: ['physics'],
  Medicine: ['medicine', 'mbbs', 'medical', 'public health'],
  Mathematics: ['mathematics', 'math', 'maths', 'statistics'],
  ICT: ['ict', 'information technology', 'it', 'computing'],
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
    .replace(/['’]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function hasAlias(normalized: string, alias: string) {
  const pattern = new RegExp(`(?:^|\\b)${escapeRegex(alias).replace(/\s+/g, '\\s+')}(?:\\b|$)`, 'i')
  return pattern.test(normalized)
}

function extractAliasMatch(
  normalized: string,
  aliasMap: Record<string, string[]>
) {
  for (const [canonical, aliases] of Object.entries(aliasMap)) {
    if (aliases.some((alias) => hasAlias(normalized, alias))) {
      return canonical
    }
  }

  return null
}

export function parseAbroadQuery(query: string): AbroadParsedQuery {
  const normalized = normalize(query)
  const fundingNeed =
    /\b(fully funded|full funding|full scholarship|full free|full ride)\b/.test(normalized)
    ? 'full'
    : /\b(partial|partially funded|partial funding)\b/.test(normalized)
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

export function countDetectedAbroadFilters(parsed: AbroadParsedQuery) {
  return [
    Boolean(parsed.jurisdiction),
    Boolean(parsed.degreeLevel),
    Boolean(parsed.field),
    parsed.fundingNeed !== 'any',
  ].filter(Boolean).length
}

function includesLoose(haystack: string | null | undefined, needle: string | null | undefined) {
  if (!haystack || !needle) {
    return false
  }

  return normalize(haystack).includes(normalize(needle))
}

function matchesStructuredFilters(row: AbroadScholarshipRow, parsed: AbroadParsedQuery) {
  if (
    parsed.jurisdiction === 'Europe' &&
    !EUROPEAN_JURISDICTIONS.has(row.jurisdiction ?? '')
  ) {
    return false
  }

  if (
    parsed.jurisdiction &&
    parsed.jurisdiction !== 'Europe' &&
    !includesLoose(row.jurisdiction, parsed.jurisdiction)
  ) {
    return false
  }

  if (
    parsed.degreeLevel &&
    !row.degreeLevels.some((level) => includesLoose(level, parsed.degreeLevel))
  ) {
    return false
  }

  if (
    parsed.field &&
    !row.fieldsOfStudy.some(
      (field) =>
        includesLoose(field, parsed.field) ||
        includesLoose(parsed.field, field) ||
        includesLoose(field, 'any')
    )
  ) {
    return false
  }

  if (parsed.fundingNeed === 'full' && !includesLoose(row.fundingType, 'full')) {
    return false
  }

  if (parsed.fundingNeed === 'partial' && !includesLoose(row.fundingType, 'partial')) {
    return false
  }

  return true
}

function scoreRow(row: AbroadScholarshipRow, parsed: AbroadParsedQuery) {
  const reasons: string[] = []
  let score = 0
  const genericTokens = new Set([
    'scholarship',
    'scholarships',
    'funded',
    'funding',
    'masters',
    'master',
    'phd',
    'bachelor',
    'bachelors',
    'student',
    'students',
    'study',
    'abroad',
    'deadline',
    'what',
    'which',
    'tell',
    'for',
    'from',
    'with',
  ])
  const titleProviderHaystack = normalize([row.title, row.provider].filter(Boolean).join(' '))
  const searchHaystack = normalize(row.searchText)

  if (
    parsed.jurisdiction === 'Europe' &&
    EUROPEAN_JURISDICTIONS.has(row.jurisdiction ?? '')
  ) {
    score += 14
    reasons.push(`region fit: Europe (${row.jurisdiction})`)
  } else if (parsed.jurisdiction && includesLoose(row.jurisdiction, parsed.jurisdiction)) {
    score += 16
    reasons.push(`country fit: ${row.jurisdiction}`)
  } else if (parsed.jurisdiction) {
    score -= 10
  }

  if (
    parsed.degreeLevel &&
    row.degreeLevels.some((level) => includesLoose(level, parsed.degreeLevel))
  ) {
    score += 14
    reasons.push(`degree fit: ${parsed.degreeLevel}`)
  } else if (parsed.degreeLevel) {
    score -= 10
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
  } else if (parsed.field) {
    score -= 8
  }

  if (parsed.fundingNeed === 'full' && includesLoose(row.fundingType, 'full')) {
    score += 10
    reasons.push('fully funded')
  } else if (parsed.fundingNeed === 'full') {
    score -= 8
  } else if (parsed.fundingNeed === 'partial' && includesLoose(row.fundingType, 'partial')) {
    score += 6
    reasons.push('partial funding')
  } else if (parsed.fundingNeed === 'partial') {
    score -= 4
  } else if (parsed.fundingNeed === 'any' && row.fundingType) {
    score += 2
  }

  for (const token of parsed.normalized.split(' ')) {
    if (token.length <= 2) {
      continue
    }

    if (titleProviderHaystack.includes(token) && !genericTokens.has(token)) {
      score += 12
      reasons.push(`name fit: ${token}`)
      continue
    }

    if (searchHaystack.includes(token) && !genericTokens.has(token)) {
      score += 3
      reasons.push(`keyword fit: ${token}`)
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
  const filteredRows = getRows().filter((row) => matchesStructuredFilters(row, parsed))
  const rowsToRank = filteredRows.length > 0 ? filteredRows : getRows()
  const matches = rowsToRank
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
    source: 'seed' as const,
    exactMatchCount: filteredRows.length,
    broadened: filteredRows.length === 0,
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
      .limit(limit * 6)

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

    const structuredRows = rows.filter((row) => matchesStructuredFilters(row, parsed))
    const rowsToRank = structuredRows.length > 0 ? structuredRows : rows
    const rescored = rowsToRank
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
        exactMatchCount: structuredRows.length,
        broadened: structuredRows.length === 0,
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

export function isScholarshipSearchQuery(query: string) {
  return /\b(scholarships?|funded|funding|stipend|tuition|deadline|last\s+date|closing\s+date|masters?|phd|doctorate|bachelors?|undergrad|daad|erasmus|chevening|clarendon|mext)\b/i.test(
    query
  )
}

function buildShortMatchReason(match: AbroadScholarshipMatch) {
  const reasons = match.matchReasons
    .filter(Boolean)
    .slice(0, 3)
    .map((reason) => reason.replace(/^country fit:\s*/i, '').replace(/^degree fit:\s*/i, '').replace(/^field fit:\s*/i, ''))

  if (reasons.length === 0) {
    return 'general profile fit'
  }

  return reasons.join(', ')
}

function buildShortlistGoal(parsed: AbroadParsedQuery) {
  const parts = [
    parsed.fundingNeed === 'full'
      ? 'fully funded'
      : parsed.fundingNeed === 'partial'
        ? 'partially funded'
        : null,
    parsed.degreeLevel,
    parsed.jurisdiction ? `in ${parsed.jurisdiction}` : null,
    parsed.field ? `for ${parsed.field}` : null,
  ].filter(Boolean)

  return parts.join(' ')
}

function buildScholarshipSearchHints(parsed: AbroadParsedQuery, query: string) {
  const hints = [
    parsed.jurisdiction ? `${parsed.jurisdiction} scholarships` : null,
    parsed.degreeLevel ? `${parsed.degreeLevel} scholarships` : null,
    parsed.field ? `${parsed.field} scholarships` : null,
    parsed.fundingNeed === 'full'
      ? 'fully funded scholarships'
      : parsed.fundingNeed === 'partial'
        ? 'partial scholarships'
        : null,
  ].filter(Boolean)

  const uniqueHints = Array.from(new Set(hints))
  if (uniqueHints.length > 0) {
    return uniqueHints.slice(0, 3).join(' | ')
  }

  return `${query.trim()} official scholarship`
}

function hasUnknownJurisdictionMention(query: string, parsed: AbroadParsedQuery) {
  if (parsed.jurisdiction) {
    return false
  }

  const normalized = normalize(query)
  const match = normalized.match(
    /\b(?:in|to)\s+([a-z][a-z\s-]{2,40}?)(?=\s+(?:for|with|from|student|students|applicant|applicants|scholarship|scholarships|programme|program|degree|masters?|phd|doctorate|bachelors?|undergrad|who|and|but|need|want)\b|$)/
  )

  if (!match) {
    return false
  }

  const candidate = match[1].trim().replace(/\s+/g, ' ')
  if (!candidate || candidate.length < 3) {
    return false
  }

  const genericLocations = new Set(['abroad', 'overseas', 'outside bangladesh'])
  if (genericLocations.has(candidate)) {
    return false
  }

  const matchesAliasMap = (aliasMap: Record<string, string[]>) =>
    Object.values(aliasMap).some((aliases) =>
      aliases.some((alias) => normalize(alias) === candidate)
    )

  const isKnown =
    matchesAliasMap(JURISDICTION_ALIASES) ||
    matchesAliasMap(FIELD_ALIASES) ||
    matchesAliasMap(DEGREE_ALIASES)

  return !isKnown
}

function hasSpecificScholarshipNameMatch(query: string, match: AbroadScholarshipMatch) {
  const haystack = normalize([match.title, match.provider].filter(Boolean).join(' '))
  const genericTokens = new Set([
    'scholarship',
    'scholarships',
    'funded',
    'funding',
    'deadline',
    'masters',
    'master',
    'phd',
    'bachelor',
    'bachelors',
    'degree',
    'student',
    'students',
    'from',
    'for',
    'what',
    'which',
    'tell',
    'me',
    'the',
    'and',
    'in',
  ])

  return normalize(query)
    .split(' ')
    .filter((token) => token.length >= 4 && !genericTokens.has(token))
    .some((token) => haystack.includes(token))
}

function buildScholarshipCardPayload(matches: AbroadScholarshipMatch[]) {
  return matches.slice(0, 5).map((match) => ({
    name: match.title,
    country: match.jurisdiction ?? 'Check official page',
    degree: match.degreeLevels.join(', ') || 'Check official page',
    funding: match.fundingAmountText ?? match.fundingType ?? 'Check official page',
    deadline: match.deadlineAnnual ?? 'Check official page',
    matchReason: buildShortMatchReason(match),
    link: match.officialUrl ?? undefined,
  }))
}

export function buildAbroadScholarshipShortlistReply(
  parsed: AbroadParsedQuery,
  matches: AbroadScholarshipMatch[]
) {
  if (matches.length === 0) {
    return null
  }

  const goal = buildShortlistGoal(parsed)
  const intro = goal
    ? `For ${goal}, here are your strongest scholarship matches right now:`
    : 'Here are the strongest scholarship matches I can see right now:'
  const payload = JSON.stringify(buildScholarshipCardPayload(matches), null, 2)

  return [
    intro,
    `<scholarships>${payload}</scholarships>`,
    'If you want, send your CGPA and IELTS/GRE status next and I will rank these by realism for your profile.',
  ].join('\n\n')
}

export function buildVerifiedScholarshipReply(
  query: string,
  result: AbroadScholarshipSearchResult
) {
  const normalized = normalize(query)
  const isDeadlineAsk = /\b(deadline|last date|closing date|apply by|due)\b/.test(normalized)
  const topMatch = result.matches[0]
  const specificNameMatch = topMatch ? hasSpecificScholarshipNameMatch(query, topMatch) : false
  const unresolvedJurisdictionMention = hasUnknownJurisdictionMention(query, result.parsed)
  const exactEnough =
    !unresolvedJurisdictionMention &&
    (countDetectedAbroadFilters(result.parsed) >= 2 || specificNameMatch)

  if (!topMatch || !exactEnough) {
    return `I don't have any verified scholarships matching this exactly right now.\n\nTry searching with: ${buildScholarshipSearchHints(result.parsed, query)}`
  }

  if (isDeadlineAsk) {
    if (topMatch.deadlineAnnual) {
      return `In my records, ${topMatch.title} shows the deadline as ${topMatch.deadlineAnnual}.\n\nAlways confirm on the official website before you apply.`
    }

    return `I have ${topMatch.title} in my records, but I'm not certain of the exact deadline from the data I have.\n\nPlease check the official website before applying.`
  }

  return buildAbroadScholarshipShortlistReply(result.parsed, result.matches)
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
