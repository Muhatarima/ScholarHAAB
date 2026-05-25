'use client'

import Link from 'next/link'
import SessionBadge from '@/components/SessionBadge'

export default function Navbar() {
  return (
    <nav
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        padding: '14px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 20,
        borderBottom: '1px solid rgba(140,80,255,0.1)',
        background: 'rgba(0,0,13,0.8)',
        backdropFilter: 'blur(10px)',
        gap: '16px',
        flexWrap: 'wrap',
      }}
    >
      <Link
        href="/"
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '2px',
          textDecoration: 'none',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            fontWeight: 400,
            letterSpacing: '3px',
            textTransform: 'uppercase',
            color: '#7744aa',
            fontFamily: 'Georgia, serif',
            fontStyle: 'italic',
            marginRight: '1px',
            position: 'relative',
            top: '1px',
          }}
        >
          scholar
        </span>
        <span
          style={{
            fontSize: '24px',
            fontWeight: 600,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            background: 'linear-gradient(120deg,#cc88ff,#aa55ff,#8833dd)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          HAAB
        </span>
      </Link>

      <ul style={{ display: 'flex', gap: '22px', listStyle: 'none', margin: 0, padding: 0 }}>
        {[
          { href: '/qbank', label: 'QBank' },
          { href: '/exam-prep', label: 'Exam Prep' },
          { href: '/qbank/progress', label: 'Progress' },
        ].map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              style={{
                fontSize: '13px',
                color: '#9999BB',
                textDecoration: 'none',
                fontWeight: 400,
              }}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>

      <SessionBadge />
    </nav>
  )
}
