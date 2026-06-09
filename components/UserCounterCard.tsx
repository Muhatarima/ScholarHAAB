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
  <div
  style={{
    border: '1px solid rgba(170,85,255,.2)',
    borderRadius: 32,
    padding: '40px',
    marginTop: 30,
    background:
      'linear-gradient(145deg, rgba(20,16,40,.95), rgba(8,8,25,.9))',
    boxShadow: '0 20px 80px rgba(120,60,255,.25)',
  }}
>
  <div
    style={{
      color: '#AA66FF',
      fontSize: 12,
      letterSpacing: 3,
      textTransform: 'uppercase',
      marginBottom: 12,
    }}
  >
    GLOBAL COMMUNITY
  </div>

  <div
    style={{
      fontSize: 'clamp(60px,10vw,120px)',
      fontWeight: 800,
      lineHeight: 1,
      background:
        'linear-gradient(112deg,#fff,#f2e8ff,#c78bff,#8f3dff)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
    }}
  >
    {n.toLocaleString()}
  </div>

  <div
    style={{
      color: '#bdbddd',
      fontSize: 18,
      marginTop: 10,
    }}
  >
    students joined ScholarHAAB
  </div>

  <div
    style={{
      marginTop: 28,
      height: 12,
      borderRadius: 999,
      background: 'rgba(255,255,255,.06)',
      overflow: 'hidden',
    }}
  >
    <div
      style={{
        width: `${pct}%`,
        height: '100%',
        borderRadius: 999,
        background:
          'linear-gradient(90deg,#7733cc,#aa55ff,#d4a0ff)',
        transition: 'width 1s ease',
      }}
    />
  </div>
</div>
)
}
