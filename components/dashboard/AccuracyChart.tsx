'use client'

import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export type AccuracyChartPoint = {
  date: string
  accuracy: number
  subject: string
}

const palette = ['#60a5fa', '#86efac', '#f472b6', '#facc15', '#c084fc', '#fb7185']

export default function AccuracyChart({ data }: { data: AccuracyChartPoint[] }) {
  const subjects = useMemo(() => Array.from(new Set(data.map((item) => item.subject || 'Overall'))), [data])
  const [active, setActive] = useState(() => new Set(subjects))
  const chartData = useMemo(() => {
    const byDate = new Map<string, Record<string, string | number>>()
    for (const item of data) {
      const row = byDate.get(item.date) ?? { date: item.date }
      row[item.subject || 'Overall'] = item.accuracy
      byDate.set(item.date, row)
    }
    return Array.from(byDate.values())
  }, [data])

  const toggle = (subject: string) => {
    setActive((current) => {
      const next = new Set(current)
      if (next.has(subject)) {
        next.delete(subject)
      } else {
        next.add(subject)
      }
      return next
    })
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {subjects.map((subject, index) => (
          <button
            key={subject}
            type="button"
            onClick={() => toggle(subject)}
            style={{
              border: `1px solid ${palette[index % palette.length]}`,
              borderRadius: 999,
              background: active.has(subject) ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: '#fff',
              padding: '7px 11px',
              cursor: 'pointer',
              fontWeight: 800,
            }}
          >
            {subject}
          </button>
        ))}
      </div>
      <div style={{ width: '100%', height: 315 }}>
        <ResponsiveContainer>
          <LineChart data={chartData} margin={{ top: 18, right: 18, left: 0, bottom: 6 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: '#c7c3e8', fontSize: 12 }} tickLine={false} axisLine={false} />
            <YAxis domain={[0, 100]} tick={{ fill: '#c7c3e8', fontSize: 12 }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{
                background: '#111029',
                border: '1px solid rgba(192,132,252,0.28)',
                borderRadius: 14,
                color: '#fff',
              }}
            />
            <ReferenceLine y={70} stroke="#facc15" strokeDasharray="4 4" label={{ value: '70% pass', fill: '#facc15', fontSize: 12 }} />
            {subjects.map((subject, index) =>
              active.has(subject) ? (
                <Line
                  key={subject}
                  type="monotone"
                  dataKey={subject}
                  stroke={palette[index % palette.length]}
                  strokeWidth={3}
                  connectNulls
                  dot={false}
                />
              ) : null
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
