'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function HeroSection() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const cards = [
    {
      tag: 'Pathfinder',
      title: 'Scholarship intelligence',
      desc: 'Find realistic funding options matched to your profile and budget reality.',
    },
    {
      tag: 'Calibrate',
      title: 'Document scoring',
      desc: 'Review SOP, LOR, CV, and application materials with practical feedback.',
    },
    {
      tag: 'Arsenal',
      title: 'Cambridge + Edexcel',
      desc: 'Board-aware past-paper support with direct solving and guided tutor mode.',
    },
    {
      tag: 'Mentor',
      title: 'Adaptive tutor',
      desc: 'Re-explains difficult topics in simple, medium, or advanced ways.',
    },
  ]

  return (
    <div
      style={{
        position: 'relative',
        zIndex: 10,
        padding: isMobile ? '100px 24px 40px' : '0 42px',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        maxWidth: '600px',
        margin: isMobile ? '0 auto' : '0 auto 0 20%',
      }}
    >
      <div
        style={{
          fontSize: '13px',
          letterSpacing: '4px',
          textTransform: 'uppercase',
          color: '#7744aa',
          marginBottom: '18px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span style={{ display: 'inline-block', width: '24px', height: '1px', background: '#7744aa' }} />
        Operative since 2026
      </div>

      <h1
        style={{
          fontSize: isMobile ? '36px' : '50px',
          fontWeight: 500,
          margin: '0 0 6px',
          lineHeight: 1.05,
        }}
      >
        <span
          style={{
            background: 'linear-gradient(100deg,#fff 10%,#cc88ff 55%,#7733cc 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Beyond borders.
        </span>
        <br />
        Beyond limits.
      </h1>

      <p
        style={{
          fontSize: isMobile ? '15px' : '18px',
          color: '#55556A',
          margin: '14px 0 34px',
          maxWidth: '360px',
          lineHeight: 1.8,
        }}
      >
        Your next chapter starts with the right move.
      </p>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '44px', flexWrap: 'wrap' }}>
        <Link
          href="/chat"
          style={{
            padding: '12px 30px',
            borderRadius: '30px',
            border: 'none',
            background: 'linear-gradient(130deg,#7733cc,#aa55ff)',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            animation: 'pulseGlow 2.8s ease-in-out infinite',
            letterSpacing: '0.3px',
            textDecoration: 'none',
          }}
        >
          Begin your mission
        </Link>

        <Link
          href="/qbank"
          style={{
            padding: '12px 28px',
            borderRadius: '30px',
            border: '1px solid #ffffff14',
            background: 'transparent',
            color: '#55556A',
            fontSize: '13px',
            cursor: 'pointer',
            textDecoration: 'none',
          }}
        >
          Explore QBank
        </Link>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: '11px',
          maxWidth: '500px',
        }}
      >
        {cards.map((card, i) => (
          <div
            key={i}
            style={{
              background: 'rgba(170,85,255,0.04)',
              border: '1px solid rgba(170,85,255,0.1)',
              borderRadius: '14px',
              padding: '18px 20px',
              animation: `float 6s ease-in-out ${i}s infinite`,
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '14px',
                right: '16px',
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                background: '#7733cc',
                opacity: 0.6,
                boxShadow: '0 0 6px 2px #7733cc88',
              }}
            />
            <span
              style={{
                fontSize: '11px',
                letterSpacing: '2.5px',
                textTransform: 'uppercase',
                color: '#7733cc',
                marginBottom: '8px',
                display: 'block',
              }}
            >
              {card.tag}
            </span>
            <p style={{ fontSize: '15px', fontWeight: 500, color: '#C8C8EE', margin: '0 0 5px' }}>
              {card.title}
            </p>
            <p style={{ fontSize: '13px', color: '#3D3D52', margin: 0, lineHeight: 1.6 }}>{card.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
