'use client'

import { useEffect } from 'react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { ACCESS_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_NAME } from '@/lib/auth-constants'
import { getBrowserSupabase } from '@/lib/browser-supabase'

function setCookie(name: string, value: string, maxAgeSeconds: number) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; samesite=lax`
}

function clearCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0; samesite=lax`
}

function syncSessionCookies(accessToken?: string | null, refreshToken?: string | null) {
  if (accessToken) {
    setCookie(ACCESS_TOKEN_COOKIE_NAME, accessToken, 60 * 60 * 24 * 7)
  } else {
    clearCookie(ACCESS_TOKEN_COOKIE_NAME)
  }

  if (refreshToken) {
    setCookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, 60 * 60 * 24 * 30)
  } else {
    clearCookie(REFRESH_TOKEN_COOKIE_NAME)
  }
}

export default function AuthSessionSync() {
  useEffect(() => {
    const supabase = getBrowserSupabase()

    void supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      syncSessionCookies(data.session?.access_token, data.session?.refresh_token)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      syncSessionCookies(session?.access_token, session?.refresh_token)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return null
}
