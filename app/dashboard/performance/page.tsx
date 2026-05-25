import Link from 'next/link'
import { redirect } from 'next/navigation'
import AuthGuard from '@/components/auth/AuthGuard'
import Blackhole from '@/components/Blackhole'
import PerformanceTrendChart from '@/components/dashboard/PerformanceTrendChart'
import Stars from '@/components/Stars'
import { requireAuth } from '@/lib/auth/requireAuth'
import { getStudentProfile, type TopicPerformance } from '@/lib/analytics/topicTracker'

function dateLabel(value: string | null | undefined) {
  if (!value) return 'Not seen yet'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function prepHref(subject: string, topic: string, level?: string | null) {
  const params = new URLSearchParams({
    subject,
    topic,
    level: level || 'A Level',
  })
  return `/exam-prep?${params.toString()}`
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <section
      style={{
        border: '1px solid rgba(192,132,252,0.16)',
        background: 'linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.025))',
        borderRadius: 28,
        padding: 20,
        minWidth: 0,
        boxShadow: '0 18px 60px rgba(0,0,0,0.22)',
      }}
    >
      {children}
    </section>
  )
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <article
      style={{
        borderRadius: 24,
        border: '1px solid rgba(170,85,255,0.16)',
        background: 'rgba(255,255,255,0.045)',
        padding: 20,
      }}
    >
      <div style={{ color: '#9A6CFF', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' }}>{label}</div>
      <strong style={{ display: 'block', fontSize: 30, marginTop: 10 }}>{value}</strong>
      <p style={{ color: '#9a9abe', margin: '8px 0 0', lineHeight: 1.6, fontSize: 13 }}>{hint}</p>
    </article>
  )
}

function TopicRow({ topic, action }: { topic: TopicPerformance; action: string }) {
  const struggled = topic.times_skipped + topic.times_asked_differently
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 14,
        alignItems: 'center',
        padding: '14px 0',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <div>
        <div style={{ color: '#fff', fontWeight: 800 }}>{topic.topic}</div>
        <div style={{ color: '#9a9abe', fontSize: 13, marginTop: 4 }}>
          {topic.subject} | struggled {struggled}x | last seen {dateLabel(topic.last_interaction)}
        </div>
      </div>
      <Link
        href={prepHref(topic.subject, topic.topic, topic.level)}
        style={{
          textDecoration: 'none',
          color: '#fff',
          padding: '9px 12px',
          borderRadius: 999,
          background: 'linear-gradient(130deg,#7733cc,#aa55ff)',
          fontSize: 12,
          fontWeight: 800,
        }}
      >
        {action}
      </Link>
    </div>
  )
}

function SubjectBreakdown({
  subject,
  confident,
  weak,
  skipped,
  unseen,
  total,
}: {
  subject: string
  confident: number
  weak: number
  skipped: number
  unseen: number
  total: number
}) {
  const safeTotal = Math.max(1, total)
  const segments = [
    { value: confident, color: '#22c55e', label: 'confident' },
    { value: weak, color: '#facc15', label: 'weak' },
    { value: skipped, color: '#fb7185', label: 'skipped' },
    { value: unseen, color: '#64748b', label: 'unseen' },
  ]
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ede6ff', fontSize: 14 }}>
        <span>{subject}</span>
        <span>{confident}/{total} confident</span>
      </div>
      <div style={{ display: 'flex', height: 12, borderRadius: 999, overflow: 'hidden', background: 'rgba(255,255,255,0.06)' }}>
        {segments.map((segment) => (
          <div
            key={segment.label}
            title={`${segment.label}: ${segment.value}`}
            style={{
              width: `${(segment.value / safeTotal) * 100}%`,
              background: segment.color,
              minWidth: segment.value ? 8 : 0,
            }}
          />
        ))}
      </div>
    </div>
  )
}

export default async function PerformanceDashboardPage() {
  const { user, error } = await requireAuth()
  if (error || !user) {
    redirect('/login')
  }

  const profile = await getStudentProfile(user.id)
  const weakTopics = profile.topics.filter((topic) => topic.status === 'weak')
  const skippedTopics = profile.topics.filter((topic) => topic.status === 'skipped')
  const recentSessions = profile.sessions.slice(0, 5)
  const hasAnalyticsData = profile.topics.length > 0 || recentSessions.length > 0

  return (
    <AuthGuard>
      <main
        style={{
          minHeight: '100vh',
          position: 'relative',
          overflow: 'hidden',
          background: '#00000d',
          color: '#E8E8FF',
          padding: '112px 24px 56px',
        }}
      >
        <Stars />
        <Blackhole />
        <div style={{ position: 'relative', zIndex: 10, maxWidth: 1180, margin: '0 auto', display: 'grid', gap: 22 }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <p style={{ fontSize: 12, letterSpacing: 3, textTransform: 'uppercase', color: '#9A6CFF' }}>
                Student performance
              </p>
              <h1 style={{ fontSize: 'clamp(32px, 5vw, 56px)', margin: '10px 0 12px' }}>
                Weak spots, skips, and exam prep momentum
              </h1>
              <p style={{ color: '#9a9abe', lineHeight: 1.7, maxWidth: 760 }}>
                This dashboard turns every night-before prep session into a clear recovery map: what you skipped, what felt weak, and what is becoming confident.
              </p>
            </div>
            <Link href="/exam-prep" style={{ textDecoration: 'none', color: '#d8b4fe', fontSize: 13 }}>
              Open Exam Prep
            </Link>
          </header>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16 }}>
            <StatCard label="Subjects studied" value={profile.totals.subjects} hint="Subjects with tracked exam-prep activity." />
            <StatCard label="Confident ✅" value={profile.totals.confident} hint="Topics you marked as understood." />
            <StatCard label="Weak ⚠️" value={profile.totals.weak} hint="Topics where you asked for another explanation." />
            <StatCard label="Skipped ⏭️" value={profile.totals.skipped} hint="Topics you moved past and should revisit." />
            <StatCard label="Study streak 🔥" value={`${profile.totals.studyStreak} days`} hint="Consecutive days with exam-prep sessions." />
          </div>

          {!hasAnalyticsData ? (
            <SectionCard>
              <div style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>
                Start an Exam Prep session to see your analytics
              </div>
              <p style={{ color: '#9a9abe', lineHeight: 1.7, margin: '10px 0 16px' }}>
                Weak topics, skipped topics, recent sessions, and confidence trends will appear here automatically.
              </p>
              <Link
                href="/exam-prep"
                style={{
                  display: 'inline-flex',
                  textDecoration: 'none',
                  color: '#fff',
                  padding: '10px 14px',
                  borderRadius: 999,
                  background: 'linear-gradient(130deg,#7733cc,#aa55ff)',
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                Start Exam Prep
              </Link>
            </SectionCard>
          ) : null}

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(320px, 0.75fr)', gap: 18 }}>
            <SectionCard>
              <div style={{ color: '#9A6CFF', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' }}>Weak topics</div>
              <h2 style={{ margin: '8px 0 12px', fontSize: 26 }}>Fix these first</h2>
              {weakTopics.length ? (
                weakTopics.map((topic) => <TopicRow key={topic.id} topic={topic} action="Revise Now" />)
              ) : (
                <p style={{ color: '#9a9abe', lineHeight: 1.7 }}>No weak topics tracked yet. Use Exam Prep and say “bujhini” when something does not land.</p>
              )}
            </SectionCard>

            <SectionCard>
              <div style={{ color: '#fb7185', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' }}>Skipped topics</div>
              <h2 style={{ margin: '8px 0 12px', fontSize: 26 }}>Do not leave these untouched</h2>
              <p style={{ color: '#fda4af', lineHeight: 1.6, fontSize: 13 }}>
                If your exam is within 48 hours, cover skipped topics before starting new chapters.
              </p>
              {skippedTopics.length ? (
                skippedTopics.map((topic) => <TopicRow key={topic.id} topic={topic} action="Cover Now" />)
              ) : (
                <p style={{ color: '#9a9abe', lineHeight: 1.7 }}>No skipped topics yet. Good. Keep it that way.</p>
              )}
            </SectionCard>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 18 }}>
            <SectionCard>
              <div style={{ color: '#9A6CFF', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' }}>Subject breakdown</div>
              <h2 style={{ margin: '8px 0 18px', fontSize: 26 }}>Confidence by subject</h2>
              <div style={{ display: 'grid', gap: 18 }}>
                {profile.bySubject.length ? (
                  profile.bySubject.map((subject) => (
                    <SubjectBreakdown key={subject.subject} {...subject} />
                  ))
                ) : (
                  <p style={{ color: '#9a9abe', lineHeight: 1.7 }}>Start an exam-prep session to generate your subject breakdown.</p>
                )}
              </div>
            </SectionCard>

            <SectionCard>
              <div style={{ color: '#9A6CFF', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' }}>Performance trend</div>
              <h2 style={{ margin: '8px 0 18px', fontSize: 26 }}>Confidence over time</h2>
              <PerformanceTrendChart data={profile.trend} />
            </SectionCard>
          </div>

          <SectionCard>
            <div style={{ color: '#9A6CFF', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' }}>Recent sessions</div>
            <h2 style={{ margin: '8px 0 14px', fontSize: 26 }}>Last 5 exam-prep sessions</h2>
            <div style={{ display: 'grid', gap: 10 }}>
              {recentSessions.length ? (
                recentSessions.map((session) => (
                  <div
                    key={session.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      gap: 12,
                      padding: '14px 0',
                      borderBottom: '1px solid rgba(255,255,255,0.07)',
                    }}
                  >
                    <div>
                      <div style={{ color: '#fff', fontWeight: 800 }}>
                        {session.subject} | {session.topic}
                      </div>
                      <div style={{ color: '#9a9abe', fontSize: 13, marginTop: 4 }}>
                        {dateLabel(session.started_at)} | {session.session_duration_minutes} min
                      </div>
                    </div>
                    <div style={{ color: '#d8b4fe', fontSize: 13 }}>
                      {session.topics_covered} covered
                    </div>
                  </div>
                ))
              ) : (
                <p style={{ color: '#9a9abe', lineHeight: 1.7 }}>No exam-prep sessions yet. Start one from Exam Prep and this list will populate.</p>
              )}
            </div>
          </SectionCard>
        </div>
      </main>
    </AuthGuard>
  )
}
