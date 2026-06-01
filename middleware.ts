import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED_PREFIXES = ['/admin', '/chat', '/dashboard', '/exam-mode', '/exam-prep', '/mock', '/progress', '/qbank', '/settings', '/setup', '/solver']
const AUTH_PAGES = ['/auth', '/login', '/register', '/signup']

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

function isAuthPage(pathname: string) {
  return AUTH_PAGES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

function buildNextPath(request: NextRequest) {
  return `${request.nextUrl.pathname}${request.nextUrl.search}`
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
  const { anonKey, url } = getSupabasePublicEnv()

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (request.nextUrl.pathname === '/auth') {
    const url = request.nextUrl.clone()
    url.pathname = user ? '/dashboard' : '/login'
    url.search = user ? '' : request.nextUrl.search
    return NextResponse.redirect(url)
  }

  if (isProtectedPath(request.nextUrl.pathname) && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', buildNextPath(request))
    return NextResponse.redirect(url)
  }

  if (isAuthPage(request.nextUrl.pathname) && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    '/auth',
    '/login',
    '/signup',
    '/admin/:path*',
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
