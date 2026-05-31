import { getSupabaseAdmin } from './supabase-admin.ts'
import { logError, logEvent } from './logger.ts'

export type ManagedLlmProvider = 'gemini' | 'openai' | 'groq' | 'openai_compatible'

export type LlmUsageRow = {
  provider: string
  model: string
  call_count: number | null
  estimated_cost_usd: number | null
}

type LlmUsageLogArgs = {
  provider: ManagedLlmProvider
  model: string
  inputTokens: number
  outputTokens: number
}

const DEFAULT_MODEL_COST_PER_1M = { input: 0.1, output: 0.3 }
const GEMINI_DAILY_CALL_LIMIT = 1400
const GEMINI_DAILY_COST_LIMIT_USD = 5

const MODEL_COST_PER_1M: Record<string, { input: number; output: number }> = {
  'gemini-flash-lite-latest': { input: 0.075, output: 0.3 },
  'gemini-flash-latest': { input: 0.075, output: 0.3 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'groq-llama3': { input: 0.05, output: 0.08 },
  'llama-3.1-8b-instant': { input: 0.05, output: 0.08 },
}

let llmUsageInfraAvailable: boolean | null = null

function hasSupabaseAdminConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
}

function getTodayDateString() {
  return new Date().toISOString().split('T')[0]
}

function isMissingLlmUsageInfraError(error: unknown) {
  const code = (error as { code?: string })?.code
  const message = String((error as { message?: string })?.message ?? '')
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    code === '42883' ||
    /llm_usage|increment_llm_usage/i.test(message)
  )
}

function normalizeTokenCount(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    return 0
  }

  return Math.max(0, Math.round(value))
}

function resolveModelCost(model: string) {
  const normalized = model.trim().toLowerCase()
  return MODEL_COST_PER_1M[normalized] ?? DEFAULT_MODEL_COST_PER_1M
}

export function estimateTokenCount(text: string) {
  const normalized = text.trim()
  if (!normalized) {
    return 0
  }

  return Math.max(1, Math.ceil(normalized.length / 4))
}

export function calculateEstimatedCostUsd(model: string, inputTokens: number, outputTokens: number) {
  const cost = resolveModelCost(model)
  return (inputTokens / 1_000_000) * cost.input + (outputTokens / 1_000_000) * cost.output
}

async function logLLMUsage(args: LlmUsageLogArgs) {
  if (!hasSupabaseAdminConfig() || llmUsageInfraAvailable === false) {
    return
  }

  try {
    const inputTokens = normalizeTokenCount(args.inputTokens)
    const outputTokens = normalizeTokenCount(args.outputTokens)
    const estimatedCost = calculateEstimatedCostUsd(args.model, inputTokens, outputTokens)

    await getSupabaseAdmin().rpc('increment_llm_usage', {
      p_date: getTodayDateString(),
      p_provider: args.provider,
      p_model: args.model,
      p_input_tokens: inputTokens,
      p_output_tokens: outputTokens,
      p_cost: estimatedCost,
    })

    llmUsageInfraAvailable = true
  } catch (error) {
    if (isMissingLlmUsageInfraError(error)) {
      llmUsageInfraAvailable = false
      return
    }

    logError('llm_usage_log_failed', error, {
      provider: args.provider,
      model: args.model,
    })
  }
}

export function scheduleLLMUsageLog(args: LlmUsageLogArgs) {
  queueMicrotask(() => {
    void logLLMUsage(args)
  })
}

export async function checkGeminiQuota() {
  if (!hasSupabaseAdminConfig() || llmUsageInfraAvailable === false) {
    return true
  }

  try {
    const { data, error } = await getSupabaseAdmin()
      .from('llm_usage')
      .select('call_count, estimated_cost_usd')
      .eq('date', getTodayDateString())
      .eq('provider', 'gemini')

    if (error) {
      throw error
    }

    llmUsageInfraAvailable = true

    const totals = ((data as Array<{ call_count?: number | null; estimated_cost_usd?: number | null }> | null) ?? []).reduce(
      (acc, row) => {
        acc.callCount += normalizeTokenCount(Number(row.call_count ?? 0))
        acc.estimatedCostUsd += Number.isFinite(Number(row.estimated_cost_usd ?? 0))
          ? Number(row.estimated_cost_usd ?? 0)
          : 0
        return acc
      },
      { callCount: 0, estimatedCostUsd: 0 }
    )

    if (totals.callCount >= GEMINI_DAILY_CALL_LIMIT) {
      logEvent('warn', 'gemini_quota_guard_triggered', {
        provider: 'gemini',
        reason: 'daily_call_limit',
        call_count: totals.callCount,
        limit: GEMINI_DAILY_CALL_LIMIT,
      })
      return false
    }

    if (totals.estimatedCostUsd >= GEMINI_DAILY_COST_LIMIT_USD) {
      logEvent('warn', 'gemini_quota_guard_triggered', {
        provider: 'gemini',
        reason: 'daily_cost_limit',
        estimated_cost_usd: Number(totals.estimatedCostUsd.toFixed(6)),
        limit_usd: GEMINI_DAILY_COST_LIMIT_USD,
      })
      return false
    }

    return true
  } catch (error) {
    if (isMissingLlmUsageInfraError(error)) {
      llmUsageInfraAvailable = false
      return true
    }

    logError('gemini_quota_check_failed', error, { provider: 'gemini' })
    return true
  }
}

export async function getTodayLlmUsage(): Promise<LlmUsageRow[]> {
  if (!hasSupabaseAdminConfig() || llmUsageInfraAvailable === false) {
    return []
  }

  try {
    const { data, error } = await getSupabaseAdmin()
      .from('llm_usage')
      .select('provider, model, call_count, estimated_cost_usd')
      .eq('date', getTodayDateString())
      .order('provider', { ascending: true })
      .order('model', { ascending: true })

    if (error) {
      throw error
    }

    llmUsageInfraAvailable = true
    return (data as LlmUsageRow[] | null) ?? []
  } catch (error) {
    if (isMissingLlmUsageInfraError(error)) {
      llmUsageInfraAvailable = false
      return []
    }

    logError('llm_usage_fetch_failed', error, { route: 'admin_stats' })
    return []
  }
}
