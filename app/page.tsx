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
    <Link href="/" aria-label="ScholarHAAB" style={{ display: 'inline-flex', textDecoration: 'none' }}>
      <svg width="198" height="46" viewBox="0 0 198 46" role="img" aria-label="ScholarHAAB">
        <defs>
          <linearGradient id="haabGradient" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#f7edff" />
            <stop offset="48%" stopColor="#c989ff" />
            <stop offset="100%" stopColor="#8b3ee6" />
          </linearGradient>
          <path id="scholarCurve" d="M 14 25 C 42 14, 78 14, 108 25" />
        </defs>
        <text
          fill="#9f5df7"
          fontFamily="Georgia, serif"
          fontSize="10"
          fontStyle="italic"
          letterSpacing="4"
          opacity="0.9"
        >
          <textPath href="#scholarCurve" startOffset="0%">
            SCHOLAR
          </textPath>
        </text>
        <text
          x="92"
          y="31"
          fill="url(#haabGradient)"
          fontFamily="var(--font-sans), sans-serif"
          fontSize="28"
          fontWeight="800"
          letterSpacing="3"
        >
          HAAB
        </text>
      </svg>
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
          .card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; margin-top: 34px !important; }
          .blackhole { right: -136px !important; top: 36% !important; transform: translateY(-50%) scale(0.72) !important; opacity: 0.82; }
          .hero-title { font-size: clamp(54px, 17vw, 84px) !important; line-height: 0.94 !important; letter-spacing: -0.075em !important; }
          .landing-card { min-height: 148px !important; padding: 15px !important; border-radius: 20px !important; }
        }
        @media (max-width: 520px) {
          .landing-shell { width: min(100% - 24px, 1180px) !important; padding-top: 74px !important; }
          .nav-link-solver { display: none !important; }
          .landing-card-title { font-size: 18px !important; }
          .landing-card-copy { font-size: 12px !important; line-height: 1.45 !important; }
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
          padding: '14px clamp(10px, 4vw, 36px)',
          borderBottom: '1px solid rgba(140,80,255,0.1)',
          background: 'rgba(0,0,13,0.42)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <Logo />
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <Link className="nav-link-solver" href="/qbank" style={{ color: '#9999BB', fontSize: 13, textDecoration: 'none' }}>
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
        className="landing-grid landing-shell"
        style={{
          position: 'relative',
          zIndex: 2,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 'clamp(30px, 5vw, 54px)',
          width: 'min(1180px, calc(100vw - 40px))',
          margin: '0 auto',
          padding: '108px 0 72px',
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
            className="hero-title"
            style={{
              background: 'linear-gradient(112deg,#ffffff 0%,#f2e8ff 38%,#c78bff 67%,#8f3dff 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontSize: 'clamp(54px, 9vw, 112px)',
              fontWeight: 500,
              letterSpacing: '-0.07em',
              lineHeight: 0.88,
              margin: '0 0 38px',
              maxWidth: 760,
              textShadow: '0 0 42px rgba(210,165,255,0.16)',
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
            marginLeft: 'auto',
            maxWidth: 560,
            width: 'min(100%, 560px)',
          }}
        >
          {cards.map((card) => (
            <article
              className="landing-card"
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
                <h2 className="landing-card-title" style={{ color: '#F4EEFF', fontSize: 22, lineHeight: 1.1, margin: '0 0 10px' }}>
                  {card.title}
                </h2>
                <p className="landing-card-copy" style={{ color: '#9F9FC4', fontSize: 13, lineHeight: 1.6, margin: 0 }}>{card.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
