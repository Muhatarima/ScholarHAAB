import type { CSSProperties, ReactNode } from 'react'

type BadgeTone = 'violet' | 'green' | 'amber' | 'muted'

const tones: Record<BadgeTone, CSSProperties> = {
  violet: {
    background: 'rgba(147,51,234,0.16)',
    borderColor: 'rgba(192,132,252,0.28)',
    color: '#d8b4fe',
  },
  green: {
    background: 'rgba(34,197,94,0.12)',
    borderColor: 'rgba(74,222,128,0.28)',
    color: '#86efac',
  },
  amber: {
    background: 'rgba(245,158,11,0.14)',
    borderColor: 'rgba(251,191,36,0.3)',
    color: '#fcd34d',
  },
  muted: {
    background: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(170,85,255,0.14)',
    color: '#aaa6ca',
  },
}

export default function Badge({ children, tone = 'violet' }: { children: ReactNode; tone?: BadgeTone }) {
  return (
    <span
      style={{
        ...tones[tone],
        alignItems: 'center',
        border: '1px solid',
        borderRadius: 999,
        display: 'inline-flex',
        fontSize: 11,
        fontWeight: 800,
        gap: 7,
        letterSpacing: '0.08em',
        padding: '7px 10px',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}
