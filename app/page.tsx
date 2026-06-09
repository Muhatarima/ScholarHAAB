import type { Metadata } from 'next'
import Link from 'next/link'
import { signOut } from '@/app/auth/actions'
import { buildMetadata } from '@/lib/seo'
import { getAuthenticatedUser } from '@/lib/supabase/serverClient'
import UserCounterCard from '@/components/UserCounterCard'

export const metadata: Metadata = buildMetadata({
  title: 'ScholarHAAB',
  description: 'AI you can actually trust. Built for Bangladesh — ready for the world.',
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
        <><path {...common} d="M5 6.2h14M5 12h8.5M5 17.8h5.5" /><path {...common} d="M16.3 14.2l1.7 1.7 3-3" /></>
      ) : null}
      {name === 'dashboard' ? (
        <><path {...common} d="M4 13.5h6.5V20H4zM13.5 4H20v16h-6.5zM4 4h6.5v6.5H4z" /><path {...common} d="M6.5 17h1.8M16 8h1.8M16 12h1.8" /></>
      ) : null}
      {name === 'exam' ? (
        <><path {...common} d="M12 3.5l2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.9-5.4 2.9 1-6-4.4-4.3 6.1-.9z" /><path {...common} d="M12 8.2v4.2l2.6 1.5" /></>
      ) : null}
      {name === 'logout' ? (
        <><path {...common} d="M9.5 4.5H6.8A2.3 2.3 0 004.5 6.8v10.4a2.3 2.3 0 002.3 2.3h2.7" /><path {...common} d="M13 8l4 4-4 4M17 12H8" /></>
      ) : null}
      {name === 'signin' ? (
        <><path {...common} d="M14.5 4.5h2.7a2.3 2.3 0 012.3 2.3v10.4a2.3 2.3 0 01-2.3 2.3h-2.7" /><path {...common} d="M11 8l4 4-4 4M15 12H4.5" /></>
      ) : null}
    </svg>
  )
}

// ── Black Hole Logo ── used in nav (small) and hero (large)
function BlackholeLogo({ size = 'nav' }: { size?: 'nav' | 'hero' }) {
  const isHero = size === 'hero'
  const w = isHero ? 320 : 52
  const h = isHero ? 320 : 52

  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 320 320"
      role="img"
      aria-label="ScholarHAAB"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        <radialGradient id={`bhCore${size}`} cx="42%" cy="42%" r="58%">
          <stop offset="0%" stopColor="#e6c8ff" stopOpacity="0.96" />
          <stop offset="18%" stopColor="#aa55ff" stopOpacity="0.9" />
          <stop offset="39%" stopColor="#411274" stopOpacity="0.88" />
          <stop offset="66%" stopColor="#00000d" stopOpacity="0.98" />
        </radialGradient>
        <filter id={`glow${size}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={isHero ? '8' : '2'} result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id={`textGrad${size}`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#f7edff" />
          <stop offset="48%" stopColor="#c989ff" />
          <stop offset="100%" stopColor="#8b3ee6" />
        </linearGradient>
        <path id={`curve${size}`} d="M 60 130 Q 160 60 260 130" />
      </defs>

      {/* Outer glow ring */}
      <ellipse cx="160" cy="160" rx="130" ry="38" fill="none"
        stroke="rgba(170,85,255,0.45)" strokeWidth={isHero ? '2.5' : '1.5'}
        filter={`url(#glow${size})`}
        style={{ animation: 'bhDiskCw 12s linear infinite', transformOrigin: '160px 160px' }}
      />
      <ellipse cx="160" cy="160" rx="110" ry="28" fill="none"
        stroke="rgba(120,50,200,0.6)" strokeWidth={isHero ? '1.5' : '1'}
        style={{ animation: 'bhDiskCcw 17s linear infinite', transformOrigin: '160px 160px' }}
      />
      <ellipse cx="160" cy="160" rx="90" ry="20" fill="none"
        stroke="rgba(200,120,255,0.3)" strokeWidth="1"
        style={{ animation: 'bhDiskCw 22s linear infinite', transformOrigin: '160px 160px' }}
      />

      {/* Core */}
      <circle cx="160" cy="160" r="82"
        fill={`url(#bhCore${size})`}
        style={{ animation: 'bhPulse 4s ease-in-out infinite' }}
        filter={`url(#glow${size})`}
      />

      {/* Text — only show in nav size as compact text, hero has its own big text */}
      {!isHero && (
        <>
          <text fill="#9f5df7" fontFamily="Georgia, serif" fontSize="28" fontStyle="italic"
            letterSpacing="3" opacity="0.88">
            <textPath href={`#curve${size}`} startOffset="50%" textAnchor="middle">SCHOLAR</textPath>
          </text>
          <text x="160" y="198" fill={`url(#textGrad${size})`}
            fontFamily="var(--font-sans), sans-serif"
            fontSize="54" fontWeight="800" letterSpacing="5" textAnchor="middle">
            HAAB
          </text>
        </>
      )}
    </svg>
  )
}

function Stars() {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {Array.from({ length: 58 }).map((_, index) => (
        <span key={index} style={{
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
        }} />
      ))}
    </div>
  )
}

export default async function Home() {
  const user = await getAuthenticatedUser()
  const startHref = user ? '/solver' : '/login?next=/solver'

  return (
    <main style={{
      minHeight: '100vh',
      background: '#00000d',
      color: '#E8E8FF',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'var(--font-sans), sans-serif',
      overflowX: 'hidden',
      position: 'relative',
    }}>
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.1; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.55); }
        }
        @keyframes bhPulse {
          0%, 100% { filter: drop-shadow(0 0 22px rgba(170,85,255,0.58)); }
          50% { filter: drop-shadow(0 0 42px rgba(170,85,255,0.9)); }
        }
        @keyframes bhDiskCw {
          from { transform: rotateX(74deg) rotate(0deg); }
          to   { transform: rotateX(74deg) rotate(360deg); }
        }
        @keyframes bhDiskCcw {
          from { transform: rotateX(74deg) rotate(0deg); }
          to   { transform: rotateX(74deg) rotate(-360deg); }
        }
        @keyframes cardFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        @keyframes fillBar {
          from { width: 0%; }
          to   { width: var(--fill-w); }
        }
        .landing-card {
          overflow: hidden; position: relative;
          transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }
        .landing-card::after {
          content: ""; position: absolute; inset: -40%;
          background: linear-gradient(110deg, transparent 35%, rgba(206,154,255,0.16) 50%, transparent 65%);
          transform: translateX(-65%) rotate(8deg);
          transition: transform 520ms ease;
        }
        .landing-card:hover { border-color: rgba(190,115,255,0.36) !important; box-shadow: 0 24px 72px rgba(120,60,200,0.22) !important; transform: translateY(-7px); }
        .landing-card:hover::after { transform: translateX(65%) rotate(8deg); }
        .card-grid .landing-card:nth-child(1) { animation: cardFloat 6s ease-in-out infinite; }
        .card-grid .landing-card:nth-child(2) { animation: cardFloat 6s ease-in-out 0.6s infinite; }
        .card-grid .landing-card:nth-child(3) { animation: cardFloat 6s ease-in-out 1.1s infinite; }
        .card-grid .landing-card:nth-child(4) { animation: cardFloat 6s ease-in-out 1.7s infinite; }
        .nav-logo-wrap svg { width: 44px !important; height: 44px !important; }
        @media (max-width: 900px) {
          .card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; margin-top: 34px !important; }
          .hero-title { font-size: clamp(54px, 17vw, 84px) !important; line-height: 0.94 !important; letter-spacing: -0.075em !important; }
          .landing-card { min-height: 148px !important; padding: 15px !important; border-radius: 20px !important; }
          .hero-bh { width: 220px !important; height: 220px !important; right: -60px !important; top: 38% !important; opacity: 0.7; }
        }
        @media (max-width: 520px) {
          .landing-shell { width: min(100% - 24px, 1180px) !important; padding-top: 74px !important; padding-bottom: 48px !important; }
          .landing-nav { align-items: flex-start !important; gap: 10px !important; padding: 12px 14px !important; }
          .landing-nav-actions { width: 100% !important; justify-content: center !important; gap: 8px !important; flex-wrap: wrap !important; }
          .landing-nav-link, .landing-nav-button { font-size: 12px !important; padding: 8px 10px !important; }
          .landing-card-title { font-size: 18px !important; }
          .landing-card-copy { font-size: 12px !important; line-height: 1.45 !important; }
        }
      `}</style>

      <Stars />

      {/* Center hero black hole */}
      <div className="hero-bh" aria-hidden="true" style={{
        position: 'absolute',
        left: '50%',
        top: '30%',
        width: 300,
        height: 300,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: 1,
        animation: 'heroBlackHoleFloat 6s ease-in-out infinite',
      }}>
        <BlackholeLogo size="hero" />
      </div>

      {/* Hero black hole — right side floating */}
      <div className="hero-bh" aria-hidden="true" style={{
        position: 'absolute', right: 'max(20px, 5vw)', top: '46%',
        width: 320, height: 320,
        transform: 'translateY(-50%)',
        pointerEvents: 'none', zIndex: 1,
      }}>
        <BlackholeLogo size="hero" />
      </div>

      {/* ── NAV ── */}
      <nav className="landing-nav" style={{
        position: 'relative', zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 18, flexWrap: 'wrap',
        padding: '14px clamp(10px, 4vw, 36px)',
        borderBottom: '1px solid rgba(140,80,255,0.1)',
        background: 'rgba(0,0,13,0.42)',
        backdropFilter: 'blur(12px)',
      }}>
        {/* Logo — small black hole in nav */}
        <Link className="nav-logo-wrap" href="/" aria-label="ScholarHAAB home"
          style={{ display: 'inline-flex', lineHeight: 0, textDecoration: 'none' }}>
          <BlackholeLogo size="nav" />
        </Link>

        <div className="landing-nav-actions" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          {user ? (
            <>
              <Link className="landing-nav-link" href="/solver" style={navLinkStyle}><NavIcon name="solver" />Solver</Link>
              <Link className="landing-nav-link" href="/dashboard" style={navLinkStyle}><NavIcon name="dashboard" />Dashboard</Link>
              <Link className="landing-nav-link" href="/exam-mode" style={navLinkStyle}><NavIcon name="exam" />Exam Mode</Link>
              <form action={signOut}>
                <button className="landing-nav-button" type="submit" style={navButtonStyle}>
                  <NavIcon name="logout" />Logout
                </button>
              </form>
            </>
          ) : (
            <>
              <Link className="landing-nav-link" href="/login?next=/solver" style={navLinkStyle}>Solver</Link>
              <Link className="landing-nav-link" href="/login?next=/dashboard" style={navLinkStyle}>Dashboard</Link>
              <Link className="landing-nav-link" href="/login?next=/exam-mode" style={navLinkStyle}>Exam Mode</Link>
              <Link className="landing-nav-button" href="/login?next=/solver" style={navButtonStyle}>
                <NavIcon name="signin" />Sign in
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* ── HERO ── */}
    <section
  className="landing-shell"
  style={{
    position: 'relative',
    zIndex: 2,
    width: 'min(1280px, calc(100vw - 40px))',
    margin: '0 auto',
    padding: '60px 0 72px',
  }}
>
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      minHeight: '80vh',
      justifyContent: 'center',
      gap: 30,
    }}
  >
    {/* BIG BLACK HOLE */}
    <div
      style={{
        width: 'min(720px, 90vw)',
        aspectRatio: '1',
        borderRadius: '50%',
        background:
          'radial-gradient(circle at center, #000 18%, #1f0938 28%, #7b2cff 40%, #d9a8ff 48%, #7b2cff 55%, transparent 70%)',
        filter: 'drop-shadow(0 0 80px rgba(170,85,255,.6))',
        animation: 'bhHeroPulse 8s ease-in-out infinite',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: '38%',
          borderRadius: '50%',
          background: '#000',
        }}
      />
    </div>

    <div
      style={{
        color: '#AA66FF',
        letterSpacing: 6,
        fontSize: 12,
        textTransform: 'uppercase',
      }}
    >
      ScholarHAAB
    </div>

    <h1
      style={{
        margin: 0,
        fontSize: 'clamp(56px,9vw,120px)',
        lineHeight: 0.9,
        letterSpacing: '-0.08em',
        fontWeight: 600,
        background:
          'linear-gradient(180deg,#fff,#f1e7ff,#c78bff)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      }}
    >
      Beyond Borders.
      <br />
      Beyond Limits.
    </h1>

    <Link
      href={startHref}
      style={{
        background:
          'linear-gradient(135deg,#7733cc,#aa55ff)',
        borderRadius: 999,
        color: '#fff',
        padding: '16px 32px',
        textDecoration: 'none',
        fontWeight: 700,
        boxShadow:
          '0 0 40px rgba(170,85,255,.45)',
      }}
    >
      Enter →
    </Link>
  </div>

  <div style={{ marginTop: 80 }}>
    <UserCounterCard />
  </div>

  <div
    className="card-grid"
    style={{
      display: 'grid',
      gridTemplateColumns:
        'repeat(auto-fit,minmax(260px,1fr))',
      gap: 18,
      marginTop: 50,
    }}
  >
    {cards.map((card) => (
      <article
        className="landing-card"
        key={card.label}
        style={{
          minHeight: 200,
          border: '1px solid rgba(170,85,255,.16)',
          borderRadius: 28,
          background:
            'linear-gradient(145deg,rgba(255,255,255,.06),rgba(255,255,255,.02))',
          padding: 24,
        }}
      >
        <span
          style={{
            color: '#AA66FF',
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 2,
          }}
        >
          {card.label}
        </span>

        <h2
          style={{
            color: '#fff',
            fontSize: 24,
            marginTop: 20,
          }}
        >
          {card.title}
        </h2>

        <p
          style={{
            color: '#9F9FC4',
            lineHeight: 1.7,
          }}
        >
          {card.description}
        </p>
      </article>
    ))}
  </div>
</section>
    </main>
  )
}
