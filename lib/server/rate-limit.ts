import { getSupabaseAdmin } from './supabase-admin.ts'
import { logError, logEvent } from './logger.ts'

type RateBucket = {
  count: number
  resetAt: number
}

type RateLimitResult = {
  allowed: boolean
  limit: number
  remaining: number
  retryAfterSeconds: number
}

type RateLimitParams = {
  key: string
  tier: string
  userId?: string | null
  requestId?: string
}

const WINDOW_MS = 60_000
const LOG_RETENTION_MS = 24 * 60 * 60 * 1000
const LOCAL_FALLBACK_BUCKETS = new Map<string, RateBucket>()
const warnedFallbackReasons = new Set<string>()
let lastCleanupAt = 0

function readPositiveIntEnv(name: string, fallback: number) {
  const parsed = Number(process.env[name])
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

export function getRequestLimitForTier(tier: string) {
  if (tier === 'premium') {
    return readPositiveIntEnv('PREMIUM_REQUESTS_PER_MINUTE', 40)
  }

  if (tier === 'pro') {
    return readPositiveIntEnv('PRO_REQUESTS_PER_MINUTE', 24)
  }

  return readPositiveIntEnv('DEFAULT_REQUESTS_PER_MINUTE', 12)
}

function consumeLocalBucket(key: string, tier: string): RateLimitResult {
  const now = Date.now()
  const limit = getRequestLimitForTier(tier)
  const bucket = LOCAL_FALLBACK_BUCKETS.get(key)

  if (!bucket || bucket.resetAt <= now) {
    LOCAL_FALLBACK_BUCKETS.set(key, {
      count: 1,
      resetAt: now + WINDOW_MS,
    })
    return {
      allowed: true,
      limit,
      remaining: Math.max(0, limit - 1),
      retryAfterSeconds: 0,
    }
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    }
  }

  bucket.count += 1
  LOCAL_FALLBACK_BUCKETS.set(key, bucket)

  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - bucket.count),
    retryAfterSeconds: 0,
  }
}

function isRateLimitTableError(error: unknown) {
  const code = (error as { code?: string })?.code
  const message = String((error as { message?: string })?.message ?? '')
  return code === '42P01' || code === 'PGRST205' || /rate_limit_log/i.test(message)
}

function logFallbackOnce(reason: string, error: unknown, context: Record<string, unknown>) {
  if (warnedFallbackReasons.has(reason)) {
    return
  }

  warnedFallbackReasons.add(reason)
  if (isRateLimitTableError(error)) {
    logEvent('warn', 'distributed_rate_limit_fallback', {
      ...context,
      reason,
      fallback: 'local_in_memory_bucket',
    })
    return
  }

  logError('distributed_rate_limit_unavailable', error, {
    ...context,
    fallback: 'local_in_memory_bucket',
  })
}

async function maybeCleanupRateLimitLog(requestId?: string) {
  const now = Date.now()
  if (now - lastCleanupAt < 15 * 60 * 1000) {
    return
  }

  lastCleanupAt = now
  const cutoff = new Date(now - LOG_RETENTION_MS).toISOString()

  try {
    const supabaseAdmin = getSupabaseAdmin()
    await supabaseAdmin.from('rate_limit_log').delete().lt('created_at', cutoff)
  } catch (error) {
    if (isRateLimitTableError(error)) {
      logFallbackOnce('missing_rate_limit_table_cleanup', error, {
        request_id: requestId ?? null,
        route: 'rate_limit_cleanup',
      })
      return
    }

    logError('rate_limit_cleanup_failed', error, {
      request_id: requestId ?? null,
      route: 'rate_limit_cleanup',
    })
  }
}

async function consumeSharedRateLimit({
  key,
  tier,
  userId,
  requestId,
}: RateLimitParams): Promise<RateLimitResult> {
  const limit = getRequestLimitForTier(tier)
  const now = new Date()
  const supabaseAdmin = getSupabaseAdmin()
  const createdAt = now.toISOString()
  const windowStart = new Date(now.getTime() - WINDOW_MS).toISOString()

  const insertPayload: {
    endpoint: string
    created_at: string
    user_id?: string
  } = {
    endpoint: key,
    created_at: createdAt,
  }

  if (userId) {
    insertPayload.user_id = userId
  }

  const { error: insertError } = await supabaseAdmin.from('rate_limit_log').insert(insertPayload)
  if (insertError) {
    throw insertError
  }

  let query = supabaseAdmin
    .from('rate_limit_log')
    .select('*', { count: 'exact', head: true })
    .eq('endpoint', key)
    .gt('created_at', windowStart)

  if (userId) {
    query = query.eq('user_id', userId)
  } else {
    query = query.is('user_id', null)
  }

  const { count, error: countError } = await query
  if (countError) {
    throw countError
  }

  void maybeCleanupRateLimitLog(requestId)

  const requestCount = count ?? 0
  const allowed = requestCount <= limit

  if (!allowed) {
    logEvent('warn', 'request_rate_limited', {
      request_id: requestId ?? null,
      rate_limit_key: key,
      user_id: userId ?? null,
      tier,
      limit,
      observed_count: requestCount,
    })
  }

  return {
    allowed,
    limit,
    remaining: Math.max(0, limit - requestCount),
    retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil(WINDOW_MS / 1000)),
  }
}

export async function assertRequestRateLimit(params: RateLimitParams): Promise<RateLimitResult> {
  try {
    return await consumeSharedRateLimit(params)
  } catch (error) {
    const reason = isRateLimitTableError(error) ? 'missing_rate_limit_table' : 'shared_rate_limit_failed'
    logFallbackOnce(reason, error, {
      request_id: params.requestId ?? null,
      rate_limit_key: params.key,
      user_id: params.userId ?? null,
      tier: params.tier,
    })
    return consumeLocalBucket(params.key, params.tier)
  }
}
