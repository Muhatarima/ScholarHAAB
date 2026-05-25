'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type AuthActionState = {
  error: string | null
  message: string | null
}

function normalizeNextPath(value: FormDataEntryValue | null, fallback = '/dashboard') {
  if (typeof value !== 'string') {
    return fallback
  }

  const trimmed = value.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return fallback
  }

  return trimmed
}

function normalizeEmail(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function normalizePassword(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value : ''
}

function normalizeName(value: FormDataEntryValue | null, email?: string) {
  const name = typeof value === 'string' ? value.trim() : ''
  return name || email?.split('@')[0] || 'Student'
}

export async function signUp(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const supabase = await createClient()
  const email = normalizeEmail(formData.get('email'))
  const password = normalizePassword(formData.get('password'))
  const name = normalizeName(formData.get('name'), email)
  const nextPath = normalizeNextPath(formData.get('next'))

  if (!email) {
    return { error: 'Email is required.', message: null }
  }

  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters long.', message: null }
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
      },
    },
  })

  if (error) {
    return { error: error.message, message: null }
  }

  if (data.session) {
    redirect(nextPath)
  }

  return {
    error: null,
    message: 'Account created. If email confirmation is enabled in Supabase, confirm your email first, then sign in.',
  }
}

export async function signIn(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const supabase = await createClient()
  const email = normalizeEmail(formData.get('email'))
  const password = normalizePassword(formData.get('password'))
  const nextPath = normalizeNextPath(formData.get('next'))

  if (!email) {
    return { error: 'Email is required.', message: null }
  }

  if (!password) {
    return { error: 'Password is required.', message: null }
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message, message: null }
  }

  redirect(nextPath)
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function signInWithGoogle(formData: FormData) {
  const supabase = await createClient()
  const nextPath = normalizeNextPath(formData.get('next'))
  const configuredOrigin = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_URL || process.env.NEXT_PUBLIC_BASE_URL)?.replace(/\/$/, '')
  const vercelOrigin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null
  const origin = configuredOrigin || vercelOrigin || 'https://scholarhaaab.com'

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
    },
  })

  if (error || !data.url) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`)
  }

  redirect(data.url)
}
