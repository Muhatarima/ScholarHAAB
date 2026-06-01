import type { CSSProperties } from 'react'

export default function MarkSchemeCard({ points }: { points: string[] }) {
  if (!points.length) return null

  return (
    <section style={styles.card}>
      <div style={styles.label}>Mark scheme breakdown</div>
      <ol style={styles.list}>
        {points.map((point, index) => (
          <li key={`${point}-${index}`} style={styles.item}>
            <span style={styles.mark}>[{index + 1}]</span>
            <span>{point}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

const styles = {
  card: {
    background: 'rgba(255,255,255,0.035)',
    border: '1px solid rgba(170,85,255,0.12)',
    borderRadius: 18,
    display: 'grid',
    gap: 10,
    marginTop: 12,
    padding: 14,
  } satisfies CSSProperties,
  label: {
    color: '#c084fc',
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  } satisfies CSSProperties,
  list: {
    display: 'grid',
    gap: 8,
    listStyle: 'none',
    margin: 0,
    padding: 0,
  } satisfies CSSProperties,
  item: {
    color: '#e8e8ff',
    display: 'flex',
    gap: 9,
    lineHeight: 1.55,
  } satisfies CSSProperties,
  mark: {
    color: '#c084fc',
    fontWeight: 800,
  } satisfies CSSProperties,
}
