'use client'

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export type PerformanceTrendPoint = {
  date: string
  questionsAsked: number
  topicsCovered: number
}

export default function PerformanceTrendChart({ data }: { data: PerformanceTrendPoint[] }) {
  const chartData = data.length
    ? data
      : [
        { date: 'Mon', questionsAsked: 0, topicsCovered: 0 },
        { date: 'Tue', questionsAsked: 0, topicsCovered: 0 },
        { date: 'Wed', questionsAsked: 0, topicsCovered: 0 },
        { date: 'Thu', questionsAsked: 0, topicsCovered: 0 },
        { date: 'Fri', questionsAsked: 0, topicsCovered: 0 },
        { date: 'Sat', questionsAsked: 0, topicsCovered: 0 },
        { date: 'Sun', questionsAsked: 0, topicsCovered: 0 },
      ]
  const isEmpty = chartData.every((point) => point.questionsAsked === 0 && point.topicsCovered === 0)

  return (
    <div style={{ position: 'relative', width: '100%', height: 260 }}>
      {isEmpty ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            display: 'grid',
            placeItems: 'center',
            color: '#8f8fb5',
            fontSize: 14,
            pointerEvents: 'none',
          }}
        >
          Start studying to see your progress
        </div>
      ) : null}
      <ResponsiveContainer>
        <LineChart data={chartData} margin={{ top: 12, right: 18, left: -20, bottom: 0 }}>
          <XAxis dataKey="date" stroke="#8f8fb5" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} stroke="#8f8fb5" tick={{ fontSize: 11 }} />
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
            dataKey="questionsAsked"
            name="Questions asked"
            stroke="#a855f7"
            strokeWidth={3}
            dot={{ r: 4, fill: '#6be4ff', stroke: '#a855f7', strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="topicsCovered"
            name="Topics covered"
            stroke="#6be4ff"
            strokeWidth={2}
            dot={{ r: 3, fill: '#00000d', stroke: '#6be4ff', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
