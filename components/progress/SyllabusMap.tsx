'use client'

import Link from 'next/link'

type SyllabusTile = {
  topic: string
  mastery: number
  status: 'mastered' | 'learning' | 'weak' | 'not_attempted'
}

type SyllabusMapProps = {
  subject: string
  topics: SyllabusTile[]
}

const COLORS: Record<SyllabusTile['status'], { bg: string; border: string; text: string }> = {
  mastered: { bg: 'rgba(34,197,94,0.16)', border: 'rgba(74,222,128,0.28)', text: '#bbf7d0' },
  learning: { bg: 'rgba(250,204,21,0.14)', border: 'rgba(250,204,21,0.28)', text: '#fef3c7' },
  weak: { bg: 'rgba(248,113,113,0.16)', border: 'rgba(248,113,113,0.3)', text: '#fecaca' },
  not_attempted: { bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.18)', text: '#cbd5e1' },
}

export default function SyllabusMap({ subject, topics }: SyllabusMapProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
      {topics.map((topic) => {
        const colors = COLORS[topic.status]
        return (
          <Link
            key={topic.topic}
            href={`/qbank?prompt=${encodeURIComponent(`Practice ${subject} ${topic.topic}`)}`}
            title={`${topic.topic}: ${topic.mastery}% mastery`}
            style={{
              borderRadius: '16px',
              border: `1px solid ${colors.border}`,
              background: colors.bg,
              color: colors.text,
              textDecoration: 'none',
              padding: '12px',
              minHeight: '86px',
              display: 'grid',
              alignContent: 'space-between',
              gap: '10px',
            }}
          >
            <strong style={{ fontSize: '13px', lineHeight: 1.35 }}>{topic.topic}</strong>
            <span style={{ fontSize: '12px', color: colors.text }}>
              {topic.status.replace('_', ' ')} · {Math.round(topic.mastery)}%
            </span>
          </Link>
        )
      })}
    </div>
  )
}
