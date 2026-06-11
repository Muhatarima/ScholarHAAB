'use client'

import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import Logo from '@/components/Logo'
import { PRODUCT_NAV_ITEMS } from '@/components/ProductNav'
import { createSupabaseClient } from '@/lib/supabase/clientClient'

const PUBLIC_PATHS = ['/', '/login', '/register', '/signup', '/auth']

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [authed, setAuthed] = useState(false)
  const [ready, setReady] = useState(false)

  const isPublic = useMemo(
    () => PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`)),
    [pathname]
  )
  const homeHref = '/'
  const showAppLinks = authed && !isPublic

  useEffect(() => {
    let active = true
    const supabase = createSupabaseClient()

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setAuthed(Boolean(data.session?.user))
      setReady(true)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      setAuthed(Boolean(session?.user))
      setReady(true)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  async function logout() {
    await createSupabaseClient().auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  const links = showAppLinks ? PRODUCT_NAV_ITEMS : []

  return (
    <header style={styles.header}>
      <style>{`
        @media (max-width: 920px) {
          .scholarhaab-desktop-nav { display: none !important; }
          .scholarhaab-menu-button { display: inline-flex !important; }
          .scholarhaab-mobile-nav { display: grid !important; }
        }
      `}</style>
      <div style={styles.inner}>
        <Logo compact href={homeHref} />

        {showAppLinks ? (
          <>
            <nav className="scholarhaab-desktop-nav" style={styles.desktopNav} aria-label="Primary navigation">
              {links.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    style={{ ...styles.link, ...(active ? styles.activeLink : null) }}
                  >
                    {item.label}
                  </Link>
                )
              })}
              <button type="button" onClick={() => void logout()} style={styles.logout}>
                Logout
              </button>
            </nav>

            <button
              className="scholarhaab-menu-button"
              type="button"
              aria-label="Toggle navigation"
              aria-expanded={open}
              onClick={() => setOpen((value) => !value)}
              style={styles.menuButton}
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </>
        ) : ready && !authed ? (
          <nav style={styles.publicNav} aria-label="Account navigation">
            <Link href="/login" style={styles.link}>Login</Link>
            <Link href="/register" style={{ ...styles.link, ...styles.activeLink }}>Register</Link>
          </nav>
        ) : null}
      </div>

      {showAppLinks && open ? (
        <nav className="scholarhaab-mobile-nav" style={styles.mobileNav} aria-label="Mobile navigation">
          {links.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                onClick={() => setOpen(false)}
                style={{ ...styles.mobileLink, ...(active ? styles.activeLink : null) }}
              >
                {item.label}
              </Link>
            )
          })}
          <button type="button" onClick={() => void logout()} style={{ ...styles.mobileLink, ...styles.logoutMobile }}>
            Logout
          </button>
        </nav>
      ) : null}
    </header>
  )
}

const styles = {
  activeLink: {
    background: 'rgba(155,77,255,.2)',
    borderColor: 'rgba(192,108,255,.55)',
    color: '#fff',
  } satisfies CSSProperties,
  desktopNav: {
    alignItems: 'center',
    display: 'flex',
    gap: 8,
  } satisfies CSSProperties,
  header: {
    background: 'rgba(2,2,12,.82)',
    backdropFilter: 'blur(16px)',
    borderBottom: '1px solid rgba(176,128,255,.12)',
    left: 0,
    position: 'fixed',
    right: 0,
    top: 0,
    zIndex: 50,
  } satisfies CSSProperties,
  inner: {
    alignItems: 'center',
    display: 'flex',
    gap: 16,
    justifyContent: 'space-between',
    margin: '0 auto',
    minHeight: 74,
    padding: '0 clamp(14px,4vw,42px)',
    width: 'min(1440px, 100%)',
  } satisfies CSSProperties,
  link: {
    border: '1px solid rgba(190,132,255,.18)',
    borderRadius: 999,
    color: '#c7bce8',
    fontSize: 13,
    fontWeight: 750,
    lineHeight: 1,
    padding: '10px 12px',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  } satisfies CSSProperties,
  logout: {
    background: 'transparent',
    border: '1px solid rgba(248,113,113,.3)',
    borderRadius: 999,
    color: '#fecaca',
    cursor: 'pointer',
    font: 'inherit',
    fontSize: 13,
    fontWeight: 750,
    lineHeight: 1,
    padding: '10px 12px',
  } satisfies CSSProperties,
  logoutMobile: {
    color: '#fecaca',
    textAlign: 'left',
  } satisfies CSSProperties,
  menuButton: {
    alignItems: 'center',
    background: 'rgba(255,255,255,.04)',
    border: '1px solid rgba(190,132,255,.24)',
    borderRadius: 8,
    color: '#f4edff',
    cursor: 'pointer',
    display: 'none',
    height: 42,
    justifyContent: 'center',
    width: 44,
  } satisfies CSSProperties,
  mobileLink: {
    background: 'transparent',
    border: '1px solid rgba(190,132,255,.14)',
    borderRadius: 8,
    color: '#d8ccf2',
    font: 'inherit',
    fontSize: 14,
    fontWeight: 750,
    padding: '13px 14px',
    textDecoration: 'none',
  } satisfies CSSProperties,
  mobileNav: {
    borderTop: '1px solid rgba(176,128,255,.1)',
    display: 'none',
    gap: 8,
    padding: '10px 14px 16px',
  } satisfies CSSProperties,
  publicNav: {
    alignItems: 'center',
    display: 'flex',
    gap: 8,
  } satisfies CSSProperties,
} as const
