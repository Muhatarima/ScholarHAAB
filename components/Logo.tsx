import Link from 'next/link'
import type { CSSProperties } from 'react'

type LogoProps = {
  compact?: boolean
  href?: string
  style?: CSSProperties
}

export default function Logo({ compact = false, href = '/', style }: LogoProps) {
  return (
    <Link href={href} aria-label="ScholarHAAB home" style={styles.link}>
      <span style={{ ...styles.wrap(compact), ...style }}>
        <span style={styles.orbit(compact)}>
          <span style={styles.core(compact)} />
          <span style={styles.disk(compact)} />
        </span>
        <span style={styles.text(compact)}>
          <span style={styles.scholar(compact)}>Scholar</span>
          <span style={styles.haab(compact)}>HAAB</span>
        </span>
      </span>
    </Link>
  )
}

const styles = {
  link: {
    alignItems: 'center',
    display: 'inline-flex',
    textDecoration: 'none',
  } satisfies CSSProperties,
  wrap: (compact: boolean): CSSProperties => ({
    alignItems: 'center',
    display: 'inline-flex',
    gap: compact ? 8 : 10,
    minWidth: compact ? 150 : 190,
  }),
  orbit: (compact: boolean): CSSProperties => ({
    alignItems: 'center',
    display: 'inline-flex',
    height: compact ? 34 : 42,
    justifyContent: 'center',
    position: 'relative',
    width: compact ? 42 : 52,
  }),
  core: (compact: boolean): CSSProperties => ({
    background: 'radial-gradient(circle, #000 0 55%, #35106b 58%, #b14cff 72%, transparent 74%)',
    borderRadius: 999,
    boxShadow: '0 0 18px rgba(177,76,255,.62)',
    height: compact ? 24 : 30,
    position: 'absolute',
    width: compact ? 24 : 30,
  }),
  disk: (compact: boolean): CSSProperties => ({
    background:
      'linear-gradient(90deg, transparent, rgba(177,76,255,.22), #e7c8ff, rgba(177,76,255,.85), transparent)',
    borderRadius: 999,
    boxShadow: '0 0 16px rgba(177,76,255,.75)',
    height: compact ? 8 : 10,
    position: 'absolute',
    transform: 'rotate(-7deg)',
    width: compact ? 48 : 58,
  }),
  text: (compact: boolean): CSSProperties => ({
    alignItems: 'baseline',
    display: 'inline-flex',
    gap: compact ? 2 : 3,
    whiteSpace: 'nowrap',
  }),
  scholar: (compact: boolean): CSSProperties => ({
    color: '#e7d5ff',
    fontSize: compact ? 18 : 22,
    fontWeight: 750,
    letterSpacing: 0,
  }),
  haab: (compact: boolean): CSSProperties => ({
    color: '#c06cff',
    fontSize: compact ? 18 : 22,
    fontWeight: 900,
    letterSpacing: 0,
  }),
} as const
