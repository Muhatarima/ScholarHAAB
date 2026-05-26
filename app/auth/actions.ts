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

function getAuthOrigin() {
  const configuredOrigin = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_BASE_URL
  )?.replace(/\/$/, '')
  const productionOrigin = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : null
  const vercelOrigin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null

  return configuredOrigin || productionOrigin || vercelOrigin || 'http://localhost:3000'
}

function validateEmail(email: string) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
  const typoDomains = new Set([
    'gamil.com',
    'gmial.com',
    'gmai.com',
    'gmail.con',
    'gmail.co',
    'gnail.com',
    'hotmial.com',
    'outlok.com',
    'yaho.com',
    'yahoo.con',
  ])
  const domain = email.split('@')[1]?.toLowerCase()

  if (!emailPattern.test(email) || !domain || typoDomains.has(domain)) {
    return 'Use a real email address, like name@gmail.com.'
  }

  return null
}

function validateName(name: string) {
  if (name.trim().length < 2) {
    return 'Name must be at least 2 characters.'
  }

  if (!/^[\p{L}\p{M}\s.'-]+$/u.test(name)) {
    return 'Name can only contain letters, spaces, dots, apostrophes, and hyphens.'
  }

  return null
}

function validatePassword(password: string) {
  if (password.length < 8) {
    return 'Password must be at least 8 characters long.'
  }

  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'Password must include at least one letter and one number.'
  }

  return null
}

export async function signUp(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const supabase = await createClient()
  const email = normalizeEmail(formData.get('email'))
  const password = normalizePassword(formData.get('password'))
  const name = typeof formData.get('name') === 'string' ? String(formData.get('name')).trim() : ''
  const nextPath = normalizeNextPath(formData.get('next'))
  const emailError = validateEmail(email)
  const nameError = validateName(name)
  const passwordError = validatePassword(password)

  if (emailError) {
    return { error: emailError, message: null }
  }

  if (nameError) {
    return { error: nameError, message: null }
  }

  if (passwordError) {
    return { error: passwordError, message: null }
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${getAuthOrigin()}/auth/callback?next=${encodeURIComponent(nextPath)}`,
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
  const emailError = validateEmail(email)

  if (emailError) {
    return { error: emailError, message: null }
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
  const origin = getAuthOrigin()

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
