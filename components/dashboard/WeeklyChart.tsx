'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export type WeeklyChartPoint = {
  date: string
  count: number
  accuracy: number
}

export default function WeeklyChart({ data, goal = 20 }: { data: WeeklyChartPoint[]; goal?: number }) {
  const normalized = data.length
    ? data
    : Array.from({ length: 7 }, (_, index) => ({
        date: `Day ${index + 1}`,
        count: 0,
        accuracy: 0,
      }))

  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <BarChart data={normalized} margin={{ top: 18, right: 18, left: 0, bottom: 6 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: '#c7c3e8', fontSize: 12 }} tickLine={false} axisLine={false} />
          <YAxis yAxisId="left" tick={{ fill: '#c7c3e8', fontSize: 12 }} tickLine={false} axisLine={false} />
          <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fill: '#c7c3e8', fontSize: 12 }} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.06)' }}
            contentStyle={{
              background: '#111029',
              border: '1px solid rgba(192,132,252,0.28)',
              borderRadius: 14,
              color: '#fff',
            }}
          />
          <ReferenceLine yAxisId="left" y={goal} stroke="#facc15" strokeDasharray="4 4" label={{ value: 'goal', fill: '#facc15', fontSize: 12 }} />
          <Bar
            yAxisId="left"
            dataKey="count"
            name="Questions"
            radius={[10, 10, 4, 4]}
            fill="#60a5fa"
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="accuracy"
            name="Accuracy %"
            stroke="#86efac"
            strokeWidth={3}
            dot={{ r: 4, fill: '#86efac' }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
