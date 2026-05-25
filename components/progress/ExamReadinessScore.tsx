'use client'

type ExamReadinessScoreProps = {
  score: number
  label?: string
}

export default function ExamReadinessScore({ score, label = 'Exam readiness' }: ExamReadinessScoreProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)))
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (clamped / 100) * circumference

  return (
    <div style={{ display: 'grid', justifyItems: 'center', gap: '10px' }}>
      <svg width="150" height="150" viewBox="0 0 150 150" role="img" aria-label={`${label}: ${clamped}%`}>
        <circle cx="75" cy="75" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="14" />
        <circle
          cx="75"
          cy="75"
          r={radius}
          fill="none"
          stroke={clamped >= 80 ? '#4ade80' : clamped >= 55 ? '#facc15' : '#fb7185'}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 75 75)"
          style={{ transition: 'stroke-dashoffset 700ms ease' }}
        />
        <text x="75" y="71" textAnchor="middle" fill="#f4eeff" fontSize="30" fontWeight="800">
          {clamped}
        </text>
        <text x="75" y="94" textAnchor="middle" fill="#a7a7cb" fontSize="12">
          /100
        </text>
      </svg>
      <div style={{ color: '#f4eeff', fontWeight: 900 }}>{label}</div>
    </div>
  )
}
