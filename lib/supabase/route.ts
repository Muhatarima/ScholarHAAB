import { cookies } from 'next/headers'
import { createClientFromCookieStore } from '@/lib/supabase/server'

export async function createRouteHandlerClient() {
  const cookieStore = await cookies()
  return createClientFromCookieStore(cookieStore)
}
