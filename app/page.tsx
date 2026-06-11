import type { Metadata } from 'next'
import Link from 'next/link'
import Logo from '@/components/Logo'
import ProductNav from '@/components/ProductNav'
import StarBackground from '@/components/StarBackground'
import UserCounterCard from '@/components/UserCounterCard'
import { buildMetadata } from '@/lib/seo'
import { getAuthenticatedUser } from '@/lib/supabase/serverClient'

export const metadata: Metadata = buildMetadata({
  title: 'ScholarHAAB',
  description: 'Cambridge exam preparation with RAG, past-paper analysis, OCR, and step-by-step AI tutoring.',
  path: '/',
})

const features = [
  ['Solver', 'Ask a question or upload an image, then get a clean worked answer.'],
  ['Exam Mode', 'Load real past-paper questions and mark schemes by topic.'],
  ['Adaptive Mode', 'Practise one exam-style question with teacher-style steps.'],
  ['Mock Test', 'Submit answers and get feedback against the mark scheme.'],
] as const

export default async function Home() {
  const user = await getAuthenticatedUser()
  const startHref = user ? '/solver' : '/login?next=/solver'

  return (
    <main style={styles.page}>
      <StarBackground variant="chat" />
      <header style={styles.header}>
        <Logo href="/" compact />
        <ProductNav compact style={styles.nav} />
      </header>
      <section style={styles.shell}>
        <div style={styles.hero}>
          <Logo href="/" />
          <p style={styles.eyebrow}>PAST PAPER SOLVER ENGINE</p>
          <h1 style={styles.title}>
            Beyond borders
            <br />
            beyond limits
          </h1>
          <div style={styles.actions}>
            <Link href={startHref} style={styles.primary}>Enter ScholarHAAB</Link>
          </div>
        </div>

        <section aria-label="ScholarHAAB features" style={styles.featureGrid}>
          {features.map(([title, description]) => (
            <article key={title} style={styles.featureCard}>
              <h2 style={styles.featureTitle}>{title}</h2>
              <p style={styles.featureText}>{description}</p>
            </article>
          ))}
        </section>

        <UserCounterCard />
      </section>
    </main>
  )
}

const styles = {
  actions: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 12,
    justifyContent: 'center',
    marginTop: 28,
  },
  eyebrow: {
    background: 'linear-gradient(90deg,#ffffff,#d8b4fe,#a855f7)',
    WebkitBackgroundClip: 'text',
    color: 'transparent',
    fontSize: 13,
    fontWeight: 900,
    letterSpacing: 2.4,
    margin: '24px 0 0',
    textTransform: 'uppercase' as const,
  },
  hero: {
    alignItems: 'center',
    display: 'grid',
    justifyItems: 'center',
    minHeight: 'calc(100vh - 250px)',
    textAlign: 'center' as const,
  },
  featureCard: {
    background: 'linear-gradient(145deg, rgba(255,255,255,.042), rgba(124,58,237,.055))',
    border: '1px solid rgba(190,132,255,.16)',
    borderRadius: 8,
    minHeight: 138,
    padding: 22,
  },
  featureGrid: {
    display: 'grid',
    gap: 14,
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  },
  featureText: {
    color: '#c7c0df',
    fontSize: 15,
    lineHeight: 1.6,
    margin: '12px 0 0',
  },
  featureTitle: {
    color: '#f4edff',
    fontSize: 21,
    fontWeight: 900,
    letterSpacing: 0,
    margin: 0,
  },
  header: {
    alignItems: 'center',
    display: 'flex',
    gap: 18,
    justifyContent: 'space-between',
    margin: '0 auto',
    padding: '22px 18px 0',
    position: 'relative' as const,
    width: 'min(1320px,100%)',
    zIndex: 2,
  },
  nav: {
    justifyContent: 'flex-end',
  },
  page: {
    background: '#02020c',
    color: '#ecebff',
    minHeight: 'calc(100vh - 74px)',
    position: 'relative' as const,
  },
  primary: {
    background: 'linear-gradient(130deg,#7c3aed,#b45cff)',
    borderRadius: 8,
    color: '#fff',
    fontWeight: 900,
    padding: '14px 22px',
    textDecoration: 'none',
  },
  shell: {
    display: 'grid',
    gap: 34,
    margin: '0 auto',
    padding: '34px 16px 72px',
    position: 'relative' as const,
    width: 'min(1120px,100%)',
    zIndex: 1,
  },
  title: {
    background: 'linear-gradient(120deg,#ffffff 10%,#eadcff 45%,#b46cff 78%)',
    WebkitBackgroundClip: 'text',
    color: 'transparent',
    fontSize: 'clamp(54px,9vw,104px)',
    fontWeight: 760,
    lineHeight: 0.95,
    margin: '18px auto 0',
    maxWidth: 1040,
  },
}
