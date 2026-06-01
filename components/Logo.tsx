import Link from 'next/link'

type LogoProps = {
  compact?: boolean
  href?: string
}

export default function Logo({ compact = false, href = '/' }: LogoProps) {
  const width = compact ? 112 : 154
  const height = compact ? 46 : 58
  const curveId = compact ? 'scholarCurveCompact' : 'scholarCurveFull'
  const gradientId = compact ? 'haabGradientCompact' : 'haabGradientFull'

  return (
    <Link href={href} aria-label="ScholarHAAB" style={{ display: 'inline-flex', lineHeight: 0, textDecoration: 'none' }}>
      <svg width={width} height={height} viewBox="0 0 154 58" role="img" aria-label="ScholarHAAB">
        <defs>
          <linearGradient id={gradientId} x1="24" x2="132" y1="18" y2="52" gradientUnits="userSpaceOnUse">
            <stop stopColor="#f6edff" />
            <stop offset="0.5" stopColor="#c084fc" />
            <stop offset="1" stopColor="#7c3aed" />
          </linearGradient>
          <path id={curveId} d="M 22 25 Q 77 4 132 25" />
        </defs>
        <text
          fill="#a855f7"
          fontFamily="Georgia, serif"
          fontSize={compact ? 10 : 11}
          fontStyle="italic"
          letterSpacing={compact ? 4 : 5}
          opacity="0.95"
        >
          <textPath href={`#${curveId}`} startOffset="50%" textAnchor="middle">
            SCHOLAR
          </textPath>
        </text>
        <text
          x="77"
          y="48"
          fill={`url(#${gradientId})`}
          fontFamily="var(--font-sans), sans-serif"
          fontSize={compact ? 29 : 34}
          fontWeight="800"
          letterSpacing={compact ? 3 : 4}
          textAnchor="middle"
        >
          HAAB
        </text>
      </svg>
    </Link>
  )
}
