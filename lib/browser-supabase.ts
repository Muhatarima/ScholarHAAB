import { createClient } from '@/lib/supabase/client'

export function getBrowserSupabase() {
  return createClient()
}
