'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AuthGuard from '@/components/auth/AuthGuard'
import Blackhole from '@/components/Blackhole'
import Stars from '@/components/Stars'
import type { StudentProfile } from '@/lib/user-profile'

function formatDayLabel(dateString: string) {
  const date = new Date(`${dateString}T00:00:00Z`)
  return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date)
}

export default function QbankProgressPage() {
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
  const maxMessages = Math.max(1, ...(progress?.recentActivity.map((entry) => entry.messages) ?? [1]))

  return (
    <AuthGuard>
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
      <div style={{ position: 'relative', zIndex: 10, maxWidth: '1080px', margin: '0 auto', display: 'grid', gap: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <p style={{ fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase', color: '#9A6CFF' }}>
              ScholarHAAB progress
            </p>
            <h1 style={{ fontSize: 'clamp(32px, 5vw, 54px)', margin: '10px 0 12px' }}>See your momentum, not just your messages</h1>
            <p style={{ margin: 0, color: '#9a9abe', lineHeight: 1.7, maxWidth: '760px' }}>
              Your streak, XP, and weekly activity update after each successful answer so you can tell whether you are actually building consistency.
            </p>
          </div>
          <Link href="/qbank" style={{ textDecoration: 'none', color: '#d8b4fe', fontSize: '13px' }}>
            Back to QBank
          </Link>
        </div>

        <div style={{ display: 'grid', gap: '18px', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {[
            ['Current streak', `${progress?.streakDays ?? 0} days`, 'Daily consistency is what keeps recall sharp.'],
            ['Total XP', `${progress?.totalXp ?? 0}`, 'A running score for real study activity, not vanity clicks.'],
            ['This week', `${progress?.weekMessages ?? 0} questions`, 'Every successful QBank session moves this forward.'],
            ['Active days', `${progress?.weekActiveDays ?? 0} / 7`, 'How many different days you showed up this week.'],
          ].map(([label, value, hint]) => (
            <article key={label} style={{ borderRadius: '22px', border: '1px solid rgba(170,85,255,0.16)', background: 'rgba(255,255,255,0.04)', padding: '22px' }}>
              <div style={{ color: '#9A6CFF', fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase' }}>{label}</div>
              <h2 style={{ fontSize: '30px', margin: '10px 0 8px' }}>{value}</h2>
              <p style={{ color: '#9a9abe', lineHeight: 1.7, margin: 0 }}>{hint}</p>
            </article>
          ))}
        </div>

        <div style={{ display: 'grid', gap: '18px', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(280px, 1fr)' }}>
          <section style={{ borderRadius: '24px', border: '1px solid rgba(170,85,255,0.16)', background: 'rgba(255,255,255,0.04)', padding: '22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '18px' }}>
              <div>
                <div style={{ color: '#9A6CFF', fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase' }}>Last 7 days</div>
                <h2 style={{ fontSize: '26px', margin: '10px 0 0' }}>Study rhythm</h2>
              </div>
              <div style={{ color: '#9a9abe', fontSize: '13px' }}>
                {progress?.todayMessages ?? 0} messages today | {progress?.todayXp ?? 0} XP today
              </div>
            </div>

            <div style={{ display: 'grid', gap: '14px', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', alignItems: 'end', minHeight: '220px' }}>
              {(progress?.recentActivity ?? []).map((entry) => (
                <div key={entry.date} style={{ display: 'grid', gap: '10px', justifyItems: 'center' }}>
                  <div style={{ width: '100%', maxWidth: '72px', height: `${Math.max(24, (entry.messages / maxMessages) * 160)}px`, borderRadius: '18px 18px 8px 8px', background: 'linear-gradient(180deg, rgba(107,228,255,0.9), rgba(170,85,255,0.9))', boxShadow: '0 16px 32px rgba(119,51,204,0.18)' }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#EDE6FF' }}>{entry.messages} msg</div>
                    <div style={{ fontSize: '11px', color: '#8F8FB5' }}>{formatDayLabel(entry.date)}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section style={{ borderRadius: '24px', border: '1px solid rgba(170,85,255,0.16)', background: 'rgba(255,255,255,0.04)', padding: '22px', display: 'grid', gap: '18px' }}>
            <div>
              <div style={{ color: '#9A6CFF', fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase' }}>Focus</div>
              <h2 style={{ fontSize: '26px', margin: '10px 0 0' }}>QBank study load</h2>
            </div>

            <div style={{ display: 'grid', gap: '12px' }}>
              {[
                ['QBank', progress?.qbankMessages ?? 0, '#6be4ff'],
              ].map(([label, value, color]) => (
                <div key={label as string} style={{ display: 'grid', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#d7d2f1' }}>
                    <span>{label} sessions</span>
                    <span>{value}</span>
                  </div>
                  <div style={{ height: '10px', borderRadius: '999px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${Math.min(100, ((value as number) / Math.max(1, (progress?.weekMessages ?? 0))) * 100)}%`,
                        height: '100%',
                        borderRadius: '999px',
                        background: color as string,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gap: '10px' }}>
              <div style={{ color: '#9A6CFF', fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase' }}>Badges</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {(progress?.badges ?? []).length > 0 ? (
                  progress?.badges.map((badge) => (
                    <div key={badge} style={{ padding: '10px 12px', borderRadius: '999px', border: '1px solid rgba(170,85,255,0.18)', background: 'rgba(255,255,255,0.03)', color: '#F1E8FF', fontSize: '12px' }}>
                      {badge}
                    </div>
                  ))
                ) : (
                  <div style={{ color: '#9a9abe', fontSize: '13px', lineHeight: 1.7 }}>
                    Your first badge appears as soon as you put one real study session on the board.
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
    </AuthGuard>
  )
}
