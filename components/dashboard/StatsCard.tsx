'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'

type StatsCardProps = {
  title: string
  value: string | number
  subtitle: string
  trend?: 'up' | 'down' | 'stable'
  trendValue?: string
  icon: ReactNode
  color: 'blue' | 'green' | 'red' | 'orange' | 'purple'
}

const colorMap = {
  blue: { bg: 'rgba(59,130,246,0.16)', border: 'rgba(96,165,250,0.3)', text: '#93c5fd' },
  green: { bg: 'rgba(34,197,94,0.16)', border: 'rgba(74,222,128,0.3)', text: '#86efac' },
  red: { bg: 'rgba(244,63,94,0.16)', border: 'rgba(251,113,133,0.32)', text: '#fda4af' },
  orange: { bg: 'rgba(249,115,22,0.16)', border: 'rgba(251,146,60,0.32)', text: '#fdba74' },
  purple: { bg: 'rgba(168,85,247,0.16)', border: 'rgba(192,132,252,0.32)', text: '#d8b4fe' },
}

function parseNumber(value: string | number) {
  if (typeof value === 'number') {
    return value
  }
  const parsed = Number(value.replace(/[^\d.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

export default function StatsCard({
  title,
  value,
  subtitle,
  trend = 'stable',
  trendValue,
  icon,
  color,
}: StatsCardProps) {
  const [displayValue, setDisplayValue] = useState(value)
  const accent = colorMap[color]
  const numeric = parseNumber(value)

  useEffect(() => {
    if (numeric === null) {
      setDisplayValue(value)
      return
    }

    const start = performance.now()
    const duration = 650
    let frame = 0
    const tick = (time: number) => {
      const progress = Math.min(1, (time - start) / duration)
      const next = Math.round(numeric * progress)
      setDisplayValue(typeof value === 'string' && value.includes('%') ? `${next}%` : next)
      if (progress < 1) {
        frame = requestAnimationFrame(tick)
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [numeric, value])

  const TrendIcon = trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : ArrowRight
  const trendColor = trend === 'up' ? '#86efac' : trend === 'down' ? '#fda4af' : '#c4b5fd'

  return (
    <article
      style={{
        border: `1px solid ${accent.border}`,
        background: `linear-gradient(145deg, ${accent.bg}, rgba(255,255,255,0.035))`,
        borderRadius: 24,
        padding: 18,
        minHeight: 142,
        display: 'grid',
        gap: 12,
        boxShadow: '0 18px 46px rgba(0,0,0,0.18)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <span style={{ color: accent.text, fontSize: 13, fontWeight: 900, letterSpacing: 1.5, textTransform: 'uppercase' }}>
          {title}
        </span>
        <span style={{ color: accent.text }}>{icon}</span>
      </div>
      <strong style={{ color: '#fff', fontSize: 36, lineHeight: 1 }}>{displayValue}</strong>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <p style={{ margin: 0, color: '#c7c3e8', fontSize: 13, lineHeight: 1.5 }}>{subtitle}</p>
        {trendValue ? (
          <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', color: trendColor, fontWeight: 900, fontSize: 12 }}>
            <TrendIcon size={16} />
            {trendValue}
          </span>
        ) : null}
      </div>
    </article>
  )
}

export type { StatsCardProps }
