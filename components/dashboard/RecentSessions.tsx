'use client'

import { formatDistanceToNowStrict } from 'date-fns'

export type StudySession = {
  id: string
  subject: string | null
  topic: string | null
  questionsAttempted: number
  questionsCorrect: number
  aiNotes: string | null
  durationMinutes?: number | null
  startedAt?: string | null
}

export default function RecentSessions({ sessions }: { sessions: StudySession[] }) {
  if (!sessions.length) {
    return (
      <section>
        <h3 style={{ color: '#fff', marginTop: 0 }}>Recent Sessions</h3>
        <p style={{ color: '#c7c3e8', lineHeight: 1.6 }}>No sessions yet. Start a QBank practice session and your learning trail will appear here.</p>
      </section>
    )
  }

  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <h3 style={{ color: '#fff', margin: 0 }}>Recent Sessions</h3>
      {sessions.slice(0, 5).map((session) => {
        const accuracy = session.questionsAttempted
          ? Math.round((session.questionsCorrect / session.questionsAttempted) * 100)
          : 0
        const status = accuracy >= 70 ? 'Improved' : accuracy > 0 ? 'Struggled' : 'New topic'
        const timeAgo = session.startedAt
          ? formatDistanceToNowStrict(new Date(session.startedAt), { addSuffix: true })
          : 'recently'
        return (
          <article key={session.id} style={{ borderRadius: 18, padding: 14, background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <strong style={{ color: '#fff' }}>{session.subject ?? 'General'} · {session.topic ?? 'Mixed practice'}</strong>
              <p style={{ color: '#c7c3e8', margin: '6px 0 0' }}>
                {session.questionsCorrect}/{session.questionsAttempted} ({accuracy}%) · {status} · {timeAgo}
              </p>
            </div>
            <button type="button" style={{ border: '1px solid rgba(192,132,252,0.3)', background: 'transparent', color: '#d8b4fe', borderRadius: 999, padding: '9px 12px', cursor: 'pointer', fontWeight: 900 }}>
              Continue
            </button>
          </article>
        )
      })}
    </section>
  )
}
