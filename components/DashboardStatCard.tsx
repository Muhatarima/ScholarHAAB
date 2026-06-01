import type { CSSProperties } from 'react'

export default function DashboardStatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={styles.card}>
      <div style={styles.value}>{value}</div>
      <div style={styles.label}>{label}</div>
    </div>
  )
}

const styles = {
  card: {
    background: 'rgba(255,255,255,0.045)',
    border: '1px solid rgba(170,85,255,0.08)',
    borderRadius: 22,
    minHeight: 116,
    padding: 18,
  } satisfies CSSProperties,
  value: {
    color: '#f4eeff',
    fontSize: 'clamp(30px, 5vw, 46px)',
    fontWeight: 700,
    letterSpacing: '-0.05em',
  } satisfies CSSProperties,
  label: {
    color: '#9f9fc4',
    fontSize: 13,
    marginTop: 4,
  } satisfies CSSProperties,
}
