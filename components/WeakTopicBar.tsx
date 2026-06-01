import type { CSSProperties } from 'react'
import Badge from '@/components/Badge'

export default function WeakTopicBar({
  chance = false,
  progress,
  subject,
  topic,
}: {
  chance?: boolean
  progress: number
  subject: string
  topic: string
}) {
  const safeProgress = Math.max(0, Math.min(100, progress))

  return (
    <div style={styles.row}>
      <div style={styles.header}>
        <span style={styles.subject}>{subject}</span>
        {chance ? <Badge tone="amber">High exam chance</Badge> : null}
      </div>
      <div style={styles.topic}>{topic}</div>
      <div style={styles.track}>
        <span style={{ ...styles.fill, width: `${safeProgress}%` }} />
      </div>
    </div>
  )
}

const styles = {
  row: {
    display: 'grid',
    gap: 9,
    padding: '13px 0',
  } satisfies CSSProperties,
  header: {
    alignItems: 'center',
    display: 'flex',
    gap: 10,
    justifyContent: 'space-between',
  } satisfies CSSProperties,
  subject: {
    color: '#c084fc',
    fontSize: 12,
    fontWeight: 800,
  } satisfies CSSProperties,
  topic: {
    color: '#f4eeff',
    fontSize: 15,
    fontWeight: 700,
  } satisfies CSSProperties,
  track: {
    background: 'rgba(255,255,255,0.06)',
    borderRadius: 999,
    height: 7,
    overflow: 'hidden',
  } satisfies CSSProperties,
  fill: {
    background: 'linear-gradient(90deg,#7c3aed,#c084fc)',
    borderRadius: 999,
    display: 'block',
    height: '100%',
  } satisfies CSSProperties,
}
