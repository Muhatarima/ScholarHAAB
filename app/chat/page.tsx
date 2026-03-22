import Link from 'next/link'
import Stars from '@/components/Stars'
import Blackhole from '@/components/Blackhole'

const products = [
  {
    href: '/abroad',
    eyebrow: 'ScholarHAAB Abroad',
    title: 'Scholarship and study abroad consultant',
    description:
      'Scholarship matching, document review, visa and finance guidance, and step-by-step planning for Bangladeshi students.',
  },
  {
    href: '/qbank',
    eyebrow: 'ScholarHAAB QBank',
    title: 'O/A Level paper solving and tutor mode',
    description:
      'Direct answers, guided solving, topic importance, repeat-question lookup, and board-aware support for exam prep.',
  },
]

export default function ChatHubPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
        background: '#00000d',
        color: '#E8E8FF',
        padding: '120px 24px 48px',
      }}
    >
      <Stars />
      <Blackhole />

      <div
        style={{
          position: 'relative',
          zIndex: 10,
          maxWidth: '980px',
          margin: '0 auto',
        }}
      >
        <p
          style={{
            fontSize: '12px',
            letterSpacing: '3px',
            textTransform: 'uppercase',
            color: '#7744aa',
            marginBottom: '18px',
          }}
        >
          Choose your workspace
        </p>
        <h1
          style={{
            fontSize: 'clamp(36px, 6vw, 60px)',
            lineHeight: 1.02,
            fontWeight: 500,
            marginBottom: '16px',
            maxWidth: '760px',
          }}
        >
          One platform. Two focused AI products.
        </h1>
        <p
          style={{
            maxWidth: '640px',
            color: '#7C7CA0',
            lineHeight: 1.8,
            fontSize: '15px',
            marginBottom: '32px',
          }}
        >
          Pick the product that matches what you need right now. Abroad is for scholarships and
          applications. QBank is for O/A Level solving and tutor-mode learning.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '18px',
          }}
        >
          {products.map((product) => (
            <Link
              key={product.href}
              href={product.href}
              style={{
                textDecoration: 'none',
                color: 'inherit',
                position: 'relative',
                zIndex: 10,
              }}
            >
              <article
                style={{
                  minHeight: '260px',
                  padding: '24px',
                  borderRadius: '24px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(170,85,255,0.14)',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.24)',
                  backdropFilter: 'blur(18px)',
                }}
              >
                <p
                  style={{
                    fontSize: '11px',
                    letterSpacing: '2.8px',
                    textTransform: 'uppercase',
                    color: '#9A6CFF',
                    marginBottom: '14px',
                  }}
                >
                  {product.eyebrow}
                </p>
                <h2
                  style={{
                    fontSize: '28px',
                    lineHeight: 1.08,
                    fontWeight: 500,
                    marginBottom: '12px',
                  }}
                >
                  {product.title}
                </h2>
                <p
                  style={{
                    color: '#8A8AAE',
                    lineHeight: 1.8,
                    fontSize: '14px',
                    marginBottom: '24px',
                  }}
                >
                  {product.description}
                </p>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    color: '#E8E8FF',
                  }}
                >
                  Enter workspace
                  <span aria-hidden="true">-&gt;</span>
                </span>
              </article>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
