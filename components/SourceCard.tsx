import type { CSSProperties } from 'react'
import VerifiedBadge from '@/components/VerifiedBadge'

export type SourceCardData = {
  board?: string
  level?: string
  subject?: string
  year?: number | string | null
  paper?: string | null
  question_number?: string | number | null
  marks?: number | null
  source_url?: string | null
  title?: string
}

export default function SourceCard({ source }: { source: SourceCardData }) {
  const meta = [
    source.board,
    source.level,
    source.subject,
    source.year,
    source.paper,
    source.question_number ? `Q${source.question_number}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <aside style={styles.card}>
      <VerifiedBadge label="Verified source" />
      <div>
        <div style={styles.title}>{source.title || meta || 'Cambridge/Edexcel source'}</div>
        <div style={styles.meta}>
          {meta || 'Retrieved from the verified past-paper database'}
          {source.marks ? ` · ${source.marks} marks` : ''}
        </div>
      </div>
    </aside>
  )
}

const styles = {
  card: {
    alignItems: 'center',
    background: 'rgba(34,197,94,0.07)',
    border: '1px solid rgba(74,222,128,0.18)',
    borderRadius: 18,
    display: 'flex',
    gap: 12,
    marginTop: 12,
    padding: 14,
  } satisfies CSSProperties,
  title: {
    color: '#ecfdf5',
    fontSize: 13,
    fontWeight: 800,
  } satisfies CSSProperties,
  meta: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 4,
  } satisfies CSSProperties,
}
