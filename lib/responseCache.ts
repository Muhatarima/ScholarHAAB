import { CACHE_TTL_DAYS, type CacheIntent } from '@/lib/cacheKey'
import type { SessionContext } from '@/lib/sessionContext'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'
import { logError } from '@/lib/server/logger'

export type CachedAnswer = {
  response: string
  sources: unknown[]
  confidence: number | null
}

export type AnswerCacheStats = {
  totalEntries: number
  totalHits: number
  avgHitsPerEntry: number
  hotEntries: number
  hitsToday: number
  hitRate: number
}

type AnswerCacheRow = {
  response: string
  sources: unknown[] | null
  confidence: number | null
  hit_count?: number | null
}

const ANSWER_CACHE_READ_TIMEOUT_MS = Number(process.env.ANSWER_CACHE_READ_TIMEOUT_MS || 200)
let answerCacheAvailable: boolean | null = null

function hasSupabaseAdminConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
}

function isMissingAnswerCacheInfraError(error: unknown) {
  const code = (error as { code?: string })?.code
  const message = String((error as { message?: string })?.message ?? '')
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    code === '42883' ||
    /answer_cache|increment_answer_cache_hit|get_answer_cache_stats/i.test(message)
  )
}

function normalizeNumber(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return 0
  }

  return parsed
}

function sleep(ms: number) {
  return new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), ms)
  })
}

function scheduleCacheHitIncrement(queryHash: string) {
  queueMicrotask(() => {
    void (async () => {
      if (!hasSupabaseAdminConfig() || answerCacheAvailable === false) {
        return
      }

      try {
        const { data, error } = await getSupabaseAdmin()
          .from('answer_cache')
          .select('hit_count')
          .eq('query_hash', queryHash)
          .maybeSingle()

        if (error) {
          throw error
        }

        if (!data) {
          return
        }

        const currentHitCount =
          typeof data.hit_count === 'number' && Number.isFinite(data.hit_count) ? data.hit_count : 1

        const { error: updateError } = await getSupabaseAdmin()
          .from('answer_cache')
          .update({
            hit_count: currentHitCount + 1,
            last_hit_at: new Date().toISOString(),
          })
          .eq('query_hash', queryHash)

        if (updateError) {
          throw updateError
        }

        answerCacheAvailable = true
      } catch (error) {
        if (isMissingAnswerCacheInfraError(error)) {
          answerCacheAvailable = false
          return
        }

        logError('answer_cache_hit_increment_failed', error, { query_hash: queryHash.slice(0, 12) })
      }
    })()
  })
}

export function isCacheableIntent(intent: string) {
  return (CACHE_TTL_DAYS[intent] ?? 7) > 0
}

export async function getCached(queryHash: string): Promise<CachedAnswer | null> {
  if (!hasSupabaseAdminConfig() || answerCacheAvailable === false) {
    return null
  }

  const lookupPromise = (async () => {
    const { data, error } = await getSupabaseAdmin()
      .from('answer_cache')
      .select('response, sources, confidence')
      .eq('query_hash', queryHash)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (error) {
      throw error
    }

    answerCacheAvailable = true
    const row = data as AnswerCacheRow | null
    if (!row) {
      return null
    }

    scheduleCacheHitIncrement(queryHash)

    return {
      response: row.response,
      sources: Array.isArray(row.sources) ? row.sources : [],
      confidence: typeof row.confidence === 'number' ? row.confidence : null,
    }
  })().catch((error) => {
    if (isMissingAnswerCacheInfraError(error)) {
      answerCacheAvailable = false
      return null
    }

    logError('answer_cache_lookup_failed', error, { query_hash: queryHash.slice(0, 12) })
    return null
  })

  return Promise.race([lookupPromise, sleep(ANSWER_CACHE_READ_TIMEOUT_MS)])
}

export async function setCached(
  queryHash: string,
  queryText: string,
  response: string,
  sources: unknown[],
  confidence: number | null,
  intent: CacheIntent,
  ctx: SessionContext
) {
  if (!hasSupabaseAdminConfig() || answerCacheAvailable === false) {
    return
  }

  const ttlDays = CACHE_TTL_DAYS[intent] ?? 7
  if (ttlDays <= 0) {
    return
  }

  try {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + ttlDays)

    await getSupabaseAdmin()
      .from('answer_cache')
      .upsert(
        {
          query_hash: queryHash,
          query_text: queryText.slice(0, 500),
          intent,
          board: ctx.board,
          subject: ctx.subject,
          response,
          sources: Array.isArray(sources) ? sources : [],
          confidence,
          last_hit_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
        },
        { onConflict: 'query_hash' }
      )

    answerCacheAvailable = true
  } catch (error) {
    if (isMissingAnswerCacheInfraError(error)) {
      answerCacheAvailable = false
      return
    }

    logError('answer_cache_store_failed', error, { query_hash: queryHash.slice(0, 12), intent })
  }
}

export async function getAnswerCacheStats(): Promise<AnswerCacheStats> {
  const emptyStats: AnswerCacheStats = {
    totalEntries: 0,
    totalHits: 0,
    avgHitsPerEntry: 0,
    hotEntries: 0,
    hitsToday: 0,
    hitRate: 0,
  }

  if (!hasSupabaseAdminConfig() || answerCacheAvailable === false) {
    return emptyStats
  }

  try {
    const { data, error } = await getSupabaseAdmin().rpc('get_answer_cache_stats')
    if (error) {
      throw error
    }

    answerCacheAvailable = true
    const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null
    if (!row) {
      return emptyStats
    }

    const totalEntries = Math.max(0, Math.round(normalizeNumber(row.total_entries)))
    const totalHits = Math.max(0, Math.round(normalizeNumber(row.total_hits)))
    const cacheHits = Math.max(0, totalHits - totalEntries)
    const hitRate = totalEntries + cacheHits > 0 ? Math.round((cacheHits / (totalEntries + cacheHits)) * 100) : 0

    return {
      totalEntries,
      totalHits,
      avgHitsPerEntry: Number(normalizeNumber(row.avg_hits_per_entry).toFixed(2)),
      hotEntries: Math.max(0, Math.round(normalizeNumber(row.hot_entries))),
      hitsToday: Math.max(0, Math.round(normalizeNumber(row.hits_today))),
      hitRate,
    }
  } catch (error) {
    if (isMissingAnswerCacheInfraError(error)) {
      answerCacheAvailable = false
      return emptyStats
    }

    logError('answer_cache_stats_failed', error)
    return emptyStats
  }
}
