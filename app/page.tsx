import type { Metadata } from 'next'
import Link from 'next/link'
import { buildMetadata } from '@/lib/seo'
import { getAuthenticatedUser } from '@/lib/supabase/serverClient'

export const metadata: Metadata = buildMetadata({
  title: 'ScholarHAAB',
  description: 'Beyond borders. Beyond limits.',
  path: '/',
})

const cards = [
  {
    label: 'SOLVER',
    title: 'Past paper engine',
    description: 'Every question solved — step by step, board accurate.',
  },
  {
    label: 'TUTOR',
    title: 'Adaptive tutor',
    description: 'Explains like a teacher. Adjusts to how you learn.',
  },
  {
    label: 'EXAM',
    title: 'Night before mode',
    description: 'Topic analysis, formulas, practice questions. Exam ready.',
  },
  {
    label: 'PROGRESS',
    title: 'Dashboard',
    description: 'Weak topics, performance trends, leaderboard.',
  },
]

function Logo() {
  return (
    <Link href="/" style={{ display: 'flex', alignItems: 'baseline', gap: 6, textDecoration: 'none' }}>
      <span
        style={{
          color: '#7744aa',
          fontFamily: 'Georgia, serif',
          fontSize: 11,
          fontStyle: 'italic',
          letterSpacing: 3,
          textTransform: 'uppercase',
        }}
      >
        SCHOLAR
      </span>
      <span
        style={{
          background: 'linear-gradient(120deg,#cc88ff,#aa55ff,#8833dd)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          fontSize: 24,
          fontWeight: 600,
          letterSpacing: 2,
          textTransform: 'uppercase',
        }}
      >
        HAAB
      </span>
    </Link>
  )
}

function Stars() {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {Array.from({ length: 58 }).map((_, index) => (
        <span
          key={index}
          style={{
            position: 'absolute',
            top: `${(index * 37) % 100}%`,
            left: `${(index * 61) % 100}%`,
            width: index % 5 === 0 ? 2 : 1,
            height: index % 5 === 0 ? 2 : 1,
            borderRadius: '50%',
            background: '#cda8ff',
            opacity: index % 3 === 0 ? 0.8 : 0.32,
            animation: `twinkle ${2.4 + (index % 4) * 0.7}s ease-in-out infinite`,
            animationDelay: `${index * 0.08}s`,
          }}
        />
      ))}
    </div>
  )
}

function Blackhole() {
  return (
    <div
      aria-hidden="true"
      className="blackhole"
      style={{
        position: 'absolute',
        right: 'max(40px, 7vw)',
        top: '49%',
        width: 320,
        height: 320,
        transform: 'translateY(-50%)',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 40,
          borderRadius: '50%',
          background:
            'radial-gradient(circle at 42% 42%, rgba(230,200,255,0.96) 0 7%, rgba(170,85,255,0.9) 18%, rgba(65,18,116,0.88) 39%, rgba(0,0,13,0.98) 66%)',
          boxShadow: '0 0 80px rgba(170,85,255,0.72), inset 0 0 70px rgba(0,0,0,0.9)',
          animation: 'pulseGlow 4s ease-in-out infinite',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '50%',
          height: 120,
          transform: 'translateY(-50%) rotate(-9deg)',
          borderRadius: '50%',
          border: '2px solid rgba(204,136,255,0.48)',
          boxShadow: '0 0 42px rgba(170,85,255,0.35)',
          animation: 'diskCw 12s linear infinite',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 20,
          right: 20,
          top: '50%',
          height: 86,
          transform: 'translateY(-50%) rotate(10deg)',
          borderRadius: '50%',
          border: '1px solid rgba(119,68,170,0.62)',
          animation: 'diskCcw 16s linear infinite',
        }}
      />
    </div>
  )
}

export default async function Home() {
  const user = await getAuthenticatedUser()
  const startHref = user ? '/qbank' : '/login?next=/qbank'

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#00000d',
        color: '#E8E8FF',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-sans), sans-serif',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.1; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.55); }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 80px rgba(170,85,255,0.58), inset 0 0 70px rgba(0,0,0,0.9); }
          50% { box-shadow: 0 0 116px rgba(170,85,255,0.88), inset 0 0 78px rgba(0,0,0,0.96); }
        }
        @keyframes diskCw {
          from { transform: translateY(-50%) rotate(-9deg) rotateX(74deg) rotate(0deg); }
          to { transform: translateY(-50%) rotate(-9deg) rotateX(74deg) rotate(360deg); }
        }
        @keyframes diskCcw {
          from { transform: translateY(-50%) rotate(10deg) rotateX(74deg) rotate(0deg); }
          to { transform: translateY(-50%) rotate(10deg) rotateX(74deg) rotate(-360deg); }
        }
        @media (max-width: 900px) {
          .landing-grid { grid-template-columns: 1fr !important; }
          .card-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <Stars />
      <Blackhole />

      <nav
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px clamp(18px, 4vw, 36px)',
          borderBottom: '1px solid rgba(140,80,255,0.1)',
          background: 'rgba(0,0,13,0.42)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <Logo />
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <Link href="/qbank" style={{ color: '#9999BB', fontSize: 13, textDecoration: 'none' }}>
            Solver
          </Link>
          <Link
            href="/login?next=/qbank"
            style={{
              border: '1px solid rgba(170,85,255,0.34)',
              borderRadius: 999,
              color: '#E8E8FF',
              fontSize: 13,
              padding: '9px 14px',
              textDecoration: 'none',
            }}
          >
            Sign in
          </Link>
        </div>
      </nav>

      <section
        className="landing-grid"
        style={{
          position: 'relative',
          zIndex: 2,
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 440px)',
          alignItems: 'center',
          gap: 'clamp(28px, 6vw, 92px)',
          width: 'min(1180px, calc(100vw - 40px))',
          margin: '0 auto',
          padding: '54px 0 64px',
        }}
      >
        <div>
          <div
            style={{
              color: '#7744aa',
              fontSize: 11,
              letterSpacing: 3,
              marginBottom: 16,
              textTransform: 'uppercase',
            }}
          >
            OPERATIVE SINCE 2026
          </div>
          <div
            style={{
              color: '#AA66FF',
              fontSize: 12,
              letterSpacing: 4,
              marginBottom: 24,
              textTransform: 'uppercase',
            }}
          >
            — PAST PAPER SOLVER ENGINE —
          </div>
          <h1
            style={{
              background: 'linear-gradient(118deg,#ffffff 0%,#f4eeff 38%,#c88cff 72%,#ffffff 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontSize: 'clamp(54px, 9vw, 112px)',
              fontWeight: 500,
              letterSpacing: '-0.07em',
              lineHeight: 0.88,
              margin: 0,
              maxWidth: 760,
            }}
          >
            Beyond borders. <br />
            Beyond limits.
          </h1>
          <Link
            href={startHref}
            style={{
              background: 'linear-gradient(130deg,#7733cc,#aa55ff)',
              borderRadius: 999,
              boxShadow: '0 0 28px rgba(170,85,255,0.38)',
              color: '#fff',
              display: 'inline-flex',
              fontSize: 15,
              fontWeight: 800,
              padding: '14px 22px',
              textDecoration: 'none',
            }}
          >
            Begin your mission →
          </Link>
        </div>

        <div
          className="card-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 14,
          }}
        >
          {cards.map((card) => (
            <article
              key={card.label}
              style={{
                minHeight: 188,
                border: '1px solid rgba(170,85,255,0.14)',
                borderRadius: 24,
                background: 'linear-gradient(145deg, rgba(255,255,255,0.07), rgba(255,255,255,0.025))',
                boxShadow: '0 18px 60px rgba(0,0,0,0.22)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: 20,
              }}
            >
              <span
                style={{
                  color: '#AA66FF',
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: 2.4,
                  textTransform: 'uppercase',
                }}
              >
                {card.label}
              </span>
              <div>
                <h2 style={{ color: '#F4EEFF', fontSize: 22, lineHeight: 1.1, margin: '0 0 10px' }}>
                  {card.title}
                </h2>
                <p style={{ color: '#9F9FC4', fontSize: 13, lineHeight: 1.6, margin: 0 }}>{card.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
