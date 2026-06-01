import type { CSSProperties, ReactNode } from 'react'

export default function ExamNightCard({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section style={styles.card}>
      <h3 style={styles.title}>{title}</h3>
      <div style={styles.body}>{children}</div>
    </section>
  )
}

const styles = {
  card: {
    background: 'linear-gradient(145deg, rgba(18,16,37,0.94), rgba(16,11,36,0.78))',
    border: '1px solid rgba(170,85,255,0.16)',
    borderRadius: 24,
    minHeight: 180,
    padding: 20,
  } satisfies CSSProperties,
  title: {
    color: '#f4eeff',
    fontSize: 20,
    margin: '0 0 12px',
  } satisfies CSSProperties,
  body: {
    color: '#aaa6ca',
    fontSize: 14,
    lineHeight: 1.65,
  } satisfies CSSProperties,
}
