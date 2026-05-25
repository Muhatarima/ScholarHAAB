'use client'

export type ExamDate = {
  subject: string
  date: string
  paper: string
}

function daysUntil(date: string) {
  return Math.ceil((new Date(date).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
}

function colorForDays(days: number) {
  if (days < 7) {
    return '#fb7185'
  }
  if (days < 14) {
    return '#facc15'
  }
  return '#86efac'
}

export default function ExamCountdown({ examDates }: { examDates: ExamDate[] }) {
  const sorted = [...examDates]
    .map((exam) => ({ ...exam, days: daysUntil(exam.date) }))
    .sort((left, right) => left.days - right.days)

  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <h3 style={{ margin: 0, color: '#fff' }}>Exam Countdown</h3>
        <button type="button" style={{ border: '1px solid rgba(255,255,255,0.16)', background: 'transparent', color: '#fff', borderRadius: 999, padding: '8px 12px', cursor: 'pointer', fontWeight: 900 }}>
          Add Exam
        </button>
      </div>
      {sorted.length ? sorted.map((exam) => {
        const color = colorForDays(exam.days)
        const progress = Math.max(4, Math.min(100, 100 - (exam.days / 120) * 100))
        return (
          <article key={`${exam.subject}-${exam.paper}-${exam.date}`} style={{ borderRadius: 18, padding: 14, background: 'rgba(255,255,255,0.045)', border: `1px solid ${color}44`, display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <strong style={{ color: '#fff' }}>{exam.subject} · {exam.paper}</strong>
              <strong style={{ color, fontSize: 22 }}>{exam.days}d</strong>
            </div>
            <div style={{ height: 9, borderRadius: 999, overflow: 'hidden', background: 'rgba(255,255,255,0.08)' }}>
              <div style={{ width: `${progress}%`, background: color, height: '100%' }} />
            </div>
          </article>
        )
      }) : (
        <p style={{ color: '#c7c3e8', lineHeight: 1.6 }}>No exam dates yet. Add one to unlock countdown-based planning.</p>
      )}
    </section>
  )
}
