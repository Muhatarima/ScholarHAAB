'use client'

export type DashboardWeakPoint = {
  topic: string
  subject?: string
  accuracy: number
  attempts: number
  mistakePattern: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM'
  recommendedAction?: string
  recommended_action?: string
}

export type DashboardPrediction = {
  topic: string
  probability: number
  recommendation?: string
}

export default function WeakPointsPanel({
  weakPoints,
  predictions,
}: {
  weakPoints: DashboardWeakPoint[]
  predictions: DashboardPrediction[]
}) {
  const top = weakPoints.slice(0, 3)
  const predictionMap = new Map(predictions.map((prediction) => [prediction.topic.toLowerCase(), prediction]))

  if (!top.length) {
    return (
      <section style={{ borderRadius: 24, padding: 20, background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <h3 style={{ margin: 0, color: '#fff' }}>Needs Attention</h3>
        <p style={{ color: '#c7c3e8', lineHeight: 1.6 }}>No weak points yet. Attempt a few questions and ScholarHAAB will detect patterns.</p>
      </section>
    )
  }

  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <h3 style={{ margin: 0, color: '#fff' }}>Needs Attention</h3>
      {top.map((point) => {
        const prediction = predictionMap.get(point.topic.toLowerCase())
        const highExamChance = prediction && prediction.probability >= 70
        return (
          <article
            key={`${point.subject ?? 'subject'}-${point.topic}`}
            style={{ borderRadius: 20, padding: 14, background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(251,113,133,0.18)', display: 'grid', gap: 10 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <strong style={{ color: '#fff' }}>{point.topic}</strong>
                <p style={{ color: '#c7c3e8', margin: '4px 0 0', fontSize: 13 }}>{point.mistakePattern}</p>
              </div>
              <span style={{ color: point.severity === 'CRITICAL' ? '#fecdd3' : '#fef3c7', fontWeight: 900 }}>{point.severity}</span>
            </div>
            <div style={{ height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${Math.max(4, point.accuracy)}%`, height: '100%', background: '#fb7185' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ color: '#c7c3e8', fontSize: 13 }}>{point.accuracy}% accuracy · {point.attempts} attempts</span>
              {highExamChance ? <span style={{ color: '#fef3c7', fontWeight: 900, fontSize: 12 }}>HIGH EXAM CHANCE</span> : null}
              <button type="button" style={{ border: 0, borderRadius: 999, background: '#7c3aed', color: '#fff', padding: '9px 12px', cursor: 'pointer', fontWeight: 900 }}>
                Practice Now
              </button>
            </div>
          </article>
        )
      })}
    </section>
  )
}
