'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getBrowserSupabase } from '@/lib/browser-supabase'

type SessionState = {
  authenticated: boolean
  userId: string | null
  viewerKey: string
  tier: string
}

type SessionBadgeProps = {
  compact?: boolean
}

export default function SessionBadge({ compact = false }: SessionBadgeProps) {
  const [session, setSession] = useState<SessionState | null>(null)
  const [loading, setLoading] = useState(true)
  const [signingOut, setSigningOut] = useState(false)
  const router = useRouter()

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/me', { cache: 'no-store' })
        const data = await res.json()
        setSession(data)
      } catch {
        setSession(null)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const handleSignOut = async () => {
    if (signingOut) {
      return
    }

    setSigningOut(true)
    try {
      const supabase = getBrowserSupabase()
      await supabase.auth.signOut()
      router.refresh()
      window.location.href = '/'
    } finally {
      setSigningOut(false)
    }
  }

  if (loading) {
    return (
      <div
        style={{
          fontSize: '11px',
          color: '#8C8CB2',
          border: '1px solid rgba(170,85,255,0.15)',
          padding: compact ? '6px 10px' : '8px 12px',
          borderRadius: '999px',
          background: 'rgba(255,255,255,0.03)',
        }}
      >
        Loading...
      </div>
    )
  }

  if (!session?.authenticated) {
    return (
      <Link
        href="/auth"
        style={{
          fontSize: compact ? '11px' : '12px',
          padding: compact ? '6px 12px' : '8px 14px',
          borderRadius: '20px',
          border: '1px solid rgba(170,85,255,0.22)',
          background: 'transparent',
          color: '#aa66ff',
          cursor: 'pointer',
          letterSpacing: '0.5px',
          textDecoration: 'none',
        }}
      >
        Sign in
      </Link>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
      }}
    >
      <div
        style={{
          fontSize: compact ? '11px' : '12px',
          color: '#E6D8FF',
          border: '1px solid rgba(170,85,255,0.16)',
          padding: compact ? '6px 10px' : '8px 12px',
          borderRadius: '999px',
          background: 'rgba(255,255,255,0.03)',
        }}
      >
        {session.tier} plan
      </div>
      <button
        onClick={() => void handleSignOut()}
        style={{
          fontSize: compact ? '11px' : '12px',
          padding: compact ? '6px 12px' : '8px 14px',
          borderRadius: '20px',
          border: '1px solid rgba(170,85,255,0.22)',
          background: 'transparent',
          color: '#aa66ff',
          cursor: signingOut ? 'default' : 'pointer',
          letterSpacing: '0.5px',
        }}
      >
        {signingOut ? 'Signing out...' : 'Sign out'}
      </button>
    </div>
  )
}
