'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { CSSProperties } from 'react'

export const PRODUCT_NAV_ITEMS = [
  { href: '/exam-mode', label: 'Exam Mode' },
  { href: '/solver', label: 'Solver' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/mock', label: 'Mock Test' },
  { href: '/adaptive-mode', label: 'Question Generator' },
] as const

type ProductNavProps = {
  activeLinkStyle?: CSSProperties
  className?: string
  compact?: boolean
  linkStyle?: CSSProperties
  style?: CSSProperties
}

export default function ProductNav({
  activeLinkStyle,
  className,
  compact = false,
  linkStyle,
  style,
}: ProductNavProps) {
  const pathname = usePathname()

  return (
    <div
      className={className}
      style={{
        alignItems: 'center',
        display: 'flex',
        flexWrap: 'wrap',
        gap: compact ? 8 : 10,
        ...style,
      }}
    >
      {PRODUCT_NAV_ITEMS.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`)

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            style={{
              border: active
                ? '1px solid rgba(190,132,255,0.45)'
                : '1px solid rgba(190,132,255,0.18)',
              borderRadius: 999,
              color: active ? '#f4edff' : '#c7bce8',
              fontSize: compact ? 12 : 13,
              fontWeight: active ? 800 : 650,
              lineHeight: 1,
              padding: compact ? '8px 10px' : '9px 12px',
              textDecoration: 'none',
              background: active
                ? 'rgba(155,77,255,0.22)'
                : 'rgba(255,255,255,0.025)',
              ...linkStyle,
              ...(active ? activeLinkStyle : null),
            }}
          >
            {item.label}
          </Link>
        )
      })}
    </div>
  )
}
