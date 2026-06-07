'use client'

import { createSupabaseClient } from '@/lib/supabase/clientClient'

export async function buildSupabaseAuthHeaders(
  headers: Record<string, string> = {}
) {
  const nextHeaders = { ...headers }

  try {
    const {
      data: { session },
    } = await createSupabaseClient().auth.getSession()

    if (session?.access_token) {
      nextHeaders.Authorization = `Bearer ${session.access_token}`
    }
  } catch {
    // The API will return 401 when no valid browser session exists.
  }

  return nextHeaders
}
