'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Blackhole from '@/components/Blackhole'
import Stars from '@/components/Stars'
import { signOut } from '@/app/auth/actions'
import type { StudentProfile } from '@/lib/user-profile'

function formatLastActive(dateString: string | null | undefined) {
  if (!dateString) {
    return 'No activity yet'
  }

  const date = new Date(`${dateString}T00:00:00Z`)
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
}

export default function DashboardOverview({
  userName,
}: {
  userName: string
}) {
  const [profile, setProfile] = useState<StudentProfile | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/profile', { cache: 'no-store' })
        const data = await res.json()
        setProfile(data.profile ?? null)
      } catch {
        setProfile(null)
      }
    })()
  }, [])

  const progress = profile?.studyProgress

  return (
    <main
      style={{
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
        background: '#00000d',
        color: '#E8E8FF',
        padding: '120px 24px 48px',
      }}
    >
      <Stars />
      <Blackhole />
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          maxWidth: '1080px',
          margin: '0 auto',
          display: 'grid',
          gap: '18px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <p
              style={{
                fontSize: '12px',
                letterSpacing: '3px',
                textTransform: 'uppercase',
                color: '#9A6CFF',
              }}
            >
              ScholarHAAB account
            </p>
            <h1 style={{ fontSize: 'clamp(32px, 5vw, 54px)', margin: '10px 0 12px' }}>
              Welcome, {profile?.fullName || userName}
            </h1>
            <p style={{ color: '#9a9abe', lineHeight: 1.7, maxWidth: '760px', margin: 0 }}>
              This is where your study setup meets your real exam rhythm, so you can see account setup, progress, and learning momentum in one place.
            </p>
          </div>

          <form action={signOut}>
            <button
              type="submit"
              style={{
                border: '1px solid rgba(170,85,255,0.22)',
                background: 'transparent',
                color: '#C084FC',
                borderRadius: '999px',
                padding: '10px 16px',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              Log out
            </button>
          </form>
        </div>

        <div
          style={{
            display: 'grid',
            gap: '18px',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          }}
        >
          {[
            ['Current streak', `${progress?.streakDays ?? 0} days`, `Longest: ${progress?.longestStreak ?? 0} days`],
            ['Total XP', `${progress?.totalXp ?? 0}`, `${progress?.weekXp ?? 0} XP earned this week`],
            ['Weekly activity', `${progress?.weekMessages ?? 0} messages`, `${progress?.weekActiveDays ?? 0} active days this week`],
            ['Last active', formatLastActive(progress?.lastActiveDate), `${progress?.todayMessages ?? 0} messages today`],
          ].map(([label, value, hint]) => (
            <article key={label} style={{ borderRadius: '22px', border: '1px solid rgba(107,228,255,0.14)', background: 'rgba(255,255,255,0.04)', padding: '22px' }}>
              <div style={{ color: '#74dfff', fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase' }}>{label}</div>
              <h2 style={{ fontSize: '28px', margin: '10px 0 8px' }}>{value}</h2>
              <p style={{ color: '#9a9abe', lineHeight: 1.7, margin: 0 }}>{hint}</p>
            </article>
          ))}
        </div>

        <div
          style={{
            display: 'grid',
            gap: '18px',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          }}
        >
          <Link href="/onboarding" style={{ textDecoration: 'none', color: 'inherit' }}>
            <article style={{ borderRadius: '22px', border: '1px solid rgba(170,85,255,0.16)', background: 'rgba(255,255,255,0.04)', padding: '22px' }}>
              <div style={{ color: '#9A6CFF', fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase' }}>Profile setup</div>
              <h2 style={{ fontSize: '24px', margin: '10px 0' }}>{profile?.onboardingCompleted ? 'Setup complete' : 'Finish onboarding'}</h2>
              <p style={{ color: '#9a9abe', lineHeight: 1.7, margin: 0 }}>Board, level, subjects, and language defaults live here.</p>
            </article>
          </Link>

          <Link href="/qbank/progress" style={{ textDecoration: 'none', color: 'inherit' }}>
            <article style={{ borderRadius: '22px', border: '1px solid rgba(107,228,255,0.16)', background: 'rgba(255,255,255,0.04)', padding: '22px' }}>
              <div style={{ color: '#74dfff', fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase' }}>Progress analytics</div>
              <h2 style={{ fontSize: '24px', margin: '10px 0' }}>Open learning dashboard</h2>
              <p style={{ color: '#9a9abe', lineHeight: 1.7, margin: 0 }}>See your streak, XP, weekly rhythm, and study consistency in one focused view.</p>
            </article>
          </Link>

          <Link href="/qbank" style={{ textDecoration: 'none', color: 'inherit' }}>
            <article style={{ borderRadius: '22px', border: '1px solid rgba(170,85,255,0.16)', background: 'rgba(255,255,255,0.04)', padding: '22px' }}>
              <div style={{ color: '#9A6CFF', fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase' }}>Resume study</div>
              <h2 style={{ fontSize: '24px', margin: '10px 0' }}>Open QBank</h2>
              <p style={{ color: '#9a9abe', lineHeight: 1.7, margin: 0 }}>Jump back into past-paper solving and tutor mode.</p>
            </article>
          </Link>
        </div>

        <section style={{ borderRadius: '22px', border: '1px solid rgba(170,85,255,0.16)', background: 'rgba(255,255,255,0.04)', padding: '22px' }}>
          <div style={{ color: '#9A6CFF', fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase' }}>Badges</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '14px' }}>
            {(progress?.badges ?? []).length > 0 ? (
              progress?.badges.map((badge) => (
                <div key={badge} style={{ padding: '10px 12px', borderRadius: '999px', border: '1px solid rgba(170,85,255,0.18)', background: 'rgba(255,255,255,0.03)', color: '#F1E8FF', fontSize: '12px' }}>
                  {badge}
                </div>
              ))
            ) : (
              <p style={{ color: '#9a9abe', margin: 0, lineHeight: 1.7 }}>
                Your first badge appears once you complete a real study session. Keep showing up and the streak system will do the rest.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
