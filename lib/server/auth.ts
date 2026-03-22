import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies'
import { randomUUID } from 'node:crypto'
import { ACCESS_TOKEN_COOKIE_NAME } from '@/lib/auth-constants'
import type { Tier } from '@/lib/usage'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'
import { TIER_COOKIE_NAME, VIEWER_COOKIE_NAME } from '@/lib/server/usage'

type Identity = {
  viewerKey: string
  tier: Tier
  isAuthenticated: boolean
  authUserId: string | null
  shouldSetViewerCookie: boolean
}

type SubscriptionRow = {
  tier: Tier
  status: string
}

function resolveTierFromCookie(rawTier: string | undefined): Tier {
  if (rawTier === 'pro' || rawTier === 'premium') {
    return rawTier
  }

  return 'trial'
}

function isMissingSubscriptionTableError(error: unknown): boolean {
  const code = (error as { code?: string })?.code
  const message = String((error as { message?: string })?.message ?? '')
  return code === '42P01' || code === 'PGRST205' || /subscriptions/i.test(message)
}

async function resolveDbTier(userId: string): Promise<Tier | null> {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .select('tier, status')
      .eq('user_id', userId)
      .in('status', ['active', 'trialing'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      throw error
    }

    const row = data as SubscriptionRow | null
    if (!row) {
      return null
    }

    return row.tier
  } catch (error) {
    if (isMissingSubscriptionTableError(error)) {
      return null
    }

    throw error
  }
}

async function resolveAuthUserId(cookieStore: ReadonlyRequestCookies) {
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE_NAME)?.value
  if (!accessToken) {
    return null
  }

  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { data, error } = await supabaseAdmin.auth.getUser(accessToken)
    if (error || !data.user) {
      return null
    }

    return data.user.id
  } catch {
    return null
  }
}

export async function resolveRequestIdentity(cookieStore: ReadonlyRequestCookies): Promise<Identity> {
  const authUserId = await resolveAuthUserId(cookieStore)
  const tierCookie = cookieStore.get(TIER_COOKIE_NAME)?.value
  const viewerCookie = cookieStore.get(VIEWER_COOKIE_NAME)?.value

  if (authUserId) {
    const dbTier = await resolveDbTier(authUserId)
    return {
      viewerKey: authUserId,
      tier: dbTier ?? resolveTierFromCookie(tierCookie),
      isAuthenticated: true,
      authUserId,
      shouldSetViewerCookie: !viewerCookie || viewerCookie !== authUserId,
    }
  }

  return {
    viewerKey: viewerCookie?.trim() || randomUUID(),
    tier: resolveTierFromCookie(tierCookie),
    isAuthenticated: false,
    authUserId: null,
    shouldSetViewerCookie: !viewerCookie,
  }
}
