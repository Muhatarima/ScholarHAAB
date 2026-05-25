import { getSupabaseAdmin } from '@/lib/server/supabase-admin'

function parseCsv(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function hasSupabaseAdminConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
}

function isMissingAdminColumn(error: unknown) {
  const code = (error as { code?: string })?.code
  const message = String((error as { message?: string })?.message ?? '')
  return code === '42703' || code === 'PGRST204' || /is_admin|profiles/i.test(message)
}

export async function isAdminUser(userId: string | null) {
  if (!userId) {
    return false
  }

  const allowedIds = new Set(parseCsv(process.env.ADMIN_USER_IDS))
  if (allowedIds.has(userId)) {
    return true
  }

  const allowedEmails = new Set(parseCsv(process.env.ADMIN_EMAILS).map((entry) => entry.toLowerCase()))

  if (!hasSupabaseAdminConfig()) {
    return false
  }

  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('email, is_admin')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      throw error
    }

    const profile = data as { email?: string | null; is_admin?: boolean | null } | null
    if (profile?.is_admin) {
      return true
    }

    const email = String(profile?.email ?? '').toLowerCase()
    return email ? allowedEmails.has(email) : false
  } catch (error) {
    if (isMissingAdminColumn(error) && allowedEmails.size > 0) {
      try {
        const supabaseAdmin = getSupabaseAdmin()
        const { data } = await supabaseAdmin.from('profiles').select('email').eq('id', userId).maybeSingle()
        const email = String((data as { email?: string | null } | null)?.email ?? '').toLowerCase()
        return email ? allowedEmails.has(email) : false
      } catch {
        return false
      }
    }

    return false
  }
}
