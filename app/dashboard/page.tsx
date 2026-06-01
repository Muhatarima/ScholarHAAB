'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import AuthGuard from '@/components/auth/AuthGuard'
import Badge from '@/components/Badge'
import DashboardStatCard from '@/components/DashboardStatCard'
import Logo from '@/components/Logo'
import StarBackground from '@/components/StarBackground'
import WeakTopicBar from '@/components/WeakTopicBar'

type DashboardApi = {
  name?: string
  level?: string
  subjects?: string[]
  questionsToday?: number
  totalQuestionsAttempted: number
  overallAccuracy: number
  studyStreak?: number
  examCountdowns?: Array<{ subject?: string; daysLeft?: number }>
  accuracyTrend: Array<{ date: string; accuracy: number; attempts?: number }>
  weeklyData?: Array<{ day: string; questions?: number; count?: number; accuracy?: number }>
  weakPoints: Array<{ subject?: string; topic: string; accuracy?: number; timesStruggled?: number }>
  recentSessions: Array<{
    id: string
    subject: string | null
    topic: string | null
    questionsAttempted?: number
    durationMinutes?: number | null
    startedAt?: string | null
  }>
  syllabus: Array<{ topic: string; status?: string; mastery?: number }>
  todaysPlan?: string[]
}

type LeaderboardRow = {
  user_id: string
  display_name: string | null
  total_score: number
  topics_mastered: number
}

function fallbackDashboard(): DashboardApi {
  return {
    totalQuestionsAttempted: 0,
    overallAccuracy: 0,
    accuracyTrend: [],
    weakPoints: [],
    recentSessions: [],
    syllabus: [],
    todaysPlan: [
      'Start solving questions and ScholarHAAB will detect your weak topics automatically.',
    ],
  }
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={styles.empty}>{children}</div>
}

function DashboardInner() {
  const [data, setData] = useState<DashboardApi>(fallbackDashboard)
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([])

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const [dashboardRes, leaderboardRes] = await Promise.all([
          fetch('/api/progress/dashboard', { cache: 'no-store' }),
          fetch('/api/leaderboard?limit=6', { cache: 'no-store' }),
        ])
        const dashboardJson = await dashboardRes.json()
        const leaderboardJson = await leaderboardRes.json()
        if (!active) return
        setData(dashboardJson.dashboard ?? fallbackDashboard())
        setLeaderboard(Array.isArray(leaderboardJson.leaderboard) ? leaderboardJson.leaderboard : [])
      } catch {
        if (active) setData(fallbackDashboard())
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const skipped = useMemo(() => data.syllabus.filter((topic) => topic.status === 'skipped'), [data.syllabus])
  const weakTopics = data.weakPoints.length
    ? data.weakPoints
    : data.syllabus
        .filter((topic) => topic.status === 'weak')
        .map((topic) => ({ subject: 'Tracked', topic: topic.topic, accuracy: topic.mastery }))
  const chartData = data.weeklyData?.length
    ? data.weeklyData.map((day) => ({ date: day.day, accuracy: day.accuracy ?? day.questions ?? day.count ?? 0 }))
    : data.accuracyTrend
  const daysToExam = data.examCountdowns?.[0]?.daysLeft ?? '—'
  const monthlyImprovement = data.accuracyTrend.length >= 2
    ? `${Math.max(0, Math.round(data.accuracyTrend.at(-1)!.accuracy - data.accuracyTrend[0].accuracy))}%`
    : '0%'

  return (
    <main style={styles.page}>
      <StarBackground variant="chat" />
      <style>{`
        @media (max-width: 820px) {
          .dashboard-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
          .dashboard-two-col {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
      <nav style={styles.nav}>
        <Logo compact />
        <div style={styles.links}>
          <Link href="/solver" style={styles.link}>Solver</Link>
          <Link href="/exam-mode" style={styles.link}>Exam Mode</Link>
          <Link href="/ai-approach" style={styles.link}>AI Approach</Link>
        </div>
      </nav>

      <section style={styles.content}>
        <section style={styles.profilePanel}>
          <div>
            <span style={styles.panelTitle}>Study profile</span>
            <p style={styles.profileText}>
              {data.level || 'Level not set'} · {(data.subjects?.length ? data.subjects : ['No subjects selected']).join(', ')}
            </p>
          </div>
          <Link href="/settings/profile" style={styles.profileLink}>Edit profile</Link>
        </section>

        <div className="dashboard-stats" style={styles.statsGrid}>
          <DashboardStatCard value={data.questionsToday ?? 0} label="Questions Today" />
          <DashboardStatCard value={`${Math.round(data.overallAccuracy || 0)}%`} label="Accuracy" />
          <DashboardStatCard value={data.studyStreak ?? 0} label="Study Streak" />
          <DashboardStatCard value={daysToExam} label="Days to Exam" />
        </div>

        <section style={styles.graph}>
          <div style={styles.panelHeader}>
            <span style={styles.panelTitle}>Weekly performance</span>
            <Badge tone="violet">Monthly improvement {monthlyImprovement}</Badge>
          </div>
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
            <div style={styles.panelHeader}>
              <span style={styles.panelTitle}>Weak topics</span>
              <Badge tone="amber">High exam chance</Badge>
            </div>
            {weakTopics.length ? (
              weakTopics.slice(0, 6).map((point, index) => (
                <WeakTopicBar
                  key={`${point.subject ?? 'General'}-${point.topic}`}
                  chance={index < 3}
                  progress={Number(point.accuracy ?? 40)}
                  subject={point.subject ?? 'Tracked'}
                  topic={point.topic}
                />
              ))
            ) : (
              <Empty>Start solving questions and ScholarHAAB will detect your weak topics automatically.</Empty>
            )}
          </div>

          <div style={styles.panel}>
            <div style={styles.panelHeader}>
              <span style={styles.panelTitle}>Skipped chapters</span>
              {skipped.length >= 2 ? <Badge tone="amber">Cover soon</Badge> : null}
            </div>
            {skipped.length ? (
              skipped.map((topic) => (
                <Link key={topic.topic} href={`/solver?prompt=${encodeURIComponent(`Cover ${topic.topic}`)}`} style={styles.skipRow}>
                  <span>{topic.topic}</span>
                  <span>Cover now</span>
                </Link>
              ))
            ) : (
              <Empty>No skipped chapters tracked</Empty>
            )}
          </div>
        </section>

        <section className="dashboard-two-col" style={styles.twoCol}>
          <div style={styles.panel}>
            <div style={styles.panelHeader}>
              <span style={styles.panelTitle}>Today&apos;s focus</span>
            </div>
            <ul style={styles.planList}>
              {(data.todaysPlan?.length ? data.todaysPlan : fallbackDashboard().todaysPlan ?? []).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div style={styles.panel}>
            <div style={styles.panelHeader}>
              <span style={styles.panelTitle}>Leaderboard</span>
            </div>
            {leaderboard.length ? (
              leaderboard.map((row, index) => (
                <div key={row.user_id} style={styles.leaderRow}>
                  <span>{index + 1}</span>
                  <span>{row.display_name || 'Student'}</span>
                  <span>{row.total_score}</span>
                </div>
              ))
            ) : (
              <Empty>Complete sessions to appear</Empty>
            )}
          </div>
        </section>
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
    background: '#00000d',
    color: '#E8E8FF',
    minHeight: '100vh',
    overflowX: 'hidden',
    position: 'relative',
  } satisfies CSSProperties,
  nav: {
    alignItems: 'center',
    borderBottom: '1px solid rgba(170,85,255,0.1)',
    display: 'flex',
    flexWrap: 'wrap',
    gap: 18,
    justifyContent: 'space-between',
    padding: '14px clamp(16px,4vw,40px)',
    position: 'relative',
    zIndex: 2,
  } satisfies CSSProperties,
  links: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 14,
  } satisfies CSSProperties,
  link: {
    color: '#aaa6ca',
    fontSize: 13,
    textDecoration: 'none',
  } satisfies CSSProperties,
  content: {
    display: 'grid',
    gap: 18,
    margin: '0 auto',
    padding: '28px clamp(16px,4vw,52px) 52px',
    position: 'relative',
    width: 'min(1180px, 100%)',
    zIndex: 1,
  } satisfies CSSProperties,
  statsGrid: {
    display: 'grid',
    gap: 12,
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  } satisfies CSSProperties,
  profilePanel: {
    alignItems: 'center',
    background: 'rgba(255,255,255,0.035)',
    border: '1px solid rgba(170,85,255,0.08)',
    borderRadius: 24,
    display: 'flex',
    gap: 16,
    justifyContent: 'space-between',
    padding: 16,
  } satisfies CSSProperties,
  profileText: {
    color: '#aaa6ca',
    margin: '7px 0 0',
  } satisfies CSSProperties,
  profileLink: {
    border: '1px solid rgba(170,85,255,0.16)',
    borderRadius: 999,
    color: '#d8b4fe',
    padding: '9px 12px',
    textDecoration: 'none',
  } satisfies CSSProperties,
  graph: {
    background: 'rgba(255,255,255,0.035)',
    border: '1px solid rgba(170,85,255,0.08)',
    borderRadius: 24,
    minHeight: 330,
    padding: 16,
  } satisfies CSSProperties,
  twoCol: {
    display: 'grid',
    gap: 16,
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  } satisfies CSSProperties,
  panel: {
    background: 'rgba(255,255,255,0.035)',
    border: '1px solid rgba(170,85,255,0.08)',
    borderRadius: 24,
    minHeight: 260,
    padding: 16,
  } satisfies CSSProperties,
  panelHeader: {
    alignItems: 'center',
    display: 'flex',
    gap: 12,
    justifyContent: 'space-between',
    marginBottom: 12,
  } satisfies CSSProperties,
  panelTitle: {
    color: '#f4eeff',
    fontSize: 16,
    fontWeight: 800,
  } satisfies CSSProperties,
  skipRow: {
    alignItems: 'center',
    borderBottom: '1px solid rgba(255,255,255,0.055)',
    color: '#e8e8ff',
    display: 'flex',
    justifyContent: 'space-between',
    padding: '13px 2px',
    textDecoration: 'none',
  } satisfies CSSProperties,
  planList: {
    color: '#d8d2f2',
    display: 'grid',
    gap: 12,
    lineHeight: 1.6,
    margin: 0,
    paddingLeft: 18,
  } satisfies CSSProperties,
  leaderRow: {
    alignItems: 'center',
    borderBottom: '1px solid rgba(255,255,255,0.055)',
    color: '#d8d2f2',
    display: 'grid',
    gap: 10,
    gridTemplateColumns: '40px 1fr auto',
    padding: '12px 0',
  } satisfies CSSProperties,
  empty: {
    color: '#77779d',
    display: 'grid',
    minHeight: 150,
    placeItems: 'center',
    textAlign: 'center',
  } satisfies CSSProperties,
}
