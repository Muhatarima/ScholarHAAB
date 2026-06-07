import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSetupCompleted } from '@/lib/auth/setup-status'

const PROTECTED_PREFIXES = [
  '/admin',
  '/adaptive-mode',
  '/chat',
  '/dashboard',
  '/exam-mode',
  '/exam-prep',
  '/mock',
  '/progress',
  '/qbank',
  '/settings',
  '/setup',
  '/solver',
]
const AUTH_PAGES = ['/auth', '/login', '/register', '/signup']

type PendingCookie = {
  name: string
  options?: CookieOptions
  value: string
}

function matchesPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

function safeNextPath(value: string | null, fallback: string) {
  return value?.startsWith('/') && !value.startsWith('//') ? value : fallback
}

function getSupabasePublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error('Missing Supabase public environment variables')
  }

  return { anonKey, url }
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })
  let pendingCookies: PendingCookie[] = []
  const { anonKey, url } = getSupabasePublicEnv()

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        pendingCookies = cookiesToSet
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value)
        })

        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  function redirect(path: string) {
    const redirectResponse = NextResponse.redirect(new URL(path, request.url))
    pendingCookies.forEach(({ name, value, options }) => {
      redirectResponse.cookies.set(name, value, options)
    })
    return redirectResponse
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname, searchParams } = request.nextUrl
  const isProtected = matchesPrefix(pathname, PROTECTED_PREFIXES)
  const isAuthPage = matchesPrefix(pathname, AUTH_PAGES)
  const isSetupPage = pathname === '/setup' || pathname.startsWith('/setup/')

  if (!user) {
    if (!isProtected) {
      return response
    }

    const next = `${pathname}${request.nextUrl.search}`
    return redirect(`/login?next=${encodeURIComponent(next)}`)
  }

  let setupCompleted: boolean
  try {
    setupCompleted = await getSetupCompleted(supabase, user.id)
  } catch (error) {
    // A transient profile read must not create an infinite redirect loop.
    console.error('Could not read setup status in middleware', error)
    return response
  }

  if (!setupCompleted) {
    if (isSetupPage) {
      return response
    }
    if (isProtected || isAuthPage) {
      return redirect('/setup')
    }
    return response
  }

  if (isSetupPage) {
    return redirect('/solver')
  }

  if (isAuthPage) {
    return redirect(safeNextPath(searchParams.get('next'), '/solver'))
  }

  return response
}

export const config = {
  matcher: [
    '/auth',
    '/login',
    '/register',
    '/signup',
    '/admin/:path*',
    '/adaptive-mode/:path*',
    '/chat/:path*',
    '/dashboard/:path*',
    '/exam-mode/:path*',
    '/exam-prep/:path*',
    '/mock/:path*',
    '/progress/:path*',
    '/qbank/:path*',
    '/settings/:path*',
    '/setup/:path*',
    '/solver/:path*',
  ],
}
