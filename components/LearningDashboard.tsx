'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import Blackhole from '@/components/Blackhole'
import Stars from '@/components/Stars'
import { signOut } from '@/app/auth/actions'
import AccuracyTrendChart from '@/components/progress/AccuracyTrendChart'
import ExamReadinessScore from '@/components/progress/ExamReadinessScore'
import SubjectProgressCard from '@/components/progress/SubjectProgressCard'
import SyllabusMap from '@/components/progress/SyllabusMap'
import TopicProgressBar from '@/components/progress/TopicProgressBar'
import WeeklyActivityChart from '@/components/progress/WeeklyActivityChart'

type WeakPoint = {
  topic: string
  accuracy: number
  attempts: number
  mistakePattern: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM'
  recommended_action: string
  examProbability?: number
  examFlag?: string
}

type DashboardData = {
  name: string
  level: string
  subjects: string[]
  weakTopics: string[]
  strongTopics: string[]
  studyStreak: number
  totalQuestionsAttempted: number
  questionsToday: number
  dailyGoal: number
  overallAccuracy: number
  trend: 'improving' | 'declining' | 'stable'
  lastWeekDelta: number
  longestStreak: number
  todaysPlan: string[]
  recentSessions: Array<{
    id: string
    subject: string | null
    topic: string | null
    questionsAttempted: number
    questionsCorrect: number
    aiNotes: string | null
    startedAt?: string | null
  }>
  weeklyData: Array<{ day: string; questions: number; accuracy: number }>
  accuracyTrend: Array<{ date: string; accuracy: number; attempts: number }>
  subjectPerformance: Array<{
    subject: string
    mastery: number
    strongCount: number
    weakCount: number
    lastStudied: string | null
  }>
  examCountdowns: Array<{ label: string; days: number }>
  weakPoints: WeakPoint[]
  syllabus: Array<{
    topic: string
    mastery: number
    status: 'mastered' | 'learning' | 'weak' | 'not_attempted'
  }>
  tenYearAnalysis: {
    studyPriority: string[]
    predictions: Array<{
      topic: string
      probability: number
      reasoning: string
      recommendation: string
      studentFlag?: string
    }>
  }
  readinessScore: number
}

type TabId = 'weekly' | 'accuracy' | 'mastery' | 'analysis'

function fallbackDashboard(userName: string): DashboardData {
  return {
    name: userName,
    level: 'A Level',
    subjects: ['Physics', 'Mathematics', 'Chemistry'],
    weakTopics: [],
    strongTopics: [],
    studyStreak: 0,
    totalQuestionsAttempted: 0,
    questionsToday: 0,
    dailyGoal: 20,
    overallAccuracy: 0,
    trend: 'stable',
    lastWeekDelta: 0,
    longestStreak: 0,
    todaysPlan: [
      'Diagnostic drill - find your first weak point',
      'Repeated-topic revision - 10 min',
      'Paper 2 mini mock - 30 min timing practice',
    ],
    recentSessions: [],
    weeklyData: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => ({
      day,
      questions: 0,
      accuracy: 0,
    })),
    accuracyTrend: [],
    subjectPerformance: [
      { subject: 'Physics', mastery: 0, strongCount: 0, weakCount: 0, lastStudied: null },
      { subject: 'Mathematics', mastery: 0, strongCount: 0, weakCount: 0, lastStudied: null },
      { subject: 'Chemistry', mastery: 0, strongCount: 0, weakCount: 0, lastStudied: null },
    ],
    examCountdowns: [],
    weakPoints: [],
    syllabus: [],
    tenYearAnalysis: {
      studyPriority: ['Waves', 'Electricity', 'Forces'],
      predictions: [],
    },
    readinessScore: 0,
  }
}

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) {
    return 'Good morning'
  }
  if (hour < 18) {
    return 'Good afternoon'
  }
  return 'Good evening'
}

function motivation(data: DashboardData) {
  const nearestExam = data.examCountdowns[0]
  if (nearestExam && nearestExam.days <= 3) {
    return `${nearestExam.label} exam in ${nearestExam.days} days - focus mode.`
  }
  if (data.studyStreak >= 7) {
    return `${data.studyStreak} day streak. You are genuinely building momentum.`
  }
  if (data.weakPoints[0]) {
    return `${data.weakPoints[0].topic} needs attention today. Small focused drill, then move on.`
  }
  if (data.trend === 'improving') {
    return `Your accuracy is improving. Keep the pressure steady.`
  }
  return 'Start with one clean question. Momentum beats panic.'
}

function trendArrow(trend: DashboardData['trend']) {
  if (trend === 'improving') {
    return 'up'
  }
  if (trend === 'declining') {
    return 'down'
  }
  return 'steady'
}

function Card({
  children,
  style,
}: {
  children: ReactNode
  style?: CSSProperties
}) {
  return (
    <article
      style={{
        borderRadius: '24px',
        border: '1px solid rgba(170,85,255,0.16)',
        background: 'linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.025))',
        padding: '20px',
        boxShadow: '0 18px 60px rgba(0,0,0,0.18)',
        ...style,
      }}
    >
      {children}
    </article>
  )
}

function StatCard({
  label,
  value,
  hint,
  accent = '#6be4ff',
}: {
  label: string
  value: string
  hint: string
  accent?: string
}) {
  return (
    <Card>
      <div style={{ color: accent, fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase' }}>{label}</div>
      <strong style={{ display: 'block', marginTop: '10px', fontSize: '34px', color: '#fff' }}>{value}</strong>
      <p style={{ color: '#b8b8d8', lineHeight: 1.6, margin: '8px 0 0', fontSize: '13px' }}>{hint}</p>
    </Card>
  )
}

export default function LearningDashboard({ userName }: { userName: string }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('weekly')

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/progress/dashboard', { cache: 'no-store' })
        const payload = await res.json()
        setData(payload.dashboard ?? null)
      } catch {
        setData(null)
      }
    })()
  }, [])

  const dashboard = useMemo(() => data ?? fallbackDashboard(userName), [data, userName])
  const nearestExam = dashboard.examCountdowns[0]
  const todayRemaining = Math.max(0, dashboard.dailyGoal - dashboard.questionsToday)
  const topSubject = dashboard.subjects[0] ?? 'Physics'

  return (
    <main
      style={{
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
        background: 'radial-gradient(circle at 20% 0%, rgba(88,28,135,0.38), transparent 34%), linear-gradient(160deg,#020617 0%,#09091f 52%,#180826 100%)',
        color: '#E8E8FF',
        padding: '112px 18px 112px',
      }}
    >
      <Stars />
      <Blackhole />

      <div style={{ position: 'relative', zIndex: 10, maxWidth: '1220px', margin: '0 auto', display: 'grid', gap: '20px' }}>
        <header
          style={{
            borderRadius: '30px',
            border: '1px solid rgba(170,85,255,0.18)',
            background: 'linear-gradient(135deg, rgba(15,23,42,0.84), rgba(88,28,135,0.34))',
            padding: 'clamp(22px, 4vw, 34px)',
            display: 'flex',
            justifyContent: 'space-between',
            gap: '18px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ maxWidth: '760px' }}>
            <p style={{ color: '#6be4ff', letterSpacing: '2px', textTransform: 'uppercase', fontSize: '12px', margin: 0 }}>
              ScholarHAAB intelligence dashboard
            </p>
            <h1 style={{ margin: '12px 0', fontSize: 'clamp(34px, 7vw, 68px)', lineHeight: 0.98 }}>
              {greeting()}, {dashboard.name}
            </h1>
            <p style={{ margin: 0, color: '#d8d3ff', lineHeight: 1.7, fontSize: '16px' }}>
              {motivation(dashboard)}
            </p>
          </div>

          <div style={{ display: 'grid', gap: '12px', justifyItems: 'end' }}>
            <ExamReadinessScore score={dashboard.readinessScore} />
            <form action={signOut}>
              <button type="submit" style={{ border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#F4EEFF', borderRadius: '999px', padding: '10px 16px', cursor: 'pointer', fontWeight: 800 }}>
                Log out
              </button>
            </form>
          </div>
        </header>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          <StatCard
            label="Questions today"
            value={String(dashboard.questionsToday)}
            hint={`${todayRemaining} more to hit your ${dashboard.dailyGoal}-question goal`}
          />
          <StatCard
            label="Overall accuracy"
            value={`${dashboard.overallAccuracy}%`}
            hint={`${trendArrow(dashboard.trend)} vs recent performance`}
            accent={dashboard.trend === 'declining' ? '#fb7185' : '#4ade80'}
          />
          <StatCard
            label="Study streak"
            value={`${dashboard.studyStreak} days`}
            hint={`Longest streak: ${dashboard.longestStreak} days`}
            accent="#f97316"
          />
          <StatCard
            label="Exam countdown"
            value={nearestExam ? `${nearestExam.days} days` : 'Not set'}
            hint={nearestExam ? nearestExam.label : 'Add exam dates to unlock focus planning'}
            accent={nearestExam && nearestExam.days < 7 ? '#fb7185' : nearestExam && nearestExam.days < 14 ? '#facc15' : '#4ade80'}
          />
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '14px' }}>
          {dashboard.subjectPerformance.map((subject) => (
            <SubjectProgressCard
              key={subject.subject}
              subject={subject.subject}
              mastery={subject.mastery}
              strongCount={subject.strongCount}
              weakCount={subject.weakCount}
              lastStudied={subject.lastStudied}
            />
          ))}
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.95fr) minmax(0, 1.05fr)', gap: '16px' }}>
          <Card>
            <h2 style={{ margin: '0 0 14px' }}>Needs attention</h2>
            <div style={{ display: 'grid', gap: '14px' }}>
              {(dashboard.weakPoints.length ? dashboard.weakPoints.slice(0, 3) : [{
                topic: 'No weak topic detected yet',
                accuracy: 0,
                attempts: 0,
                mistakePattern: 'Start practicing to unlock weak-point detection.',
                severity: 'MEDIUM' as const,
                recommended_action: 'Do diagnostic drill',
              }]).map((point) => (
                <div key={point.topic} style={{ display: 'grid', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                    <div>
                      <strong style={{ color: '#fff' }}>{point.topic}</strong>
                      <p style={{ margin: '4px 0 0', color: '#b8b8d8', fontSize: '13px' }}>{point.mistakePattern}</p>
                    </div>
                    <Link href={`/qbank?prompt=${encodeURIComponent(`Practice ${point.topic}`)}`} style={{ color: '#fff', background: '#7c3aed', borderRadius: '999px', padding: '8px 12px', textDecoration: 'none', fontSize: '12px', fontWeight: 900 }}>
                      Practice now
                    </Link>
                  </div>
                  <TopicProgressBar topic={`${point.severity} · ${point.recommended_action}`} mastery={point.accuracy} />
                  {point.examFlag ? (
                    <span style={{ justifySelf: 'start', color: '#fef3c7', background: 'rgba(250,204,21,0.12)', border: '1px solid rgba(250,204,21,0.22)', borderRadius: '999px', padding: '6px 9px', fontSize: '11px', fontWeight: 900 }}>
                      {point.examFlag} {point.examProbability ? `- ${point.examProbability}%` : ''}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 style={{ margin: '0 0 14px' }}>Today&apos;s focus plan</h2>
            <div style={{ display: 'grid', gap: '12px' }}>
              {dashboard.todaysPlan.map((item, index) => (
                <div key={item} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', borderRadius: '18px', background: 'rgba(255,255,255,0.04)', padding: '14px' }}>
                  <div>
                    <strong style={{ color: index === 0 ? '#fecaca' : index === 1 ? '#fef3c7' : '#bbf7d0' }}>
                      {index + 1}. {item}
                    </strong>
                  </div>
                  <Link href={`/qbank?prompt=${encodeURIComponent(item)}`} style={{ color: '#c084fc', textDecoration: 'none', fontWeight: 900 }}>
                    Start
                  </Link>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
            <h2 style={{ margin: 0 }}>Progress charts</h2>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[
                ['weekly', 'Weekly Activity'],
                ['accuracy', 'Accuracy Trend'],
                ['mastery', 'Topic Mastery Map'],
                ['analysis', '10-Year Analysis'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id as TabId)}
                  style={{
                    border: '1px solid rgba(170,85,255,0.18)',
                    borderRadius: '999px',
                    background: activeTab === id ? '#7c3aed' : 'rgba(255,255,255,0.04)',
                    color: '#fff',
                    padding: '8px 12px',
                    cursor: 'pointer',
                    fontWeight: 800,
                    fontSize: '12px',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {activeTab === 'weekly' ? <WeeklyActivityChart data={dashboard.weeklyData} goal={dashboard.dailyGoal} /> : null}
          {activeTab === 'accuracy' ? <AccuracyTrendChart data={dashboard.accuracyTrend} /> : null}
          {activeTab === 'mastery' ? <SyllabusMap subject={topSubject} topics={dashboard.syllabus} /> : null}
          {activeTab === 'analysis' ? (
            <div style={{ display: 'grid', gap: '12px' }}>
              {dashboard.tenYearAnalysis.predictions.slice(0, 8).map((prediction) => (
                <div key={prediction.topic} style={{ display: 'grid', gap: '8px' }}>
                  <TopicProgressBar topic={`${prediction.topic} - ${prediction.recommendation}`} mastery={prediction.probability} />
                  <p style={{ margin: 0, color: prediction.studentFlag ? '#fecaca' : '#b8b8d8', fontSize: '13px', lineHeight: 1.6 }}>
                    {prediction.reasoning} {prediction.studentFlag ? ` · ${prediction.studentFlag}` : ''}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </Card>

        <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(260px, 0.55fr)', gap: '16px' }}>
          <Card>
            <h2 style={{ margin: '0 0 14px' }}>Recent sessions</h2>
            <div style={{ display: 'grid', gap: '10px' }}>
              {dashboard.recentSessions.length ? dashboard.recentSessions.slice(0, 5).map((session) => {
                const score = session.questionsAttempted
                  ? Math.round((session.questionsCorrect / session.questionsAttempted) * 100)
                  : 0
                const status = score >= 70 ? 'Improved' : score > 0 ? 'Struggled' : 'New topic'
                return (
                  <div key={session.id} style={{ borderRadius: '18px', background: 'rgba(255,255,255,0.04)', padding: '14px', display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                    <div>
                      <strong>{session.subject ?? 'General'} - {session.topic ?? 'Mixed practice'}</strong>
                      <p style={{ margin: '6px 0 0', color: '#b8b8d8', lineHeight: 1.6 }}>
                        Score: {session.questionsCorrect}/{session.questionsAttempted} ({score}%) · {status}
                      </p>
                    </div>
                    <Link href={`/qbank?prompt=${encodeURIComponent(`Review ${session.topic ?? session.subject ?? 'my last session'}`)}`} style={{ color: '#c084fc', textDecoration: 'none', fontWeight: 900 }}>
                      Review session
                    </Link>
                  </div>
                )
              }) : (
                <p style={{ color: '#b8b8d8', lineHeight: 1.7, margin: 0 }}>
                  No sessions yet. Start one QBank chat and this section will begin tracking your learning history.
                </p>
              )}
            </div>
          </Card>

          <Card>
            <h2 style={{ margin: '0 0 14px' }}>Quick actions</h2>
            <div style={{ display: 'grid', gap: '10px' }}>
              {[
                ['/qbank?prompt=My Physics Paper 1 exam is tomorrow', 'Emergency Mode'],
                ['/qbank?prompt=Generate a mock question for me', 'Generate Mock'],
                ['/qbank?prompt=Ask tutor mode to explain my weak topic', 'Ask Tutor'],
                ['/qbank/progress', 'Full Analytics'],
              ].map(([href, label]) => (
                <Link key={href} href={href} style={{ borderRadius: '18px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', padding: '14px', color: '#f4eeff', textDecoration: 'none', fontWeight: 900 }}>
                  {label}
                </Link>
              ))}
            </div>
          </Card>
        </section>
      </div>
    </main>
  )
}
