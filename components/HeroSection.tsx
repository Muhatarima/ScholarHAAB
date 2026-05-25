'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

const trustStats = [
  { value: 'A/O Level first', label: 'One focused exam-prep product' },
  { value: 'Direct + Tutor', label: 'Fast answers or patient teaching' },
  { value: 'BD-first', label: 'Built for Bangladeshi students' },
]

const capabilityCards = [
  {
    tag: 'QBank',
    title: 'Past papers that feel guided, not dumped',
    desc: 'Board-aware solving, repeat-topic insight, LaTeX math, and image-friendly question help for Cambridge and Edexcel.',
  },
  {
    tag: 'Memory',
    title: 'Setup once, better answers from message one',
    desc: 'Board, level, subjects, and language stay in session context so the AI stops guessing.',
  },
  {
    tag: 'Trust',
    title: 'Built like a product, not a toy demo',
    desc: 'Account state, guarded routes, and grounded answer flows make the app feel ready for real exam prep.',
  },
]

const workflow = [
  {
    step: '01',
    title: 'Set your study defaults once',
    desc: 'Choose board, level, subjects, and language so the first answer already feels personalized.',
  },
  {
    step: '02',
    title: 'Ask naturally, upload when typing is annoying',
    desc: 'Use text, image, PDF, or tutor mode without translating your real problem into robot-style keywords.',
  },
  {
    step: '03',
    title: 'Keep momentum with saved context',
    desc: 'Your chats, progress, and preferred language stay connected to the same account.',
  },
]

export default function HeroSection() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  return (
    <section
      style={{
        position: 'relative',
        zIndex: 10,
        padding: isMobile ? '100px 24px 56px' : '0 42px 64px',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1160px',
          margin: '0 auto',
          display: 'grid',
          gap: '44px',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.15fr) minmax(320px, 0.85fr)',
            gap: '28px',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'grid', gap: '22px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 14px',
                borderRadius: '999px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(170,85,255,0.16)',
                color: '#b7a6eb',
                fontSize: '12px',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                width: 'fit-content',
              }}
            >
              Built for BD students
            </div>

            <div>
              <h1
                style={{
                  fontSize: isMobile ? '38px' : '64px',
                  fontWeight: 600,
                  lineHeight: 1.02,
                  margin: '0 0 16px',
                  color: '#fff',
                }}
              >
                A study product that feels
                <span
                  style={{
                    display: 'block',
                    background: 'linear-gradient(100deg,#fff 10%,#cc88ff 52%,#7733cc 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  genuinely built for Bangladesh
                </span>
              </h1>
              <p
                style={{
                  margin: 0,
                  maxWidth: '660px',
                  color: '#9a9abe',
                  lineHeight: 1.8,
                  fontSize: isMobile ? '15px' : '18px',
                }}
              >
                ScholarHAAB combines board-aware past-paper solving, warm tutor guidance, repeated-topic insight, and session memory into one focused exam-prep flow. No more starting from zero every time you ask for help.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <Link
                href="/qbank"
                style={{
                  padding: '13px 28px',
                  borderRadius: '999px',
                  border: 'none',
                  background: 'linear-gradient(130deg,#7733cc,#aa55ff)',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  boxShadow: '0 0 20px 4px rgba(119,51,204,0.32)',
                }}
              >
                Open QBank
              </Link>

              <Link
                href="/onboarding"
                style={{
                  padding: '13px 24px',
                  borderRadius: '999px',
                  border: '1px solid rgba(107,228,255,0.18)',
                  background: 'rgba(107,228,255,0.05)',
                  color: '#bff0ff',
                  fontSize: '14px',
                textDecoration: 'none',
              }}
            >
                Set your study defaults
              </Link>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
                gap: '12px',
              }}
            >
              {trustStats.map((item) => (
                <div
                  key={item.label}
                  style={{
                    borderRadius: '20px',
                    border: '1px solid rgba(170,85,255,0.12)',
                    background: 'rgba(255,255,255,0.04)',
                    padding: '16px 18px',
                  }}
                >
                  <div style={{ fontSize: '24px', fontWeight: 600, color: '#f3ecff' }}>{item.value}</div>
                  <div style={{ marginTop: '8px', fontSize: '13px', color: '#9a9abe', lineHeight: 1.6 }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              borderRadius: '32px',
              border: '1px solid rgba(170,85,255,0.16)',
              background: 'linear-gradient(180deg, rgba(22,16,42,0.92), rgba(7,7,20,0.92))',
              padding: '24px',
              display: 'grid',
              gap: '16px',
              boxShadow: '0 24px 80px rgba(0,0,0,0.26)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
              <div>
                <p style={{ margin: '0 0 6px', color: '#9A6CFF', fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase' }}>
                  Why it feels different
                </p>
                <h2 style={{ margin: 0, fontSize: '28px', lineHeight: 1.12 }}>Less demo energy. More real student utility.</h2>
              </div>
            </div>

            <div style={{ display: 'grid', gap: '12px' }}>
              {capabilityCards.map((card) => (
                <div
                  key={card.title}
                  style={{
                    borderRadius: '20px',
                    border: '1px solid rgba(170,85,255,0.12)',
                    background: 'rgba(255,255,255,0.03)',
                    padding: '16px 18px',
                  }}
                >
                  <div style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: '#9A6CFF' }}>{card.tag}</div>
                  <div style={{ marginTop: '8px', fontSize: '18px', fontWeight: 600, color: '#f3ecff' }}>{card.title}</div>
                  <div style={{ marginTop: '8px', color: '#a8a6c8', lineHeight: 1.65, fontSize: '13px' }}>{card.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '18px' }}>
          <div>
            <p style={{ margin: '0 0 8px', fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase', color: '#9A6CFF' }}>
              How it works
            </p>
            <h2 style={{ margin: 0, fontSize: isMobile ? '28px' : '40px', lineHeight: 1.08 }}>
              Get from confusion to momentum without resetting every session
            </h2>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
              gap: '14px',
            }}
          >
            {workflow.map((item) => (
              <div
                key={item.step}
                style={{
                  borderRadius: '24px',
                  border: '1px solid rgba(170,85,255,0.12)',
                  background: 'rgba(255,255,255,0.03)',
                  padding: '20px',
                }}
              >
                <div style={{ fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase', color: '#9A6CFF' }}>{item.step}</div>
                <div style={{ marginTop: '12px', fontSize: '22px', lineHeight: 1.16, fontWeight: 600, color: '#f3ecff' }}>{item.title}</div>
                <div style={{ marginTop: '10px', color: '#9a9abe', lineHeight: 1.7, fontSize: '14px' }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
