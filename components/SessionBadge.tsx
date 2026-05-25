'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getBrowserSupabase } from '@/lib/browser-supabase'
import { getTierLabel } from '@/lib/usage'
import {
  STUDY_PROGRESS_UPDATED_EVENT,
  createEmptyStudyProgress,
  type StudyProgressSnapshot,
} from '@/lib/study-progress'

type SessionState = {
  authenticated: boolean
  userId: string | null
  viewerKey: string
  tier: string
  studyProgress: StudyProgressSnapshot
}

type SessionBadgeProps = {
  compact?: boolean
}

export default function SessionBadge({ compact = false }: SessionBadgeProps) {
  const [session, setSession] = useState<SessionState | null>(null)
  const [loading, setLoading] = useState(true)
  const [signingOut, setSigningOut] = useState(false)
  const router = useRouter()
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

  const refreshSession = async () => {
    try {
      const res = await fetch('/api/me', { cache: 'no-store' })
      const data = await res.json()
      setSession({
        authenticated: Boolean(data.authenticated),
        userId: typeof data.userId === 'string' ? data.userId : null,
        viewerKey: typeof data.viewerKey === 'string' ? data.viewerKey : '',
        tier: typeof data.tier === 'string' ? data.tier : 'expired',
        studyProgress: data.studyProgress ?? createEmptyStudyProgress(),
      })
    } catch {
      setSession(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refreshSession()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handleProgressUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<StudyProgressSnapshot | undefined>
      if (!customEvent.detail) {
        void refreshSession()
        return
      }

      setSession((current) =>
        current
          ? {
              ...current,
              studyProgress: customEvent.detail ?? current.studyProgress,
            }
          : current
      )
    }

    window.addEventListener(STUDY_PROGRESS_UPDATED_EVENT, handleProgressUpdate as EventListener)
    return () => {
      window.removeEventListener(STUDY_PROGRESS_UPDATED_EVENT, handleProgressUpdate as EventListener)
    }
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
      window.location.href = '/login'
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
        href="/login"
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
          border: '1px solid rgba(170,85,255,0.12)',
          padding: compact ? '5px 9px' : '7px 11px',
          borderRadius: '999px',
          background: 'rgba(255,255,255,0.02)',
        }}
      >
        {demoMode ? 'Demo Mode — Unlimited' : `Credits: ${getTierLabel(session.tier)}`}
      </div>
      <details
        style={{
          position: 'relative',
        }}
      >
        <summary
          aria-label="Account menu"
          style={{
            width: compact ? '30px' : '34px',
            height: compact ? '30px' : '34px',
            borderRadius: '999px',
            border: '1px solid rgba(170,85,255,0.22)',
            background: 'rgba(255,255,255,0.03)',
            color: '#aa66ff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            listStyle: 'none',
            fontSize: compact ? '11px' : '12px',
            fontWeight: 700,
          }}
        >
          {session.viewerKey?.[0]?.toUpperCase() || 'S'}
        </summary>
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            width: '150px',
            borderRadius: '14px',
            border: '1px solid rgba(170,85,255,0.14)',
            background: 'rgba(10,10,28,0.96)',
            boxShadow: '0 18px 45px rgba(0,0,0,0.32)',
            padding: '8px',
            display: 'grid',
            gap: '4px',
            zIndex: 50,
          }}
        >
          <Link
            href="/dashboard"
            style={{
              color: '#E8E8FF',
              textDecoration: 'none',
              fontSize: '12px',
              padding: '8px 10px',
              borderRadius: '10px',
            }}
          >
            Dashboard
          </Link>
          <button
            onClick={() => void handleSignOut()}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#aa66ff',
              textAlign: 'left',
              fontSize: '12px',
              padding: '8px 10px',
              borderRadius: '10px',
              cursor: signingOut ? 'default' : 'pointer',
            }}
          >
            {signingOut ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      </details>
    </div>
  )
}
