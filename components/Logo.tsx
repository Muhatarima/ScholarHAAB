import type { CSSProperties } from 'react'

type LogoProps = {
  compact?: boolean
  style?: CSSProperties
}

export default function Logo({ compact = false, style }: LogoProps) {
  return (
    <div style={{ ...styles.logo(compact), ...style }} aria-label="ScholarHAAB">
      <div style={styles.blackHole(compact)}>
        <span style={styles.ringOuter(compact)} />
        <span style={styles.ringMain(compact)} />
        <span style={styles.ringGlow(compact)} />
        <span style={styles.core(compact)} />
        <span style={styles.disk(compact)} />
        <span style={styles.diskGlow(compact)} />
      </div>

      <div style={styles.textWrap(compact)}>
        <div style={styles.scholar(compact)}>scholar</div>
        <div style={styles.haab(compact)}>HAAB</div>
      </div>
    </div>
  )
}

const purple = '#b14cff'
const hotPurple = '#d58cff'
const deepPurple = '#6d19ff'

const styles = {
  logo: (compact: boolean): CSSProperties => ({
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: compact ? 118 : 190,
    height: compact ? 70 : 112,
    isolation: 'isolate',
    overflow: 'visible',
  }),

  blackHole: (compact: boolean): CSSProperties => ({
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    filter: 'drop-shadow(0 0 10px rgba(177, 76, 255, 0.9))',
    transform: compact ? 'scale(0.9)' : 'scale(1)',
  }),

  core: (compact: boolean): CSSProperties => ({
    position: 'absolute',
    width: compact ? 42 : 66,
    height: compact ? 42 : 66,
    borderRadius: '999px',
    background:
      'radial-gradient(circle at 50% 50%, #000 0%, #000 58%, rgba(108,25,255,0.25) 61%, transparent 66%)',
    boxShadow: '0 0 28px rgba(0,0,0,1), inset 0 0 18px rgba(177,76,255,0.28)',
    zIndex: 2,
  }),

  ringOuter: (compact: boolean): CSSProperties => ({
    position: 'absolute',
    width: compact ? 105 : 170,
    height: compact ? 62 : 100,
    borderRadius: '50%',
    border: `${compact ? 2 : 3}px solid rgba(177, 76, 255, 0.24)`,
    transform: 'rotate(-1deg)',
    boxShadow: '0 0 26px rgba(177,76,255,0.45)',
    zIndex: 1,
  }),

  ringMain: (compact: boolean): CSSProperties => ({
    position: 'absolute',
    width: compact ? 98 : 158,
    height: compact ? 48 : 78,
    borderRadius: '50%',
    borderTop: `${compact ? 4 : 6}px solid ${hotPurple}`,
    borderBottom: `${compact ? 4 : 6}px solid ${purple}`,
    borderLeft: `${compact ? 2 : 3}px solid rgba(177,76,255,0.75)`,
    borderRight: `${compact ? 2 : 3}px solid rgba(177,76,255,0.75)`,
    transform: 'rotate(-2deg)',
    boxShadow:
      '0 0 12px rgba(213,140,255,0.95), 0 0 30px rgba(109,25,255,0.75), inset 0 0 18px rgba(177,76,255,0.32)',
    zIndex: 3,
  }),

  ringGlow: (compact: boolean): CSSProperties => ({
    position: 'absolute',
    width: compact ? 92 : 148,
    height: compact ? 40 : 64,
    borderRadius: '50%',
    borderTop: `${compact ? 2 : 3}px solid rgba(255,255,255,0.85)`,
    filter: 'blur(1px)',
    transform: 'rotate(-2deg) translateY(-4px)',
    opacity: 0.8,
    zIndex: 4,
  }),

  disk: (compact: boolean): CSSProperties => ({
    position: 'absolute',
    width: compact ? 128 : 210,
    height: compact ? 12 : 18,
    borderRadius: '999px',
    background:
      'linear-gradient(90deg, transparent 0%, rgba(109,25,255,0.2) 8%, rgba(213,140,255,0.95) 35%, #fff 50%, rgba(213,140,255,0.95) 65%, rgba(109,25,255,0.2) 92%, transparent 100%)',
    boxShadow:
      '0 0 10px rgba(213,140,255,1), 0 0 28px rgba(177,76,255,0.85), 0 0 48px rgba(109,25,255,0.55)',
    transform: 'translateY(2px)',
    zIndex: 5,
  }),

  diskGlow: (compact: boolean): CSSProperties => ({
    position: 'absolute',
    width: compact ? 136 : 224,
    height: compact ? 26 : 40,
    borderRadius: '999px',
    background:
      'radial-gradient(ellipse at center, rgba(213,140,255,0.38) 0%, rgba(177,76,255,0.22) 42%, transparent 72%)',
    filter: 'blur(7px)',
    transform: 'translateY(2px)',
    zIndex: 0,
  }),

  textWrap: (compact: boolean): CSSProperties => ({
    position: 'relative',
    zIndex: 8,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    transform: compact ? 'translateY(10px)' : 'translateY(17px)',
    lineHeight: 1,
    textShadow:
      '0 0 8px rgba(213,140,255,0.95), 0 0 18px rgba(177,76,255,0.75)',
  }),

  scholar: (compact: boolean): CSSProperties => ({
    fontSize: compact ? 10 : 16,
    letterSpacing: compact ? 5 : 8,
    color: '#e8caff',
    textTransform: 'lowercase',
    fontWeight: 700,
    marginLeft: compact ? 5 : 8,
  }),

  haab: (compact: boolean): CSSProperties => ({
    fontSize: compact ? 28 : 48,
    letterSpacing: compact ? 4 : 8,
    color: '#c06cff',
    fontWeight: 900,
    textTransform: 'uppercase',
  }),
}
