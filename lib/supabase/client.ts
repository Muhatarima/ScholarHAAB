import { createBrowserClient } from '@supabase/ssr'

let browserClient: ReturnType<typeof createBrowserClient> | null = null

function getSupabasePublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error('Missing Supabase public environment variables')
  }

  return { anonKey, url }
}

export function createClient() {
  if (browserClient) {
    return browserClient
  }

  const { anonKey, url } = getSupabasePublicEnv()
  browserClient = createBrowserClient(url, anonKey)
  return browserClient
}
