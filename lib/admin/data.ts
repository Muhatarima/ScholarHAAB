import { getAnswerCacheStats } from '@/lib/responseCache'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'

export type AdminQueryLogRow = {
  id: string
  user_id: string | null
  user_email: string | null
  message: string | null
  query_type: string | null
  subject: string | null
  tokens_used: number | null
  from_cache: boolean | null
  cost_usd: number | null
  response_ms: number | null
  created_at: string | null
}

type CountResult = {
  count: number
}

type DailyCostPoint = {
  date: string
  label: string
  totalQueries: number
  totalTokens: number
  totalCostUsd: number
  cacheHits: number
}

type TopQuestionPoint = {
  message: string
  count: number
  queryType: string | null
  subject: string | null
  lastSeenAt: string | null
}

function hasSupabaseAdminConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
}

function isMissingAdminInfraError(error: unknown) {
  const code = (error as { code?: string })?.code
  const message = String((error as { message?: string })?.message ?? '')
  return code === '42P01' || code === 'PGRST205' || /query_logs|profiles|daily_stats/i.test(message)
}

function toDayKey(dateString: string | null | undefined) {
  return String(dateString ?? '').slice(0, 10)
}

function formatDayLabel(dayKey: string) {
  if (!dayKey) {
    return 'Unknown'
  }

  const date = new Date(`${dayKey}T00:00:00Z`)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Dhaka',
  }).format(date)
}

function compactMessage(message: string | null | undefined, maxLength = 120) {
  const normalized = String(message ?? '').replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, maxLength - 3).trim()}...`
}

export function buildDailyCostSeries(rows: AdminQueryLogRow[], days = 7): DailyCostPoint[] {
  const today = new Date()
  const buckets = new Map<string, DailyCostPoint>()

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today)
    date.setUTCDate(today.getUTCDate() - offset)
    const key = date.toISOString().slice(0, 10)
    buckets.set(key, {
      date: key,
      label: formatDayLabel(key),
      totalQueries: 0,
      totalTokens: 0,
      totalCostUsd: 0,
      cacheHits: 0,
    })
  }

  for (const row of rows) {
    const dayKey = toDayKey(row.created_at)
    const bucket = buckets.get(dayKey)
    if (!bucket) {
      continue
    }

    bucket.totalQueries += 1
    bucket.totalTokens += Number(row.tokens_used ?? 0)
    bucket.totalCostUsd += Number(row.cost_usd ?? 0)
    if (row.from_cache) {
      bucket.cacheHits += 1
    }
  }

  return Array.from(buckets.values()).map((bucket) => ({
    ...bucket,
    totalCostUsd: Number(bucket.totalCostUsd.toFixed(6)),
  }))
}

export function buildTopQuestions(rows: AdminQueryLogRow[], limit = 8): TopQuestionPoint[] {
  const grouped = new Map<
    string,
    {
      message: string
      count: number
      queryType: string | null
      subject: string | null
      lastSeenAt: string | null
    }
  >()

  for (const row of rows) {
    const normalized = compactMessage(row.message, 180)
    if (!normalized) {
      continue
    }

    const key = normalized.toLowerCase()
    const existing = grouped.get(key)

    if (existing) {
      existing.count += 1
      if ((row.created_at ?? '') > (existing.lastSeenAt ?? '')) {
        existing.lastSeenAt = row.created_at ?? null
        existing.queryType = row.query_type ?? existing.queryType
        existing.subject = row.subject ?? existing.subject
        existing.message = normalized
      }
      continue
    }

    grouped.set(key, {
      message: normalized,
      count: 1,
      queryType: row.query_type ?? null,
      subject: row.subject ?? null,
      lastSeenAt: row.created_at ?? null,
    })
  }

  return Array.from(grouped.values())
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count
      }

      return String(right.lastSeenAt ?? '').localeCompare(String(left.lastSeenAt ?? ''))
    })
    .slice(0, limit)
}

async function safeExactCount(table: string): Promise<CountResult> {
  if (!hasSupabaseAdminConfig()) {
    return { count: 0 }
  }

  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { count, error } = await supabaseAdmin.from(table).select('id', { count: 'exact', head: true })
    if (error) {
      throw error
    }

    return { count: count ?? 0 }
  } catch (error) {
    if (isMissingAdminInfraError(error)) {
      return { count: 0 }
    }

    throw error
  }
}

async function readQueryLogsSince({
  sinceIso,
  limit,
}: {
  sinceIso: string
  limit: number
}) {
  if (!hasSupabaseAdminConfig()) {
    return [] as AdminQueryLogRow[]
  }

  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { data, error } = await supabaseAdmin
      .from('query_logs')
      .select('id, user_id, user_email, message, query_type, subject, tokens_used, from_cache, cost_usd, response_ms, created_at')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      throw error
    }

    return (data as AdminQueryLogRow[] | null) ?? []
  } catch (error) {
    if (isMissingAdminInfraError(error)) {
      return []
    }

    throw error
  }
}

export async function getRecentLogs(limit = 50) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const rows = await readQueryLogsSince({ sinceIso: since, limit: Math.max(limit, 1) })
  return rows.slice(0, limit)
}

export async function getActiveUsers(days = 7) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const rows = await readQueryLogsSince({ sinceIso: since, limit: 1000 })
  const unique = new Set(rows.map((row) => row.user_id).filter((value): value is string => Boolean(value)))
  return unique.size
}

export async function getAdminStats() {
  const sevenDaySince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const thirtyDaySince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const todayKey = new Date().toISOString().slice(0, 10)

  const [users, queries, sevenDayRows, thirtyDayRows, cacheStats] = await Promise.all([
    safeExactCount('profiles'),
    safeExactCount('query_logs'),
    readQueryLogsSince({ sinceIso: sevenDaySince, limit: 1000 }),
    readQueryLogsSince({ sinceIso: thirtyDaySince, limit: 1500 }),
    getAnswerCacheStats(),
  ])

  const todayRows = sevenDayRows.filter((row) => toDayKey(row.created_at) === todayKey)
  const todayQueries = todayRows.length
  const todayTokens = todayRows.reduce((sum, row) => sum + Number(row.tokens_used ?? 0), 0)
  const todayCostValue = todayRows.reduce((sum, row) => sum + Number(row.cost_usd ?? 0), 0)
  const todayCost = Number(todayCostValue.toFixed(6))
  const cacheHitRate =
    sevenDayRows.length > 0
      ? Math.round((sevenDayRows.filter((row) => row.from_cache).length / sevenDayRows.length) * 100)
      : 0
  const avgResponseMs =
    todayRows.length > 0
      ? Math.round(
          todayRows.reduce((sum, row) => sum + Number(row.response_ms ?? 0), 0) / todayRows.length
        )
      : 0

  return {
    totalUsers: users.count,
    totalQueries: queries.count,
    todayQueries,
    todayTokens,
    todayCost,
    cacheHitRate,
    avgResponseMs,
    activeUsers: new Set(
      sevenDayRows.map((row) => row.user_id).filter((value): value is string => Boolean(value))
    ).size,
    topQuestions: buildTopQuestions(thirtyDayRows, 8),
    costByDay: buildDailyCostSeries(sevenDayRows, 7),
    cacheStats,
  }
}
