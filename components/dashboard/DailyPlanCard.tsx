'use client'

import { useState } from 'react'

export type DashboardDailyPlanItem = {
  topic: string
  subject: string
  duration_minutes: number
  type: 'drill' | 'revision' | 'mock'
  reason: string
  priority: 'high' | 'medium' | 'low'
}

const priorityColor = {
  high: '#fb7185',
  medium: '#facc15',
  low: '#86efac',
}

export default function DailyPlanCard({ plan }: { plan: DashboardDailyPlanItem[] }) {
  const [completed, setCompleted] = useState(() => new Set<string>())
  const progress = plan.length ? Math.round((completed.size / plan.length) * 100) : 0

  return (
    <section style={{ display: 'grid', gap: 14 }}>
      <div>
        <h3 style={{ margin: 0, color: '#fff' }}>Today&apos;s Recommended Plan</h3>
        <p style={{ margin: '6px 0 0', color: '#c7c3e8' }}>{progress}% complete</p>
      </div>
      <div style={{ height: 9, borderRadius: 999, overflow: 'hidden', background: 'rgba(255,255,255,0.08)' }}>
        <div style={{ width: `${progress}%`, height: '100%', background: '#a855f7' }} />
      </div>
      {plan.map((item) => (
        <article key={`${item.subject}-${item.topic}-${item.type}`} style={{ display: 'grid', gap: 8, borderRadius: 18, padding: 14, background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={completed.has(item.topic)}
              onChange={() =>
                setCompleted((current) => {
                  const next = new Set(current)
                  if (next.has(item.topic)) {
                    next.delete(item.topic)
                  } else {
                    next.add(item.topic)
                  }
                  return next
                })
              }
            />
            <span style={{ display: 'grid', gap: 4 }}>
              <strong style={{ color: '#fff' }}>
                <span style={{ color: priorityColor[item.priority] }}>●</span> {item.topic}
              </strong>
              <span style={{ color: '#c7c3e8', fontSize: 13 }}>{item.subject} · {item.duration_minutes} min · {item.type}</span>
              <span style={{ color: '#aaa4d8', fontSize: 13 }}>{item.reason}</span>
            </span>
          </label>
          <button type="button" style={{ justifySelf: 'start', border: 0, borderRadius: 999, background: '#7c3aed', color: '#fff', padding: '9px 12px', cursor: 'pointer', fontWeight: 900 }}>
            Start
          </button>
        </article>
      ))}
    </section>
  )
}
