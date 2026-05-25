import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

type CookieStoreLike = {
  getAll: () => Array<{ name: string; value: string }>
  set?: (name: string, value: string, options?: CookieOptions) => void
}

function getSupabasePublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error('Missing Supabase public environment variables')
  }

  return { anonKey, url }
}

export function createClientFromCookieStore(cookieStore: CookieStoreLike) {
  const { anonKey, url } = getSupabasePublicEnv()

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          if (typeof cookieStore.set !== 'function') {
            return
          }

          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set?.(name, value, options)
          })
        } catch {
          // Server Components may expose a read-only cookie store.
        }
      },
    },
  })
}

export async function createClient() {
  const cookieStore = await cookies()
  return createClientFromCookieStore(cookieStore)
}
