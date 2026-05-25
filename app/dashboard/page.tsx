'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import AuthGuard from '@/components/auth/AuthGuard'

type DashboardApi = {
  totalQuestionsAttempted: number
  overallAccuracy: number
  accuracyTrend: Array<{ date: string; accuracy: number; attempts?: number }>
  weakPoints: Array<{ subject?: string; topic: string; accuracy?: number }>
  recentSessions: Array<{
    id: string
    subject: string | null
    topic: string | null
    questionsAttempted?: number
    durationMinutes?: number | null
    startedAt?: string | null
  }>
  syllabus: Array<{ topic: string; status?: string; mastery?: number }>
}

type LeaderboardRow = {
  user_id: string
  display_name: string | null
  total_score: number
  topics_mastered: number
}

type DashboardResponse = { dashboard?: DashboardApi }
type LeaderboardResponse = { leaderboard?: LeaderboardRow[]; userRank?: { rank: number; score: number } | null }

function fallbackDashboard(): DashboardApi {
  return {
    totalQuestionsAttempted: 0,
    overallAccuracy: 0,
    accuracyTrend: [],
    weakPoints: [],
    recentSessions: [],
    syllabus: [],
  }
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div style={styles.stat}>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={styles.empty}>{children}</div>
}

function DashboardInner() {
  const [data, setData] = useState<DashboardApi>(fallbackDashboard)
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([])
  const [userRank, setUserRank] = useState<LeaderboardResponse['userRank']>(null)

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const [dashboardRes, leaderboardRes] = await Promise.all([
          fetch('/api/progress/dashboard', { cache: 'no-store' }),
          fetch('/api/leaderboard?limit=8', { cache: 'no-store' }),
        ])
        const dashboardJson = (await dashboardRes.json()) as DashboardResponse
        const leaderboardJson = (await leaderboardRes.json()) as LeaderboardResponse
        if (!active) return
        setData(dashboardJson.dashboard ?? fallbackDashboard())
        setLeaderboard(Array.isArray(leaderboardJson.leaderboard) ? leaderboardJson.leaderboard : [])
        setUserRank(leaderboardJson.userRank ?? null)
      } catch {
        if (active) setData(fallbackDashboard())
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const totals = useMemo(() => {
    const topics = data.syllabus.length || data.weakPoints.length || data.totalQuestionsAttempted
    const confident = data.syllabus.filter((topic) => (topic.mastery ?? 0) >= 70 || topic.status === 'confident').length
    const weak = data.weakPoints.length
    const skipped = data.syllabus.filter((topic) => topic.status === 'skipped').length
    return { topics, confident, weak, skipped }
  }, [data])

  const chartData = data.accuracyTrend.length
    ? data.accuracyTrend
    : data.overallAccuracy
      ? [{ date: 'Now', accuracy: data.overallAccuracy }]
      : []

  return (
    <main style={styles.page}>
      <style>{`
        @media (max-width: 760px) {
          .dashboard-stats { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .dashboard-two-col { grid-template-columns: 1fr !important; }
          .dashboard-session-row { grid-template-columns: 1fr !important; gap: 4px !important; }
        }
      `}</style>
      <nav style={styles.nav}>
        <Link href="/qbank" style={styles.navLink}>
          ←
        </Link>
        <Link href="/exam-prep" style={styles.navLink}>
          🎯
        </Link>
      </nav>

      <section className="dashboard-stats" style={styles.statsGrid}>
        <Stat value={totals.topics} label="Topics" />
        <Stat value={totals.confident} label="Confident" />
        <Stat value={totals.weak} label="Weak" />
        <Stat value={totals.skipped} label="Skipped" />
      </section>

      <section style={styles.graph}>
        {chartData.length ? (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 18, right: 8, left: -24, bottom: 0 }}>
              <XAxis dataKey="date" tick={{ fill: '#77779d', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: '#77779d', fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  background: '#111029',
                  border: '1px solid rgba(170,85,255,0.18)',
                  borderRadius: 14,
                  color: '#E8E8FF',
                }}
              />
              <Line type="monotone" dataKey="accuracy" stroke="#aa55ff" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <Empty>Start studying to see your progress</Empty>
        )}
      </section>

      <section className="dashboard-two-col" style={styles.twoCol}>
        <div style={styles.panel}>
          {data.weakPoints.length ? (
            data.weakPoints.slice(0, 8).map((point) => (
              <Link
                key={`${point.subject ?? 'General'}-${point.topic}`}
                href={`/qbank?prompt=${encodeURIComponent(`Revise ${point.topic}`)}`}
                style={styles.rowLink}
              >
                <span style={styles.tag}>{point.subject ?? 'General'}</span>
                <span>{point.topic}</span>
                <span style={styles.revise}>Revise →</span>
              </Link>
            ))
          ) : (
            <Empty>No weak topics yet 🎯</Empty>
          )}
        </div>

        <div style={styles.panel}>
          {leaderboard.length ? (
            leaderboard.map((row, index) => {
              const active = userRank?.rank === index + 1
              return (
                <div key={row.user_id} style={styles.leaderRow(active)}>
                  <span>{index + 1}</span>
                  <span>{row.display_name || 'Student'}</span>
                  <span>{row.total_score}</span>
                </div>
              )
            })
          ) : (
            <Empty>Complete sessions to appear</Empty>
          )}
        </div>
      </section>

      <section style={styles.tablePanel}>
        {data.recentSessions.length ? (
          <div style={styles.table}>
            {data.recentSessions.slice(0, 8).map((session) => (
              <div key={session.id} className="dashboard-session-row" style={styles.sessionRow}>
                <span>{session.startedAt ? new Date(session.startedAt).toLocaleDateString() : 'Today'}</span>
                <span>{session.subject ?? 'General'}</span>
                <span>{session.topic ?? 'Mixed'}</span>
                <span>{session.durationMinutes ?? 0}m</span>
              </div>
            ))}
          </div>
        ) : (
          <Empty>No sessions yet</Empty>
        )}
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
  page: {
    minHeight: '100vh',
    background: '#00000d',
    color: '#E8E8FF',
    display: 'grid',
    gap: 20,
    fontFamily: 'var(--font-sans), sans-serif',
    padding: '28px clamp(16px, 4vw, 52px)',
  } satisfies CSSProperties,
  nav: {
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end',
  } satisfies CSSProperties,
  navLink: {
    color: '#9F9FC4',
    textDecoration: 'none',
    width: 36,
    height: 36,
    display: 'grid',
    placeItems: 'center',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.035)',
  } satisfies CSSProperties,
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 12,
  } satisfies CSSProperties,
  stat: {
    background: 'rgba(255,255,255,0.045)',
    borderRadius: 20,
    minHeight: 108,
    padding: 18,
    display: 'grid',
    alignContent: 'center',
  } satisfies CSSProperties,
  statValue: {
    color: '#F4EEFF',
    fontSize: 'clamp(28px, 5vw, 44px)',
    fontWeight: 600,
    letterSpacing: '-0.04em',
  } satisfies CSSProperties,
  statLabel: {
    color: '#9F9FC4',
    fontSize: 13,
  } satisfies CSSProperties,
  graph: {
    background: 'rgba(255,255,255,0.035)',
    borderRadius: 24,
    minHeight: 300,
    padding: 12,
  } satisfies CSSProperties,
  twoCol: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 16,
  } satisfies CSSProperties,
  panel: {
    background: 'rgba(255,255,255,0.035)',
    borderRadius: 24,
    minHeight: 260,
    padding: 14,
  } satisfies CSSProperties,
  rowLink: {
    color: '#E8E8FF',
    display: 'grid',
    gridTemplateColumns: 'auto 1fr auto',
    gap: 10,
    alignItems: 'center',
    padding: '12px 8px',
    textDecoration: 'none',
  } satisfies CSSProperties,
  tag: {
    color: '#C084FC',
    fontSize: 12,
  } satisfies CSSProperties,
  revise: {
    color: '#9F9FC4',
    fontSize: 12,
  } satisfies CSSProperties,
  leaderRow: (active: boolean) =>
    ({
      display: 'grid',
      gridTemplateColumns: '40px 1fr auto',
      gap: 10,
      alignItems: 'center',
      borderRadius: 14,
      background: active ? 'rgba(170,85,255,0.18)' : 'transparent',
      color: active ? '#F4EEFF' : '#E8E8FF',
      padding: '12px 10px',
    }) satisfies CSSProperties,
  tablePanel: {
    background: 'rgba(255,255,255,0.035)',
    borderRadius: 24,
    minHeight: 190,
    padding: 14,
  } satisfies CSSProperties,
  table: {
    display: 'grid',
  } satisfies CSSProperties,
  sessionRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 2fr auto',
    gap: 12,
    color: '#c9c5e8',
    padding: '13px 8px',
    borderBottom: '1px solid rgba(255,255,255,0.055)',
  } satisfies CSSProperties,
  empty: {
    minHeight: 160,
    display: 'grid',
    placeItems: 'center',
    color: '#77779d',
    textAlign: 'center',
  } satisfies CSSProperties,
}
