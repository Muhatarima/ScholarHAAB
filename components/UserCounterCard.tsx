'use client'

import { useEffect, useState } from 'react'

const GOAL = 100_000

export default function UserCounterCard() {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/stats/users')
      .then((r) => r.json())
      .then((d) => { if (typeof d.count === 'number') setCount(d.count) })
      .catch(() => {})
  }, [])

  const n = count ?? 0
  const pct = Math.min((n / GOAL) * 100, 100)

  return (
    <section style={styles.card} aria-label="Students joined ScholarHAAB">
      <div>
        <p style={styles.label}>Students joined ScholarHAA</p>
        <div style={styles.count}>{n.toLocaleString()}</div>
      </div>
      <div style={styles.progressTrack} aria-hidden="true">
        <div style={{ ...styles.progressFill, width: `${pct}%` }} />
      </div>
    </section>
  )
}

const styles = {
  card: {
    background: 'linear-gradient(145deg, rgba(20,16,40,.95), rgba(8,8,25,.9))',
    border: '1px solid rgba(170,85,255,.2)',
    borderRadius: 8,
    boxShadow: '0 20px 80px rgba(120,60,255,.16)',
    display: 'grid',
    gap: 24,
    padding: '34px',
  },
  copy: {
    color: '#bdb7da',
    fontSize: 17,
    lineHeight: 1.55,
    margin: '10px 0 0',
  },
  count: {
    background: 'linear-gradient(112deg,#fff,#f2e8ff,#c78bff,#8f3dff)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    fontSize: 'clamp(56px,9vw,108px)',
    fontWeight: 900,
    lineHeight: 1,
  },
  label: {
    color: '#c994ff',
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 2.4,
    margin: '0 0 12px',
    textTransform: 'uppercase' as const,
  },
  progressFill: {
    background: 'linear-gradient(90deg,#7733cc,#aa55ff,#d4a0ff)',
    borderRadius: 999,
    height: '100%',
    transition: 'width 1s ease',
  },
  progressTrack: {
    background: 'rgba(255,255,255,.07)',
    borderRadius: 999,
    height: 10,
    overflow: 'hidden',
  },
} as const
