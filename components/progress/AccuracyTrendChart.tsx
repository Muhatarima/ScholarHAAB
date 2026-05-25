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

type AccuracyTrendChartProps = {
  data: Array<{ date: string; accuracy: number; attempts?: number }>
}

export default function AccuracyTrendChart({ data }: AccuracyTrendChartProps) {
  const chartData = data.length
    ? data
    : Array.from({ length: 7 }, (_, index) => ({
        date: `Day ${index + 1}`,
        accuracy: 0,
        attempts: 0,
      }))

  return (
    <div style={{ width: '100%', height: 260 }}>
      <ResponsiveContainer>
        <LineChart data={chartData} margin={{ left: -20, right: 12, top: 10, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis dataKey="date" stroke="#8b8bb0" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis domain={[0, 100]} stroke="#8b8bb0" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              background: '#121225',
              border: '1px solid rgba(170,85,255,0.2)',
              borderRadius: '12px',
              color: '#f4eeff',
            }}
          />
          <Line
            type="monotone"
            dataKey="accuracy"
            stroke="#6be4ff"
            strokeWidth={3}
            dot={{ fill: '#facc15', strokeWidth: 0, r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
