import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function normalizeNextPath(value: string | null, fallback = '/dashboard') {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return fallback
  }
  return value
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const next = normalizeNextPath(url.searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(new URL(next, req.url))
}
