import { randomUUID } from 'node:crypto'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'
import {
  getActionCreditCost,
  getUsageSummary,
  getDailyCreditLimit,
  resolveUsageAction,
  type Tier,
} from '@/lib/usage'
import type { Product, PromptMode } from '@/lib/products'

export const VIEWER_COOKIE_NAME = 'scholarhaab_viewer'
export const TIER_COOKIE_NAME = 'scholarhaab_tier'
export const APP_TIMEZONE = process.env.APP_TIMEZONE ?? 'Asia/Dhaka'

type PreviewParams = {
  viewerKey: string
  tier: Tier
  product: Product
  mode: PromptMode
  message: string
}

type CommitParams = PreviewParams & {
  usageDate: string
}

type DailyUsageRow = {
  viewer_key: string
  usage_date: string
  tier: Tier
  credits_used: number
  actions_count: number
}

export type UsagePreview =
  | {
      enabled: true
      allowed: boolean
      usageDate: string
      tier: Tier
      dailyLimitCredits: number
      usedCredits: number
      remainingCredits: number
      remainingAfterAction: number
      action: ReturnType<typeof resolveUsageAction>
      actionCost: number
      nextResetAt: string
      nextResetLabel: string
      nextResetIn: string
      message?: string
    }
  | {
      enabled: false
      allowed: true
      tier: Tier
      dailyLimitCredits: number
      usedCredits: number
      remainingCredits: number
      remainingAfterAction: number
      action: ReturnType<typeof resolveUsageAction>
      actionCost: number
      nextResetAt: string
      nextResetLabel: string
      nextResetIn: string
      message?: string
    }

function getZonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(date)
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]))

  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
    hour: Number(lookup.hour),
    minute: Number(lookup.minute),
    second: Number(lookup.second),
  }
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = getZonedParts(date, timeZone)
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return asUtc - date.getTime()
}

function getUsageDateString(date: Date, timeZone: string) {
  const parts = getZonedParts(date, timeZone)
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

function getNextResetDate(date: Date, timeZone: string) {
  const parts = getZonedParts(date, timeZone)
  const nextMidnightGuess = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1, 0, 0, 0))
  const offsetMs = getTimeZoneOffsetMs(nextMidnightGuess, timeZone)
  return new Date(nextMidnightGuess.getTime() - offsetMs)
}

function formatResetLabel(date: Date, timeZone: string) {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)

  return `${formatted} (${timeZone})`
}

function formatResetIn(date: Date, now: Date) {
  const diffMs = Math.max(0, date.getTime() - now.getTime())
  const totalMinutes = Math.ceil(diffMs / (1000 * 60))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours > 0 && minutes > 0) {
    return `in ${hours}h ${minutes}m`
  }

  if (hours > 0) {
    return `in ${hours}h`
  }

  return `in ${minutes}m`
}

function getResetInfo(now: Date) {
  const nextReset = getNextResetDate(now, APP_TIMEZONE)
  return {
    nextResetAt: nextReset.toISOString(),
    nextResetLabel: formatResetLabel(nextReset, APP_TIMEZONE),
    nextResetIn: formatResetIn(nextReset, now),
  }
}

function buildLimitMessage(dailyLimitCredits: number, resetInfo: ReturnType<typeof getResetInfo>) {
  return `Today's ${dailyLimitCredits} credits are finished. Your credits reset at ${resetInfo.nextResetLabel} ${resetInfo.nextResetIn}.`
}

function isMissingUsageTableError(error: unknown): boolean {
  const code = (error as { code?: string })?.code
  const message = String((error as { message?: string })?.message ?? '')
  return code === '42P01' || code === 'PGRST205' || /daily_usage/i.test(message)
}

function resolveTierFromCookie(rawTier: string | undefined): Tier {
  if (rawTier === 'pro' || rawTier === 'premium') {
    return rawTier
  }

  return 'expired'
}

function isDemoMode() {
  return (
    process.env.NODE_ENV !== 'production' ||
    process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ||
    process.env.DEMO_MODE === 'true'
  )
}

function applyDemoTier(tier: Tier): Tier {
  return isDemoMode() ? 'premium' : tier
}

async function readDailyUsage(viewerKey: string, usageDate: string): Promise<DailyUsageRow | null> {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('daily_usage')
    .select('viewer_key, usage_date, tier, credits_used, actions_count')
    .eq('viewer_key', viewerKey)
    .eq('usage_date', usageDate)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data as DailyUsageRow | null
}

export function getViewerSession(input: { viewerCookie?: string; tierCookie?: string }) {
  const viewerKey = input.viewerCookie?.trim() || randomUUID()

  return {
    viewerKey,
    tier: resolveTierFromCookie(input.tierCookie),
    shouldSetViewerCookie: !input.viewerCookie,
  }
}

export function createBypassedUsagePreview({
  tier,
  product,
  mode,
  message,
  reason = 'Usage limits bypassed for explicit eval mode.',
}: {
  tier: Tier
  product: Product
  mode: PromptMode
  message: string
  reason?: string
}): UsagePreview {
  const action = resolveUsageAction(product, mode, message)
  const effectiveTier = applyDemoTier(tier)
  const summary = getUsageSummary(effectiveTier, 0, action)

  return {
    enabled: false,
    allowed: true,
    ...summary,
    ...getResetInfo(new Date()),
    message: reason,
  }
}

export async function previewUsage({
  viewerKey,
  tier,
  product,
  mode,
  message,
}: PreviewParams): Promise<UsagePreview> {
  const effectiveTier = applyDemoTier(tier)
  const action = resolveUsageAction(product, mode, message)
  const now = new Date()
  const usageDate = getUsageDateString(now, APP_TIMEZONE)
  const dailyLimitCredits = getDailyCreditLimit(effectiveTier)
  const resetInfo = getResetInfo(now)

  try {
    const row = await readDailyUsage(viewerKey, usageDate)
    const usedCredits = row?.credits_used ?? 0
    const summary = getUsageSummary(effectiveTier, usedCredits, action)

    if (usedCredits + getActionCreditCost(action) > dailyLimitCredits) {
      return {
        enabled: true,
        allowed: false,
        usageDate,
        ...summary,
        ...resetInfo,
        message: buildLimitMessage(dailyLimitCredits, resetInfo),
      }
    }

    return {
      enabled: true,
      allowed: true,
      usageDate,
      ...summary,
      ...resetInfo,
    }
  } catch (error) {
    if (isMissingUsageTableError(error)) {
      const summary = getUsageSummary(effectiveTier, 0, action)
      return {
        enabled: false,
        allowed: true,
        ...summary,
        ...resetInfo,
        message: 'Usage tracking table is not ready yet. Run the SQL setup to enable credit limits.',
      }
    }

    throw error
  }
}

export async function commitUsage({
  viewerKey,
  tier,
  product,
  mode,
  message,
  usageDate,
}: CommitParams): Promise<UsagePreview> {
  const effectiveTier = applyDemoTier(tier)
  const action = resolveUsageAction(product, mode, message)
  const actionCost = getActionCreditCost(action)
  const dailyLimitCredits = getDailyCreditLimit(effectiveTier)
  const resetInfo = getResetInfo(new Date())

  try {
    const existing = await readDailyUsage(viewerKey, usageDate)
    const usedCredits = existing?.credits_used ?? 0

    if (usedCredits + actionCost > dailyLimitCredits) {
      const summary = getUsageSummary(effectiveTier, usedCredits, action)
      return {
        enabled: true,
        allowed: false,
        usageDate,
        ...summary,
        ...resetInfo,
        message: buildLimitMessage(dailyLimitCredits, resetInfo),
      }
    }

    const supabaseAdmin = getSupabaseAdmin()
    
    // Leverage the atomic SQL RPC to completely prevent concurrency cheating
    const { data: finalUsedCredits, error } = await supabaseAdmin.rpc('commit_usage_atomic', {
      p_viewer_key: viewerKey,
      p_usage_date: usageDate,
      p_tier: effectiveTier,
      p_cost: actionCost,
      p_daily_limit: dailyLimitCredits
    })

    if (error) {
      if (error.message?.includes('Daily limit reached')) {
        const summary = getUsageSummary(effectiveTier, dailyLimitCredits, action)
        return {
          enabled: true,
          allowed: false,
          usageDate,
          ...summary,
          ...resetInfo,
          message: buildLimitMessage(dailyLimitCredits, resetInfo),
        }
      }
      throw error
    }

    const summary = getUsageSummary(effectiveTier, finalUsedCredits as number, action)
    return {
      enabled: true,
      allowed: true,
      usageDate,
      ...summary,
      ...resetInfo,
    }
  } catch (error) {
    if (isMissingUsageTableError(error)) {
      const summary = getUsageSummary(effectiveTier, 0, action)
      return {
        enabled: false,
        allowed: true,
        ...summary,
        ...resetInfo,
        message: 'Usage tracking table is not ready yet. Run the SQL setup to enable credit limits.',
      }
    }

    throw error
  }
}
