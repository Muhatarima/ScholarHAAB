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
    <div style={{
      border: '1px solid rgba(170,85,255,0.16)',
      borderRadius: 28,
      background: 'linear-gradient(145deg, rgba(18,16,37,0.88), rgba(10,8,28,0.65))',
      padding: 'clamp(20px, 3vw, 32px)',
      display: 'grid',
      gap: 16,
      marginTop: 10,
    }}>

      {/* Count + label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        {/* Mini black hole */}
        <svg width="48" height="48" viewBox="0 0 320 320" aria-hidden="true" style={{ flexShrink: 0 }}>
          <defs>
            <radialGradient id="bhC" cx="42%" cy="42%" r="58%">
              <stop offset="0%" stopColor="#e6c8ff" stopOpacity="0.96" />
              <stop offset="18%" stopColor="#aa55ff" stopOpacity="0.9" />
              <stop offset="39%" stopColor="#411274" stopOpacity="0.88" />
              <stop offset="66%" stopColor="#00000d" stopOpacity="0.98" />
            </radialGradient>
          </defs>
          <ellipse cx="160" cy="160" rx="130" ry="36" fill="none"
            stroke="rgba(170,85,255,0.5)" strokeWidth="2.5"
            style={{ animation: 'bhCw 12s linear infinite', transformOrigin: '160px 160px' }} />
          <ellipse cx="160" cy="160" rx="108" ry="26" fill="none"
            stroke="rgba(120,50,200,0.55)" strokeWidth="1.5"
            style={{ animation: 'bhCcw 17s linear infinite', transformOrigin: '160px 160px' }} />
          <circle cx="160" cy="160" r="82" fill="url(#bhC)"
            style={{ animation: 'bhP 4s ease-in-out infinite' }} />
          <style>{`
            @keyframes bhCw  { to { transform: rotateX(72deg) rotate(360deg);  } }
            @keyframes bhCcw { to { transform: rotateX(72deg) rotate(-360deg); } }
            @keyframes bhP   { 0%,100%{opacity:.85} 50%{opacity:1} }
          `}</style>
        </svg>

        <div>
          <div style={{
            background: 'linear-gradient(112deg,#fff,#c78bff)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontSize: 'clamp(28px, 5vw, 44px)',
            fontWeight: 700,
            letterSpacing: '-0.04em',
            lineHeight: 1,
          }}>
            {count === null ? '—' : n.toLocaleString('en-BD')}
          </div>
          <div style={{ color: '#9F9FC4', fontSize: 13, marginTop: 4 }}>
            joined ScholarHAAB
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 8,
        borderRadius: 999,
        background: 'rgba(255,255,255,0.06)',
        overflow: 'hidden',
        position: 'relative',
      }}>
        <div style={{
          height: '100%',
          borderRadius: 999,
          background: 'linear-gradient(90deg,#7733cc,#aa55ff,#d4a0ff)',
          width: `${pct}%`,
          boxShadow: '0 0 14px rgba(170,85,255,0.55)',
          transition: 'width 1.4s cubic-bezier(0.4,0,0.2,1)',
        }} />
      </div>

    </div>
  )
}
