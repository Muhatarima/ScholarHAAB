import type { Metadata } from 'next'
import Link from 'next/link'
import Logo from '@/components/Logo'
import StarBackground from '@/components/StarBackground'
import UserCounterCard from '@/components/UserCounterCard'
import { buildMetadata } from '@/lib/seo'
import { getAuthenticatedUser } from '@/lib/supabase/serverClient'

export const metadata: Metadata = buildMetadata({
  title: 'ScholarHaab',
  description: 'Cambridge exam preparation with RAG, past-paper analysis, OCR, and step-by-step AI tutoring.',
  path: '/',
})

const features = [
  ['Solver', 'Ask text or image questions and get worked answers with indexed sources.'],
  ['Exam Mode', 'Extract formulas, repeated patterns, and important questions from past papers.'],
  ['Adaptive Mode', 'Generate exam-style questions with full step-by-step answers.'],
  ['QBank', 'Find repeated concepts, difficulty patterns, and focused practice.'],
]

export default async function Home() {
  const user = await getAuthenticatedUser()
  const startHref = user ? '/dashboard' : '/login?next=/dashboard'

  return (
    <main style={styles.page}>
      <StarBackground variant="chat" />
      <section style={styles.shell}>
        <div style={styles.hero}>
          <Logo href={user ? '/dashboard' : '/'} />
          <p style={styles.eyebrow}>Cambridge exam preparation</p>
          <h1 style={styles.title}>Past-paper intelligence for real study sessions.</h1>
          <p style={styles.subtitle}>
            ScholarHaab combines Supabase vector search, your indexed question bank, and Gemini/Groq
            failover so Solver, Exam Mode, Adaptive Mode, and QBank all work from the same RAG source.
          </p>
          <div style={styles.actions}>
            <Link href={startHref} style={styles.primary}>Enter ScholarHaab</Link>
            <Link href="/login" style={styles.secondary}>Login</Link>
          </div>
        </div>

        <UserCounterCard />

        <div style={styles.grid}>
          {features.map(([title, description]) => (
            <article key={title} style={styles.card}>
              <h2>{title}</h2>
              <p>{description}</p>
            </article>
          ))}
        </div>
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
  },
  card: {
    background: 'rgba(255,255,255,.032)',
    border: '1px solid rgba(176,128,255,.14)',
    borderRadius: 8,
    lineHeight: 1.65,
    padding: 18,
  },
  eyebrow: {
    color: '#b983ff',
    fontSize: 12,
    fontWeight: 850,
    letterSpacing: 1.5,
    margin: '24px 0 0',
    textTransform: 'uppercase' as const,
  },
  grid: {
    display: 'grid',
    gap: 14,
    gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
  },
  hero: {
    alignItems: 'center',
    display: 'grid',
    justifyItems: 'center',
    textAlign: 'center' as const,
  },
  page: {
    background: '#02020c',
    color: '#ecebff',
    minHeight: 'calc(100vh - 74px)',
    position: 'relative' as const,
  },
  primary: {
    background: '#9b4dff',
    borderRadius: 8,
    color: '#fff',
    fontWeight: 850,
    padding: '13px 18px',
    textDecoration: 'none',
  },
  secondary: {
    border: '1px solid rgba(176,128,255,.24)',
    borderRadius: 8,
    color: '#d8ccf2',
    fontWeight: 800,
    padding: '13px 18px',
    textDecoration: 'none',
  },
  shell: {
    display: 'grid',
    gap: 34,
    margin: '0 auto',
    padding: '56px 16px 72px',
    position: 'relative' as const,
    width: 'min(1120px,100%)',
    zIndex: 1,
  },
  subtitle: {
    color: '#c7c2dc',
    fontSize: 18,
    lineHeight: 1.7,
    margin: '18px auto 28px',
    maxWidth: 760,
  },
  title: {
    fontSize: 'clamp(42px,8vw,82px)',
    fontWeight: 520,
    lineHeight: 0.98,
    margin: '14px auto 0',
    maxWidth: 900,
  },
}
