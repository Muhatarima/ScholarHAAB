import fs from 'node:fs'
import path from 'node:path'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'

export type AbroadGuidanceRow = {
  id: string
  recordType: string
  jurisdiction: string
  topic: string
  title: string
  content: string
  sourceUrl: string | null
  sourceKind: string
  lastChecked: string | null
  tags: string[]
}

export type AbroadGuidanceMatch = AbroadGuidanceRow & {
  matchScore: number
  matchReasons: string[]
}

const DATA_PATH = path.join(process.cwd(), 'data', 'abroad_guidance_seed.jsonl')
let cachedRows: AbroadGuidanceRow[] | null = null

const JURISDICTIONS = ['uk', 'canada', 'australia', 'germany', 'japan', 'usa', 'global']
const TOPIC_HINTS = [
  'visa',
  'work',
  'funds',
  'finance',
  'budget',
  'living',
  'proof',
  'ielts',
  'toefl',
  'gre',
  'exam',
]

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

  cachedRows = readJsonl<AbroadGuidanceRow>(DATA_PATH)
  return cachedRows
}

function isMissingAbroadGuidanceTableError(error: unknown) {
  const code = (error as { code?: string })?.code
  const message = String((error as { message?: string })?.message ?? '')
  return code === '42P01' || code === 'PGRST205' || /abroad_guidance/i.test(message)
}

export function parseAbroadGuidanceQuery(query: string) {
  const normalized = normalize(query)
  return {
    raw: query,
    normalized,
    jurisdiction: JURISDICTIONS.find((item) => normalized.includes(item)) ?? null,
    topicHints: TOPIC_HINTS.filter((item) => normalized.includes(item)),
  }
}

export function searchAbroadGuidance(query: string, limit = 6) {
  const parsed = parseAbroadGuidanceQuery(query)
  const matches = getRows()
    .map((row) => {
      let score = 0
      const reasons: string[] = []
      const haystack = normalize(
        [row.jurisdiction, row.topic, row.title, row.content, ...(row.tags ?? [])].join(' ')
      )

      for (const token of parsed.normalized.split(' ')) {
        if (token.length > 2 && haystack.includes(token)) {
          score += 2
        }
      }

      if (parsed.jurisdiction && haystack.includes(parsed.jurisdiction)) {
        score += 10
        reasons.push(`country: ${parsed.jurisdiction}`)
      }

      if (parsed.topicHints.length > 0) {
        for (const hint of parsed.topicHints) {
          if (haystack.includes(hint)) {
            score += 5
            reasons.push(`topic: ${hint}`)
          }
        }
      }

      if (row.sourceKind.includes('official')) {
        score += 4
      }

      return {
        ...row,
        matchScore: score,
        matchReasons: Array.from(new Set(reasons)),
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

export async function searchAbroadGuidanceWithDb(query: string, limit = 6) {
  const parsed = parseAbroadGuidanceQuery(query)

  try {
    const supabaseAdmin = getSupabaseAdmin()
    const searchTerms = [
      parsed.jurisdiction,
      ...parsed.topicHints,
      ...parsed.normalized.split(' ').filter((token) => token.length > 2),
    ]
      .filter(Boolean)
      .join(' ')

    const { data, error } = await supabaseAdmin
      .from('abroad_guidance')
      .select('id, record_type, jurisdiction, topic, title, content, source_url, source_kind, last_checked, tags')
      .textSearch('fts', searchTerms, { type: 'websearch', config: 'english' })
      .limit(limit * 2)

    if (error) {
      throw error
    }

    const rows =
      ((data as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
        id: String(row.id),
        recordType: String(row.record_type),
        jurisdiction: String(row.jurisdiction),
        topic: String(row.topic),
        title: String(row.title),
        content: String(row.content),
        sourceUrl: (row.source_url as string | null) ?? null,
        sourceKind: String(row.source_kind),
        lastChecked: (row.last_checked as string | null) ?? null,
        tags: (row.tags as string[] | null) ?? [],
      })) as AbroadGuidanceRow[]

    const rescored = rows
      .map((row) => {
        let score = 0
        const reasons: string[] = []
        const haystack = normalize(
          [row.jurisdiction, row.topic, row.title, row.content, ...(row.tags ?? [])].join(' ')
        )

        for (const token of parsed.normalized.split(' ')) {
          if (token.length > 2 && haystack.includes(token)) {
            score += 2
          }
        }

        if (parsed.jurisdiction && haystack.includes(parsed.jurisdiction)) {
          score += 10
          reasons.push(`country: ${parsed.jurisdiction}`)
        }

        for (const hint of parsed.topicHints) {
          if (haystack.includes(hint)) {
            score += 5
            reasons.push(`topic: ${hint}`)
          }
        }

        if (row.sourceKind.includes('official')) {
          score += 4
        }

        return {
          ...row,
          matchScore: score,
          matchReasons: Array.from(new Set(reasons)),
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
    if (!isMissingAbroadGuidanceTableError(error)) {
      throw error
    }
  }

  return {
    ...searchAbroadGuidance(query, limit),
    source: 'seed' as const,
  }
}

export function getAbroadGuidanceStats() {
  const rows = getRows()
  return {
    total: rows.length,
    byJurisdiction: Object.fromEntries(
      Object.entries(
        rows.reduce<Record<string, number>>((acc, row) => {
          acc[row.jurisdiction] = (acc[row.jurisdiction] ?? 0) + 1
          return acc
        }, {})
      ).sort((a, b) => b[1] - a[1])
    ),
    byType: Object.fromEntries(
      Object.entries(
        rows.reduce<Record<string, number>>((acc, row) => {
          acc[row.recordType] = (acc[row.recordType] ?? 0) + 1
          return acc
        }, {})
      ).sort((a, b) => b[1] - a[1])
    ),
  }
}
