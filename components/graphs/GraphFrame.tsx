'use client'

import type { ReactNode } from 'react'

export default function GraphFrame({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <section
      className="scholarhaab-graph-frame"
      style={{
        display: 'grid',
        gap: '12px',
        borderRadius: '22px',
        border: '1px solid rgba(125, 92, 255, 0.28)',
        background: 'linear-gradient(145deg, rgba(14,14,32,0.96), rgba(20,14,43,0.92))',
        padding: '14px',
        boxShadow: '0 22px 60px rgba(0,0,0,0.25)',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, color: '#f3f0ff', fontSize: '16px', letterSpacing: '-0.01em' }}>{title}</h3>
          {subtitle ? (
            <p style={{ margin: '4px 0 0', color: '#a7a5c8', fontSize: '12px', lineHeight: 1.5 }}>{subtitle}</p>
          ) : null}
        </div>
        <span
          style={{
            alignSelf: 'start',
            borderRadius: '999px',
            padding: '6px 10px',
            background: 'rgba(34,211,238,0.1)',
            color: '#99f6e4',
            fontSize: '11px',
            fontWeight: 800,
          }}
        >
          interactive
        </span>
      </div>
      {children}
    </section>
  )
}
