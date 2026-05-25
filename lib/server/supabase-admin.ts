import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { fetchWithTimeout } from './http-client.ts'

const SUPABASE_TIMEOUT_MS = Number(process.env.SUPABASE_TIMEOUT_MS || process.env.EXTERNAL_CALL_TIMEOUT_MS || 15000)

let supabaseAdmin: SupabaseClient | null = null

export function getSupabaseAdmin() {
  if (supabaseAdmin) {
    return supabaseAdmin
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase admin environment variables')
  }

  supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      fetch: (input, init) =>
        fetchWithTimeout(input, init, {
          operation: 'supabase_admin_request',
          service: 'supabase',
          timeoutMs: SUPABASE_TIMEOUT_MS,
        }),
    },
  })

  return supabaseAdmin
}
