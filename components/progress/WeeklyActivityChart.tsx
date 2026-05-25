'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type WeeklyActivityChartProps = {
  data: Array<{ day: string; questions: number; accuracy: number }>
  goal?: number
}

export default function WeeklyActivityChart({ data, goal = 20 }: WeeklyActivityChartProps) {
  const chartData = data.length
    ? data
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => ({
        day,
        questions: 0,
        accuracy: 0,
      }))

  return (
    <div style={{ width: '100%', height: 260 }}>
      <ResponsiveContainer>
        <BarChart data={chartData} margin={{ left: -20, right: 12, top: 10, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis dataKey="day" stroke="#8b8bb0" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis stroke="#8b8bb0" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              background: '#121225',
              border: '1px solid rgba(170,85,255,0.2)',
              borderRadius: '12px',
              color: '#f4eeff',
            }}
          />
          <ReferenceLine y={goal} stroke="#facc15" strokeDasharray="5 5" label={{ value: 'goal', fill: '#facc15', fontSize: 11 }} />
          <Bar dataKey="questions" fill="#6be4ff" radius={[8, 8, 3, 3]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
