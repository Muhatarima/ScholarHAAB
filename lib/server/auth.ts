import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies'
import { randomUUID } from 'node:crypto'
import { ACCESS_TOKEN_COOKIE_NAME, VIEWER_KEY_HEADER_NAME } from '@/lib/auth-constants'
import { createClientFromCookieStore } from '@/lib/supabase/server'
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

function isDemoMode() {
  return (
    process.env.NODE_ENV !== 'production' ||
    process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ||
    process.env.DEMO_MODE === 'true'
  )
}

function shouldAllowAnonymousProductTests() {
  return process.env.ALLOW_ANONYMOUS_PRODUCT_TESTS === 'true' || isDemoMode()
}

function applyDemoTier(tier: Tier): Tier {
  return isDemoMode() ? 'premium' : tier
}

function resolveTierFromCookie(rawTier: string | undefined): Tier {
  if (rawTier === 'pro' || rawTier === 'premium') {
    return rawTier
  }

  return 'expired'
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
      .in('status', ['active', 'past_due'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      throw error
    }

    const row = data as SubscriptionRow | null
    if (row && row.tier) {
      return row.tier
    }
    return 'expired'
  } catch (error) {
    if (isMissingSubscriptionTableError(error)) {
      return 'expired'
    }

    throw error
  }
}

function getBearerAccessToken(requestHeaders?: Headers) {
  const authorization = requestHeaders?.get('authorization')?.trim()
  if (!authorization) {
    return null
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorization)
  return match?.[1]?.trim() || null
}

async function resolveAuthUserId(
  cookieStore: ReadonlyRequestCookies,
  requestHeaders?: Headers
) {
  const accessToken = getBearerAccessToken(requestHeaders) ?? cookieStore.get(ACCESS_TOKEN_COOKIE_NAME)?.value
  if (accessToken) {
    try {
      const supabaseAdmin = getSupabaseAdmin()
      const { data, error } = await supabaseAdmin.auth.getUser(accessToken)
      if (!error && data.user) {
        return data.user.id
      }
    } catch {
      return null
    }
  }

  try {
    const supabase = createClientFromCookieStore(cookieStore)
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return null
    }

    return user.id
  } catch {
    return null
  }
}

export async function resolveRequestIdentity(
  cookieStore: ReadonlyRequestCookies,
  requestHeaders?: Headers
): Promise<Identity> {
  const authUserId = await resolveAuthUserId(cookieStore, requestHeaders)
  const tierCookie = cookieStore.get(TIER_COOKIE_NAME)?.value
  const viewerCookie = cookieStore.get(VIEWER_COOKIE_NAME)?.value
  const viewerHeader = requestHeaders?.get(VIEWER_KEY_HEADER_NAME)?.trim() || null
  const deviceViewerKey = viewerHeader || viewerCookie?.trim() || randomUUID()

  if (authUserId) {
    if (isDemoMode()) {
      return {
        viewerKey: deviceViewerKey,
        tier: 'premium',
        isAuthenticated: true,
        authUserId,
        shouldSetViewerCookie: !viewerCookie || viewerCookie !== deviceViewerKey,
      }
    }

    const supabaseAdmin = getSupabaseAdmin()
    
    // Check 3-device limit securely using the DB RPC
    const { data: deviceAllowed, error: deviceError } = await supabaseAdmin.rpc('register_user_device', {
      p_user_id: authUserId,
      p_viewer_key: deviceViewerKey
    })

    if (deviceError || deviceAllowed === false) {
      // Limit exceeded or database error, safely drop authentication privileges
      return {
        viewerKey: randomUUID(), // Issuing a throwaway viewer key to prevent DB poisoning
        tier: resolveTierFromCookie(tierCookie),
        isAuthenticated: false,
        authUserId: null,
        shouldSetViewerCookie: true,
      }
    }

    const dbTier = await resolveDbTier(authUserId)
      return {
        viewerKey: deviceViewerKey,
        tier: applyDemoTier(dbTier ?? resolveTierFromCookie(tierCookie)),
        isAuthenticated: true,
        authUserId,
        shouldSetViewerCookie: !viewerCookie || viewerCookie !== deviceViewerKey,
      }
  }

  if (shouldAllowAnonymousProductTests()) {
    return {
      viewerKey: deviceViewerKey,
      tier: 'premium',
      isAuthenticated: true,
      authUserId: 'test-anonymous-user',
      shouldSetViewerCookie: !viewerCookie || viewerCookie !== deviceViewerKey,
    }
  }

  return {
    viewerKey: deviceViewerKey,
    tier: applyDemoTier(resolveTierFromCookie(tierCookie)),
    isAuthenticated: false,
    authUserId: null,
    shouldSetViewerCookie: !viewerCookie,
  }
}
