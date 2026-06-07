'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import AuthGuard from '@/components/auth/AuthGuard'
import Logo from '@/components/Logo'
import RichMessageContent from '@/components/RichMessageContent'
import StarBackground from '@/components/StarBackground'
import { buildSupabaseAuthHeaders } from '@/lib/supabase/auth-headers'

type DashboardPayload = {
  dashboard?: {
    board?: string
    overallAccuracy?: number
    questionsToday?: number
    studyStreak?: number
    subjects?: string[]
    todaysPlan?: string[]
    totalQuestionsAttempted?: number
    weakPoints?: Array<{
      accuracy?: number
      subject?: string
      timesStruggled?: number
      topic?: string
      weakScore?: number
    }>
  }
  profile?: {
    board?: string | null
    level?: string | null
    setupCompleted?: boolean
    subjects?: string[]
  }
  ragRecommendations?: Array<{
    concept?: string
    explanation?: string
    practicePrompt?: string
    reason?: string
    sources?: Array<{ id: string; title: string; board: string | null; year: string | number | null }>
    subject?: string
    topic?: string
  }>
  skippedChapters?: Array<{
    currentTopic?: string | null
    detectionCount?: number
    subject?: string
    topic?: string
  }>
  topicProgress?: Array<{
    accuracy?: number
    attempted_count?: number
    correct_count?: number
    subject?: string | null
    topic?: string | null
    wrong_count?: number
  }>
}

function DashboardInner() {
  const [data, setData] = useState<DashboardPayload | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    void (async () => {
      setLoading(true)
      setError('')
      try {
        const response = await fetch('/api/dashboard', {
          cache: 'no-store',
          headers: await buildSupabaseAuthHeaders({ 'Content-Type': 'application/json' }),
        })
        const payload = (await response.json()) as DashboardPayload & { error?: string }
        if (!response.ok) throw new Error(payload.error || 'Dashboard failed to load.')
        if (active) setData(payload)
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : 'Dashboard failed to load.')
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [])

  const dashboard = data?.dashboard
  const profile = data?.profile
  const weakPoints = dashboard?.weakPoints ?? []
  const skipped = data?.skippedChapters ?? []
  const progress = data?.topicProgress ?? []
  const recommendations = data?.ragRecommendations ?? []
  const subjects = useMemo(
    () => profile?.subjects?.length ? profile.subjects : dashboard?.subjects ?? [],
    [dashboard?.subjects, profile?.subjects]
  )

  return (
    <main style={styles.page}>
      <StarBackground variant="chat" />
      <style>{`
        @media (max-width: 760px) {
          .dashboard-grid { grid-template-columns: 1fr !important; }
          .dashboard-nav-links { gap: 10px !important; }
        }
      `}</style>
      <nav style={styles.nav}>
        <Logo compact />
        <div className="dashboard-nav-links" style={styles.links}>
          <Link href="/solver" style={styles.link}>Solver</Link>
          <Link href="/exam-mode" style={styles.link}>Exam Mode</Link>
          <Link href="/adaptive-mode" style={styles.link}>Adaptive</Link>
        </div>
      </nav>

      <section style={styles.wrap}>
        <header style={styles.header}>
          <div>
            <p style={styles.eyebrow}>Dashboard</p>
            <h1 style={styles.title}>Study cockpit</h1>
            <p style={styles.subtitle}>
              {profile?.level ?? 'Level not set'} · {profile?.board ?? dashboard?.board ?? 'Board not set'}
            </p>
          </div>
          <Link href="/settings/profile" style={styles.primaryAction}>Edit profile</Link>
        </header>

        {error ? <p style={styles.error}>{error}</p> : null}
        {loading ? <div style={styles.empty}>Loading dashboard...</div> : null}

        {!loading && data ? (
          <>
            <section className="dashboard-grid" style={styles.metricGrid}>
              <article style={styles.panel}>
                <span style={styles.label}>Setup</span>
                <strong style={styles.metric}>{profile?.setupCompleted ? 'Complete' : 'Not complete'}</strong>
                <p style={styles.muted}>{subjects.length ? subjects.join(', ') : 'Subjects not set yet'}</p>
              </article>
              <article style={styles.panel}>
                <span style={styles.label}>Questions</span>
                <strong style={styles.metric}>{dashboard?.totalQuestionsAttempted ?? 0}</strong>
                <p style={styles.muted}>{dashboard?.questionsToday ?? 0} done today</p>
              </article>
              <article style={styles.panel}>
                <span style={styles.label}>Accuracy</span>
                <strong style={styles.metric}>{dashboard?.overallAccuracy ?? 0}%</strong>
                <p style={styles.muted}>{dashboard?.studyStreak ?? 0} day streak</p>
              </article>
            </section>

            <section className="dashboard-grid" style={styles.twoCol}>
              <article style={styles.panel}>
                <h2 style={styles.sectionTitle}>Weak topics</h2>
                <div style={styles.list}>
                  {weakPoints.slice(0, 6).map((point) => (
                    <div key={`${point.subject}-${point.topic}`} style={styles.row}>
                      <strong>{point.topic ?? 'General'}</strong>
                      <span>{point.subject ?? 'General'} · {point.accuracy ?? 0}%</span>
                    </div>
                  ))}
                  {!weakPoints.length ? <p style={styles.muted}>No weak topic data yet.</p> : null}
                </div>
              </article>

              <article style={styles.panel}>
                <h2 style={styles.sectionTitle}>Skipped or difficult chapters</h2>
                <div style={styles.list}>
                  {skipped.slice(0, 6).map((gap) => (
                    <div key={`${gap.subject}-${gap.topic}`} style={styles.row}>
                      <strong>{gap.topic}</strong>
                      <span>{gap.subject} · {gap.detectionCount ?? 1} signal(s)</span>
                    </div>
                  ))}
                  {!skipped.length ? <p style={styles.muted}>Nothing marked difficult yet.</p> : null}
                </div>
              </article>
            </section>

            <section style={styles.panel}>
              <h2 style={styles.sectionTitle}>RAG alternative explanation path</h2>
              <p style={styles.muted}>
                Built from your indexed documents. It re-explains difficult concepts using a different source style.
              </p>
              <div style={styles.recommendations}>
                {recommendations.map((item, index) => (
                  <article key={`${item.topic}-${index}`} style={styles.recommendation}>
                    <span style={styles.badge}>{item.reason?.replaceAll('_', ' ') ?? 'recommendation'}</span>
                    <h3>{item.concept || item.topic}</h3>
                    <RichMessageContent content={item.explanation || ''} />
                    {item.practicePrompt ? <p style={styles.practice}>{item.practicePrompt}</p> : null}
                    <small style={styles.muted}>
                      {(item.sources ?? []).slice(0, 2).map((source) => source.title).join(' · ')}
                    </small>
                  </article>
                ))}
                {!recommendations.length ? (
                  <p style={styles.muted}>Ask or attempt more questions to generate RAG recommendations.</p>
                ) : null}
              </div>
            </section>

            <section style={styles.panel}>
              <h2 style={styles.sectionTitle}>Performance by topic</h2>
              <div style={styles.progressList}>
                {progress.slice(0, 10).map((row) => (
                  <div key={`${row.subject}-${row.topic}`} style={styles.progressRow}>
                    <span>{row.subject ?? 'General'} · {row.topic ?? 'General'}</span>
                    <div style={styles.barTrack}>
                      <span style={{ ...styles.barFill, width: `${Math.max(4, Math.min(100, Number(row.accuracy ?? 0)))}%` }} />
                    </div>
                    <strong>{Math.round(Number(row.accuracy ?? 0))}%</strong>
                  </div>
                ))}
                {!progress.length ? <p style={styles.muted}>No topic attempts recorded yet.</p> : null}
              </div>
            </section>
          </>
        ) : null}
      </section>
    </main>
  )
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardInner />
    </AuthGuard>
  )
}

const styles = {
  badge: { color: '#facc15', fontSize: 11, fontWeight: 800, textTransform: 'uppercase' } satisfies CSSProperties,
  barFill: { background: 'linear-gradient(90deg,#7c3aed,#c084fc)', borderRadius: 999, display: 'block', height: '100%' } satisfies CSSProperties,
  barTrack: { background: 'rgba(255,255,255,.08)', borderRadius: 999, height: 8, overflow: 'hidden' } satisfies CSSProperties,
  empty: { color: '#aaa7c8', display: 'grid', minHeight: 180, placeItems: 'center' } satisfies CSSProperties,
  error: { color: '#fbbf24' } satisfies CSSProperties,
  eyebrow: { color: '#b983ff', fontSize: 12, fontWeight: 800, margin: 0, textTransform: 'uppercase' } satisfies CSSProperties,
  header: { alignItems: 'end', display: 'flex', flexWrap: 'wrap', gap: 20, justifyContent: 'space-between' } satisfies CSSProperties,
  label: { color: '#b9a7e8', fontSize: 13, fontWeight: 700 } satisfies CSSProperties,
  link: { color: '#c9c5e8', fontSize: 13, textDecoration: 'none' } satisfies CSSProperties,
  links: { display: 'flex', gap: 16 } satisfies CSSProperties,
  list: { display: 'grid', gap: 10, marginTop: 14 } satisfies CSSProperties,
  metric: { color: '#f4eeff', display: 'block', fontSize: 30, marginTop: 8 } satisfies CSSProperties,
  metricGrid: { display: 'grid', gap: 14, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' } satisfies CSSProperties,
  muted: { color: '#aaa7c8', lineHeight: 1.6, margin: '8px 0 0' } satisfies CSSProperties,
  nav: { alignItems: 'center', borderBottom: '1px solid rgba(176,128,255,.12)', display: 'flex', height: 62, justifyContent: 'space-between', padding: '0 clamp(18px,4vw,48px)', position: 'relative', zIndex: 2 } satisfies CSSProperties,
  page: { background: '#02020c', color: '#ecebff', minHeight: '100vh', position: 'relative' } satisfies CSSProperties,
  panel: { background: 'rgba(255,255,255,.028)', border: '1px solid rgba(176,128,255,.13)', borderRadius: 8, padding: 18 } satisfies CSSProperties,
  practice: { borderLeft: '3px solid #a855f7', color: '#e9d5ff', paddingLeft: 12 } satisfies CSSProperties,
  primaryAction: { background: '#9b4dff', borderRadius: 8, color: '#fff', fontWeight: 800, padding: '11px 14px', textDecoration: 'none' } satisfies CSSProperties,
  progressList: { display: 'grid', gap: 12, marginTop: 16 } satisfies CSSProperties,
  progressRow: { alignItems: 'center', display: 'grid', gap: 12, gridTemplateColumns: 'minmax(160px, 1.2fr) minmax(120px, 1fr) 52px' } satisfies CSSProperties,
  recommendation: { background: 'rgba(0,255,170,.035)', border: '1px solid rgba(74,222,128,.2)', borderRadius: 8, padding: 16 } satisfies CSSProperties,
  recommendations: { display: 'grid', gap: 12, marginTop: 16 } satisfies CSSProperties,
  row: { background: 'rgba(255,255,255,.035)', borderRadius: 6, display: 'grid', gap: 4, padding: 12 } satisfies CSSProperties,
  sectionTitle: { fontSize: 20, margin: 0 } satisfies CSSProperties,
  subtitle: { color: '#aaa7c8', margin: '10px 0 0' } satisfies CSSProperties,
  title: { fontSize: 'clamp(34px,6vw,62px)', fontWeight: 500, margin: '8px 0 0' } satisfies CSSProperties,
  twoCol: { display: 'grid', gap: 14, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } satisfies CSSProperties,
  wrap: { display: 'grid', gap: 18, margin: '0 auto', padding: '44px clamp(16px,5vw,60px) 70px', position: 'relative', width: 'min(1120px, 100%)', zIndex: 1 } satisfies CSSProperties,
} as const
