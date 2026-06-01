import type { CSSProperties, ReactNode } from 'react'
import Badge from '@/components/Badge'

export default function FeatureCard({
  badge,
  children,
  title,
}: {
  badge?: string
  children: ReactNode
  title: string
}) {
  return (
    <article style={styles.card}>
      {badge ? <Badge tone="violet">{badge}</Badge> : null}
      <h3 style={styles.title}>{title}</h3>
      <div style={styles.body}>{children}</div>
    </article>
  )
}

const styles = {
  card: {
    background: 'linear-gradient(145deg, rgba(18,16,37,0.92), rgba(16,11,36,0.76))',
    border: '1px solid rgba(170,85,255,0.16)',
    borderRadius: 24,
    boxShadow: '0 24px 80px rgba(0,0,0,0.28)',
    display: 'grid',
    gap: 14,
    padding: 20,
  } satisfies CSSProperties,
  title: {
    color: '#f4eeff',
    fontSize: 22,
    lineHeight: 1.08,
    margin: 0,
  } satisfies CSSProperties,
  body: {
    color: '#aaa6ca',
    fontSize: 14,
    lineHeight: 1.65,
  } satisfies CSSProperties,
}
