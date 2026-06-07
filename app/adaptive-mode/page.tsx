'use client'

import Link from 'next/link'
import { Brain, RefreshCw, Sparkles } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import AuthGuard from '@/components/auth/AuthGuard'
import Logo from '@/components/Logo'
import RichMessageContent from '@/components/RichMessageContent'
import StarBackground from '@/components/StarBackground'
import { buildSupabaseAuthHeaders } from '@/lib/supabase/auth-headers'

type AdaptiveResult = {
  confidenceScore: number
  confidenceLabel: string
  question: {
    type?: string
    text?: string
    marks?: number
    options?: string[]
  }
  answer: string
  explanation: string[]
  commonMistakes: string[]
  sourcePattern: string
  sources: Array<{
    id: string
    title: string
    year: number | string | null
    board: string | null
    similarity: number | null
  }>
}

function AdaptiveModeInner() {
  const [subject, setSubject] = useState('Physics')
  const [topic, setTopic] = useState('Kinematics')
  const [board, setBoard] = useState('Cambridge')
  const [performance, setPerformance] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<AdaptiveResult | null>(null)

  async function generate() {
    if (!topic.trim()) {
      setError('Topic is required.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/adaptive-mode', {
        method: 'POST',
        headers: await buildSupabaseAuthHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ subject, topic, board, performance }),
      })
      const data = (await response.json()) as AdaptiveResult & { error?: string }
      if (!response.ok) throw new Error(data.error || 'Generation failed.')
      setResult(data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Generation failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={styles.page}>
      <StarBackground variant="chat" />
      <style>{`
        @media (max-width: 820px) {
          .adaptive-rag-controls {
            grid-template-columns: 1fr !important;
          }
          .adaptive-result-top {
            align-items: flex-start !important;
            flex-direction: column !important;
            padding: 12px 18px !important;
          }
        }
      `}</style>
      <nav style={styles.nav}>
        <Logo compact />
        <div style={styles.navLinks}>
          <Link href="/solver" style={styles.navLink}>Solver</Link>
          <Link href="/exam-mode" style={styles.navLink}>Exam Mode</Link>
          <Link href="/dashboard" style={styles.navLink}>Dashboard</Link>
        </div>
      </nav>

      <section style={styles.shell}>
        <header style={styles.header}>
          <Brain size={30} color="#ba7cff" />
          <div>
            <div style={styles.eyebrow}>ADAPTIVE MODE</div>
            <h1 style={styles.title}>One question. Fully solved.</h1>
          </div>
        </header>

        <div className="adaptive-rag-controls" style={styles.controls}>
          <select value={subject} onChange={(event) => setSubject(event.target.value)} style={styles.field}>
            <option>Physics</option>
            <option>Mathematics</option>
            <option>Chemistry</option>
          </select>
          <select value={board} onChange={(event) => setBoard(event.target.value)} style={styles.field}>
            <option>Cambridge</option>
            <option>Edexcel</option>
          </select>
          <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Topic" style={styles.field} />
          <input value={performance} onChange={(event) => setPerformance(event.target.value)} placeholder="Previous performance (optional)" style={styles.field} />
          <button type="button" onClick={() => void generate()} disabled={loading} style={styles.primaryButton}>
            {loading ? <RefreshCw size={17} /> : <Sparkles size={17} />}
            {loading ? 'Generating...' : 'Generate'}
          </button>
        </div>

        {error ? <p style={styles.error}>{error}</p> : null}

        {result ? (
          <div style={styles.result}>
            <div className="adaptive-result-top" style={styles.resultTop}>
              <span style={styles.type}>{result.question.type || 'structured'}</span>
              <span>{result.question.marks ?? 0} marks</span>
              <span>{result.confidenceScore}% corpus confidence</span>
            </div>
            <section style={styles.question}>
              <RichMessageContent content={result.question.text || ''} />
              {result.question.options?.length ? (
                <ol style={styles.options}>
                  {result.question.options.map((option) => <li key={option}>{option}</li>)}
                </ol>
              ) : null}
            </section>
            <section style={styles.answerBand}>
              <h2>Answer</h2>
              <RichMessageContent content={result.answer} />
            </section>
            <section style={styles.stepsBand}>
              <h2>Step-by-step reasoning</h2>
              <ol style={styles.steps}>
                {result.explanation.map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}
              </ol>
            </section>
            {result.commonMistakes.length ? (
              <section style={styles.mistakes}>
                <h2>Common mistakes</h2>
                <ul>{result.commonMistakes.map((mistake) => <li key={mistake}>{mistake}</li>)}</ul>
              </section>
            ) : null}
            <footer style={styles.footer}>
              <strong>{result.sourcePattern}</strong>
              {result.sources.map((source, index) => (
                <span key={source.id}>
                  [S{index + 1}] {source.title} · {source.board} {source.year} · {Math.round((source.similarity ?? 0) * 100)}%
                </span>
              ))}
            </footer>
          </div>
        ) : (
          <div style={styles.empty}>Choose a topic to generate a paper-style question.</div>
        )}
      </section>
    </main>
  )
}

export default function AdaptiveModePage() {
  return <AuthGuard><AdaptiveModeInner /></AuthGuard>
}

const styles = {
  page: { minHeight: '100vh', background: '#02020c', color: '#ecebff', position: 'relative' } satisfies CSSProperties,
  nav: { height: 62, padding: '0 clamp(18px,4vw,48px)', borderBottom: '1px solid rgba(176,128,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 2 } satisfies CSSProperties,
  navLinks: { display: 'flex', gap: 18 } satisfies CSSProperties,
  navLink: { color: '#aaa7c8', textDecoration: 'none', fontSize: 13 } satisfies CSSProperties,
  shell: { width: 'min(980px, calc(100% - 32px))', margin: '0 auto', padding: '44px 0 72px', position: 'relative', zIndex: 1 } satisfies CSSProperties,
  header: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 } satisfies CSSProperties,
  eyebrow: { color: '#b983ff', fontSize: 12, fontWeight: 800 } satisfies CSSProperties,
  title: { margin: '7px 0 0', fontSize: 'clamp(34px,6vw,58px)', fontWeight: 500 } satisfies CSSProperties,
  controls: { display: 'grid', gridTemplateColumns: '150px 150px 1fr 1.3fr auto', gap: 9, padding: 14, borderTop: '1px solid rgba(176,128,255,.14)', borderBottom: '1px solid rgba(176,128,255,.14)', background: 'rgba(255,255,255,.025)' } satisfies CSSProperties,
  field: { minWidth: 0, height: 44, border: '1px solid rgba(176,128,255,.18)', borderRadius: 6, background: '#090816', color: '#f4f1ff', padding: '0 12px', outline: 'none', colorScheme: 'dark' } satisfies CSSProperties,
  primaryButton: { height: 44, border: 0, borderRadius: 6, background: '#9b4dff', color: 'white', fontWeight: 800, padding: '0 16px', display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' } satisfies CSSProperties,
  error: { color: '#fbbf24' } satisfies CSSProperties,
  result: { marginTop: 28, border: '1px solid rgba(176,128,255,.14)', borderRadius: 8, background: 'rgba(255,255,255,.025)', overflow: 'hidden' } satisfies CSSProperties,
  resultTop: { minHeight: 42, display: 'flex', alignItems: 'center', gap: 16, padding: '0 18px', color: '#aaa7c8', fontSize: 12, borderBottom: '1px solid rgba(176,128,255,.1)' } satisfies CSSProperties,
  type: { textTransform: 'uppercase', color: '#c798ff', fontWeight: 800 } satisfies CSSProperties,
  question: { padding: '24px 22px', fontSize: 18, lineHeight: 1.7 } satisfies CSSProperties,
  options: { display: 'grid', gap: 7 } satisfies CSSProperties,
  answerBand: { padding: '20px 22px', borderTop: '1px solid rgba(176,128,255,.1)', background: 'rgba(130,70,220,.06)' } satisfies CSSProperties,
  stepsBand: { padding: '20px 22px', borderTop: '1px solid rgba(176,128,255,.1)' } satisfies CSSProperties,
  steps: { display: 'grid', gap: 10, lineHeight: 1.6 } satisfies CSSProperties,
  mistakes: { padding: '20px 22px', borderTop: '1px solid rgba(245,158,11,.18)', color: '#f6d895' } satisfies CSSProperties,
  footer: { display: 'grid', gap: 7, padding: '18px 22px', borderTop: '1px solid rgba(176,128,255,.1)', color: '#aaa7c8', fontSize: 12 } satisfies CSSProperties,
  empty: { minHeight: 300, display: 'grid', placeContent: 'center', color: '#777493' } satisfies CSSProperties,
} as const
