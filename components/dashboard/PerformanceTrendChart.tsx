'use client'

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export type PerformanceTrendPoint = {
  date: string
  confidence: number
}

export default function PerformanceTrendChart({ data }: { data: PerformanceTrendPoint[] }) {
  const chartData = data.length
    ? data
    : [
        { date: 'Start', confidence: 0 },
        { date: 'Now', confidence: 0 },
      ]

  return (
    <div style={{ width: '100%', height: 260 }}>
      <ResponsiveContainer>
        <LineChart data={chartData} margin={{ top: 12, right: 18, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
          <XAxis dataKey="date" stroke="#8f8fb5" tick={{ fontSize: 11 }} />
          <YAxis domain={[0, 100]} stroke="#8f8fb5" tick={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              background: 'rgba(12,10,28,0.96)',
              border: '1px solid rgba(170,85,255,0.22)',
              borderRadius: 14,
              color: '#fff',
            }}
          />
          <Line
            type="monotone"
            dataKey="confidence"
            stroke="#a855f7"
            strokeWidth={3}
            dot={{ r: 4, fill: '#6be4ff', stroke: '#a855f7', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
