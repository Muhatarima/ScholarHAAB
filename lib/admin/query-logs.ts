import { estimateTokenCount } from '@/lib/server/llm-usage'
import { createRequestId, logError } from '@/lib/server/logger'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'

export const QUERY_COST_PER_TOKEN_USD = 0.00000015

type QueryLogInsertArgs = {
  userId?: string | null
  userEmail?: string | null
  message: string
  queryType: string
  subject?: string | null
  tokensUsed?: number | null
  fromCache?: boolean | null
  responseMs?: number | null
}

function hasSupabaseAdminConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
}

function isMissingQueryLogsInfraError(error: unknown) {
  const code = (error as { code?: string })?.code
  const message = String((error as { message?: string })?.message ?? '')

  return code === '42P01' || code === 'PGRST205' || /query_logs/i.test(message)
}

function normalizeTokensUsed(value: number | null | undefined) {
  if (!Number.isFinite(Number(value)) || Number(value) < 0) {
    return 0
  }

  return Math.max(0, Math.round(Number(value)))
}

export function estimateLoggedTokens(answer: string, explicitTokens?: number | null) {
  const normalizedExplicit = normalizeTokensUsed(explicitTokens)
  if (normalizedExplicit > 0) {
    return normalizedExplicit
  }

  return estimateTokenCount(answer)
}

export async function insertQueryLog(args: QueryLogInsertArgs) {
  if (!hasSupabaseAdminConfig()) {
    return false
  }

  const tokensUsed = normalizeTokensUsed(args.tokensUsed)
  const requestId = createRequestId()

  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { error } = await supabaseAdmin.from('query_logs').insert({
      user_id: args.userId ?? null,
      user_email: args.userEmail ?? null,
      message: args.message.trim().slice(0, 500),
      query_type: args.queryType.trim().slice(0, 80),
      subject: args.subject?.trim() ? args.subject.trim().slice(0, 120) : null,
      tokens_used: tokensUsed,
      from_cache: Boolean(args.fromCache),
      cost_usd: Number((tokensUsed * QUERY_COST_PER_TOKEN_USD).toFixed(8)),
      response_ms: Number.isFinite(Number(args.responseMs)) ? Math.max(0, Math.round(Number(args.responseMs))) : null,
    })

    if (error) {
      throw error
    }

    return true
  } catch (error) {
    if (isMissingQueryLogsInfraError(error)) {
      return false
    }

    logError('query_log_insert_failed', error, {
      request_id: requestId,
      query_type: args.queryType,
      subject: args.subject ?? null,
    })
    return false
  }
}
