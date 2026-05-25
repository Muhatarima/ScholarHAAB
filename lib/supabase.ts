import { createClient } from '@/lib/supabase/client'

export function getPublicSupabase() {
  return createClient()
}

export const supabase = getPublicSupabase()
