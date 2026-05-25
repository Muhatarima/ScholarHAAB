'use client'

import Link from 'next/link'

type SubjectProgressCardProps = {
  subject: string
  mastery: number
  strongCount: number
  weakCount: number
  lastStudied?: string | null
}

const SUBJECT_ICONS: Record<string, string> = {
  physics: '⚡',
  mathematics: '∫',
  maths: '∫',
  chemistry: '⚗',
  biology: '🌱',
  economics: '📈',
}

function iconFor(subject: string) {
  return SUBJECT_ICONS[subject.toLowerCase()] ?? '📘'
}

export default function SubjectProgressCard({
  subject,
  mastery,
  strongCount,
  weakCount,
  lastStudied,
}: SubjectProgressCardProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(mastery)))

  return (
    <Link
      href={`/qbank?prompt=${encodeURIComponent(`Practice ${subject}`)}`}
      style={{ color: 'inherit', textDecoration: 'none' }}
    >
      <article
        style={{
          borderRadius: '22px',
          border: '1px solid rgba(107,228,255,0.16)',
          background: 'linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.025))',
          padding: '18px',
          display: 'grid',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
          <div>
            <div style={{ color: '#6be4ff', fontSize: '28px' }}>{iconFor(subject)}</div>
            <h3 style={{ margin: '6px 0 0', fontSize: '20px' }}>{subject}</h3>
          </div>
          <strong style={{ color: clamped >= 80 ? '#4ade80' : clamped >= 50 ? '#facc15' : '#fb7185', fontSize: '32px' }}>
            {clamped}%
          </strong>
        </div>

        <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '999px', overflow: 'hidden' }}>
          <div style={{ width: `${clamped}%`, height: '100%', background: 'linear-gradient(90deg,#6be4ff,#a855f7)' }} />
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', color: '#b8b8d8', fontSize: '12px' }}>
          <span>{strongCount} strong</span>
          <span>{weakCount} weak</span>
          <span>{lastStudied ? `Last: ${lastStudied}` : 'No recent study'}</span>
        </div>
      </article>
    </Link>
  )
}
