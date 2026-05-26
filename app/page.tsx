import type { Metadata } from 'next'
import Link from 'next/link'
import { signOut } from '@/app/auth/actions'
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
    title: 'Night before exam',
    description: 'Topic analysis, formulas, practice questions. Exam ready.',
  },
  {
    label: 'PROGRESS',
    title: 'Dashboard',
    description: 'Weak topics, performance trends, leaderboard.',
  },
]

const navLinkStyle = {
  alignItems: 'center',
  color: '#9999BB',
  display: 'inline-flex',
  fontSize: 13,
  gap: 7,
  padding: '9px 0',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
} as const

const navButtonStyle = {
  alignItems: 'center',
  border: '1px solid rgba(170,85,255,0.34)',
  borderRadius: 999,
  background: 'transparent',
  color: '#E8E8FF',
  cursor: 'pointer',
  display: 'inline-flex',
  fontFamily: 'inherit',
  fontSize: 13,
  gap: 7,
  padding: '9px 14px',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
} as const

type NavIconName = 'solver' | 'dashboard' | 'exam' | 'logout' | 'signin'

function NavIcon({ name }: { name: NavIconName }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.8,
  }

  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" style={{ color: '#b975ff', flexShrink: 0 }}>
      {name === 'solver' ? (
        <>
          <path {...common} d="M5 6.2h14M5 12h8.5M5 17.8h5.5" />
          <path {...common} d="M16.3 14.2l1.7 1.7 3-3" />
        </>
      ) : null}
      {name === 'dashboard' ? (
        <>
          <path {...common} d="M4 13.5h6.5V20H4zM13.5 4H20v16h-6.5zM4 4h6.5v6.5H4z" />
          <path {...common} d="M6.5 17h1.8M16 8h1.8M16 12h1.8" />
        </>
      ) : null}
      {name === 'exam' ? (
        <>
          <path {...common} d="M12 3.5l2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.9-5.4 2.9 1-6-4.4-4.3 6.1-.9z" />
          <path {...common} d="M12 8.2v4.2l2.6 1.5" />
        </>
      ) : null}
      {name === 'logout' ? (
        <>
          <path {...common} d="M9.5 4.5H6.8A2.3 2.3 0 004.5 6.8v10.4a2.3 2.3 0 002.3 2.3h2.7" />
          <path {...common} d="M13 8l4 4-4 4M17 12H8" />
        </>
      ) : null}
      {name === 'signin' ? (
        <>
          <path {...common} d="M14.5 4.5h2.7a2.3 2.3 0 012.3 2.3v10.4a2.3 2.3 0 01-2.3 2.3h-2.7" />
          <path {...common} d="M11 8l4 4-4 4M15 12H4.5" />
        </>
      ) : null}
    </svg>
  )
}

function Logo() {
  return (
    <Link className="landing-logo" href="/" aria-label="ScholarHAAB" style={{ display: 'inline-flex', textDecoration: 'none' }}>
      <svg width="154" height="54" viewBox="0 0 154 54" role="img" aria-label="ScholarHAAB">
        <defs>
          <linearGradient id="haabGradient" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#f7edff" />
            <stop offset="48%" stopColor="#c989ff" />
            <stop offset="100%" stopColor="#8b3ee6" />
          </linearGradient>
          <path id="scholarCurve" d="M 24 23 Q 77 2 130 23" />
        </defs>
        <text
          fill="#9f5df7"
          fontFamily="Georgia, serif"
          fontSize="11"
          fontStyle="italic"
          letterSpacing="5"
          opacity="0.9"
        >
          <textPath href="#scholarCurve" startOffset="50%" textAnchor="middle">
            SCHOLAR
          </textPath>
        </text>
        <text
          x="77"
          y="44"
          fill="url(#haabGradient)"
          fontFamily="var(--font-sans), sans-serif"
          fontSize="31"
          fontWeight="800"
          letterSpacing="3"
          textAnchor="middle"
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
        @keyframes cardFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        .landing-card {
          overflow: hidden;
          position: relative;
          transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }
        .landing-card::after {
          content: "";
          position: absolute;
          inset: -40%;
          background: linear-gradient(110deg, transparent 35%, rgba(206,154,255,0.16) 50%, transparent 65%);
          transform: translateX(-65%) rotate(8deg);
          transition: transform 520ms ease;
        }
        .landing-card:hover {
          border-color: rgba(190,115,255,0.36) !important;
          box-shadow: 0 24px 72px rgba(120,60,200,0.22) !important;
          transform: translateY(-7px);
        }
        .landing-card:hover::after {
          transform: translateX(65%) rotate(8deg);
        }
        .card-grid .landing-card:nth-child(1) { animation: cardFloat 6s ease-in-out infinite; }
        .card-grid .landing-card:nth-child(2) { animation: cardFloat 6s ease-in-out 0.6s infinite; }
        .card-grid .landing-card:nth-child(3) { animation: cardFloat 6s ease-in-out 1.1s infinite; }
        .card-grid .landing-card:nth-child(4) { animation: cardFloat 6s ease-in-out 1.7s infinite; }
        @media (max-width: 900px) {
          .landing-grid { grid-template-columns: 1fr !important; }
          .card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; margin-top: 34px !important; }
          .blackhole { right: -136px !important; top: 36% !important; transform: translateY(-50%) scale(0.72) !important; opacity: 0.82; }
          .hero-title { font-size: clamp(54px, 17vw, 84px) !important; line-height: 0.94 !important; letter-spacing: -0.075em !important; }
          .landing-card { min-height: 148px !important; padding: 15px !important; border-radius: 20px !important; }
        }
        @media (max-width: 520px) {
          .landing-shell { width: min(100% - 24px, 1180px) !important; padding-top: 74px !important; }
          .landing-nav { align-items: flex-start !important; gap: 10px !important; padding: 12px 14px !important; }
          .landing-logo svg { width: 126px !important; height: 44px !important; }
          .landing-nav-actions { width: 100% !important; justify-content: center !important; gap: 8px !important; flex-wrap: wrap !important; }
          .landing-nav-link, .landing-nav-button { font-size: 12px !important; padding: 8px 10px !important; }
          .landing-card-title { font-size: 18px !important; }
          .landing-card-copy { font-size: 12px !important; line-height: 1.45 !important; }
        }
      `}</style>
      <Stars />
      <Blackhole />

      <nav
        className="landing-nav"
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 18,
          flexWrap: 'wrap',
          padding: '14px clamp(10px, 4vw, 36px)',
          borderBottom: '1px solid rgba(140,80,255,0.1)',
          background: 'rgba(0,0,13,0.42)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <Logo />
        <div className="landing-nav-actions" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          {user ? (
            <>
              <Link className="landing-nav-link" href="/qbank" style={navLinkStyle}>
                <NavIcon name="solver" />
                Solver
              </Link>
              <Link className="landing-nav-link" href="/dashboard" style={navLinkStyle}>
                <NavIcon name="dashboard" />
                Dashboard
              </Link>
              <Link className="landing-nav-link" href="/exam-prep" style={navLinkStyle}>
                <NavIcon name="exam" />
                Exam Mode
              </Link>
              <form action={signOut}>
                <button className="landing-nav-button" type="submit" style={navButtonStyle}>
                  <NavIcon name="logout" />
                  Logout
                </button>
              </form>
            </>
          ) : (
            <Link className="landing-nav-button" href="/login?next=/qbank" style={navButtonStyle}>
              <NavIcon name="signin" />
              Sign in
            </Link>
          )}
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
