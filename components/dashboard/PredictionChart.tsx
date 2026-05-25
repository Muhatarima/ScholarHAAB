'use client'

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { DashboardPrediction } from '@/components/dashboard/WeakPointsPanel'
import type { DashboardWeakPoint } from '@/components/dashboard/WeakPointsPanel'

type PredictionChartProps = {
  predictions: DashboardPrediction[]
  studentWeakPoints: DashboardWeakPoint[]
  subject: string
}

export default function PredictionChart({ predictions, studentWeakPoints, subject }: PredictionChartProps) {
  const weakSet = new Set(studentWeakPoints.map((point) => point.topic.toLowerCase()))
  const data = predictions.slice(0, 10).map((prediction) => ({
    topic: prediction.topic,
    probability: prediction.probability,
    fill: weakSet.has(prediction.topic.toLowerCase())
      ? '#fb7185'
      : prediction.probability >= 70
        ? '#f97316'
        : '#60a5fa',
    recommendation: prediction.recommendation ?? 'Review',
  }))

  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <div>
        <h3 style={{ color: '#fff', margin: 0 }}>{subject} 10-Year Prediction</h3>
        <p style={{ color: '#c7c3e8', margin: '6px 0 0' }}>Red bars are high-probability topics that overlap with weak points.</p>
      </div>
      <div style={{ width: '100%', height: 340 }}>
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ top: 10, right: 24, left: 24, bottom: 10 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tick={{ fill: '#c7c3e8', fontSize: 12 }} tickLine={false} axisLine={false} />
            <YAxis dataKey="topic" type="category" width={120} tick={{ fill: '#c7c3e8', fontSize: 12 }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{
                background: '#111029',
                border: '1px solid rgba(192,132,252,0.28)',
                borderRadius: 14,
                color: '#fff',
              }}
            />
            <Bar dataKey="probability" name="Probability %" radius={[0, 10, 10, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

export type { PredictionChartProps }
