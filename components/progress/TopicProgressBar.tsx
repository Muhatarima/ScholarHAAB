'use client'

type TopicProgressBarProps = {
  topic: string
  mastery: number
}

function colorFor(mastery: number) {
  if (mastery < 50) {
    return '#fb7185'
  }
  if (mastery < 80) {
    return '#facc15'
  }
  return '#4ade80'
}

export default function TopicProgressBar({ topic, mastery }: TopicProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(mastery)))
  const color = colorFor(clamped)

  return (
    <div style={{ display: 'grid', gap: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '13px' }}>
        <span style={{ color: '#f4eeff', fontWeight: 800 }}>{topic}</span>
        <span style={{ color, fontWeight: 900 }}>{clamped}%</span>
      </div>
      <div
        aria-label={`${topic} mastery ${clamped}%`}
        style={{
          height: '10px',
          borderRadius: '999px',
          background: 'rgba(255,255,255,0.08)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${clamped}%`,
            height: '100%',
            borderRadius: '999px',
            background: `linear-gradient(90deg, ${color}, #c084fc)`,
            transition: 'width 700ms ease',
          }}
        />
      </div>
    </div>
  )
}
