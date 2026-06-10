'use client'

import { Brain, RefreshCw, Sparkles } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import AnswerRenderer from '@/components/AnswerRenderer'
import AuthGuard from '@/components/auth/AuthGuard'
import StarBackground from '@/components/StarBackground'
import { buildSupabaseAuthHeaders } from '@/lib/supabase/auth-headers'

type AdaptiveResult = {
  answer?: string
  commonMistakes?: string[]
  explanation?: string[]
  question?: {
    marks?: number
    options?: string[]
    text?: string
    type?: string
  }
  sourcePattern?: string
}

async function readJson(response: Response) {
  const text = await response.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return { error: 'The server returned an unreadable response.' }
  }
}

function AdaptiveModeInner() {
  const [subject, setSubject] = useState('Physics')
  const [topic, setTopic] = useState('Kinematics')
  const [difficulty, setDifficulty] = useState('medium')
  const [performance, setPerformance] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<AdaptiveResult | null>(null)

  async function generate() {
    if (!subject || !topic.trim()) {
      setError('Subject and topic are required.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/adaptive-mode', {
        body: JSON.stringify({ difficulty, performance, subject, topic: topic.trim() }),
        headers: await buildSupabaseAuthHeaders({ 'Content-Type': 'application/json' }),
        method: 'POST',
      })
      const data = await readJson(response)
      if (!response.ok) throw new Error(data.error || 'Question generation failed.')
      setResult(data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Question generation failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={styles.page}>
      <StarBackground variant="chat" />
      <section style={styles.shell}>
        <header style={styles.header}>
          <Brain size={30} color="#ba7cff" />
          <div>
            <span style={styles.eyebrow}>Adaptive Mode</span>
            <h1 style={styles.title}>Generate one exam-style question.</h1>
          </div>
        </header>

        <div style={styles.controls}>
          <select value={subject} onChange={(event) => setSubject(event.target.value)} style={styles.field}>
            <option>Physics</option>
            <option>Mathematics</option>
            <option>Chemistry</option>
          </select>
          <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Topic" style={styles.field} />
          <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)} style={styles.field}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
          <input value={performance} onChange={(event) => setPerformance(event.target.value)} placeholder="Previous score (optional)" style={styles.field} />
          <button type="button" onClick={() => void generate()} disabled={loading} style={styles.primary}>
            {loading ? <RefreshCw size={17} /> : <Sparkles size={17} />}
            {loading ? 'Generating...' : 'Generate'}
          </button>
        </div>

        {error ? <p style={styles.error}>{error}</p> : null}

        {result ? (
          <article style={styles.result}>
            <div style={styles.meta}>
              <span>{result.question?.type || 'structured'}</span>
              <span>{result.question?.marks ?? 0} marks</span>
            </div>
            <section style={styles.block}>
              <h2>Question</h2>
              <AnswerRenderer content={result.question?.text || ''} />
              {result.question?.options?.length ? (
                <ol style={styles.list}>
                  {result.question.options.map((option) => <li key={option}>{option}</li>)}
                </ol>
              ) : null}
            </section>
            <section style={styles.block}>
              <h2>Answer</h2>
              <AnswerRenderer content={result.answer || ''} />
            </section>
            <section style={styles.block}>
              <h2>Step-by-step reasoning</h2>
              <ol style={styles.list}>
                {(result.explanation ?? []).map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}
              </ol>
            </section>
            {result.commonMistakes?.length ? (
              <section style={styles.block}>
                <h2>Common mistakes</h2>
                <ul style={styles.list}>{result.commonMistakes.map((mistake) => <li key={mistake}>{mistake}</li>)}</ul>
              </section>
            ) : null}
            {result.sourcePattern ? <p style={styles.muted}>{result.sourcePattern}</p> : null}
          </article>
        ) : (
          <div style={styles.empty}>Choose a topic to generate a paper-style question.</div>
        )}
      </section>
    </main>
  )
}

export default function AdaptiveModePage() {
  return (
    <AuthGuard>
      <AdaptiveModeInner />
    </AuthGuard>
  )
}

const styles = {
  block: { borderTop: '1px solid rgba(176,128,255,.12)', display: 'grid', gap: 10, padding: 18 } satisfies CSSProperties,
  controls: {
    background: 'rgba(255,255,255,.025)',
    border: '1px solid rgba(176,128,255,.12)',
    borderRadius: 8,
    display: 'grid',
    gap: 10,
    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
    padding: 14,
  } satisfies CSSProperties,
  empty: { color: '#aaa7c8', display: 'grid', minHeight: 260, placeItems: 'center' } satisfies CSSProperties,
  error: { color: '#fbbf24' } satisfies CSSProperties,
  eyebrow: { color: '#b983ff', display: 'block', fontSize: 12, fontWeight: 850, textTransform: 'uppercase' } satisfies CSSProperties,
  field: {
    background: '#090816',
    border: '1px solid rgba(176,128,255,.18)',
    borderRadius: 8,
    color: '#f4f1ff',
    height: 44,
    minWidth: 0,
    outline: 'none',
    padding: '0 12px',
  } satisfies CSSProperties,
  header: { alignItems: 'center', display: 'flex', gap: 14 } satisfies CSSProperties,
  list: { display: 'grid', gap: 8, lineHeight: 1.7, marginLeft: 22 } satisfies CSSProperties,
  meta: {
    color: '#c798ff',
    display: 'flex',
    flexWrap: 'wrap',
    fontSize: 13,
    fontWeight: 850,
    gap: 16,
    padding: '14px 18px',
    textTransform: 'uppercase',
  } satisfies CSSProperties,
  muted: { color: '#aaa7c8', lineHeight: 1.6, padding: '0 18px 18px' } satisfies CSSProperties,
  page: { background: '#02020c', color: '#ecebff', minHeight: 'calc(100vh - 74px)', position: 'relative' } satisfies CSSProperties,
  primary: {
    alignItems: 'center',
    background: '#9b4dff',
    border: 0,
    borderRadius: 8,
    color: '#fff',
    cursor: 'pointer',
    display: 'inline-flex',
    fontWeight: 850,
    gap: 8,
    height: 44,
    justifyContent: 'center',
    padding: '0 18px',
  } satisfies CSSProperties,
  result: {
    background: 'rgba(255,255,255,.032)',
    border: '1px solid rgba(176,128,255,.14)',
    borderRadius: 8,
    overflow: 'hidden',
  } satisfies CSSProperties,
  shell: { display: 'grid', gap: 22, margin: '0 auto', padding: '42px 16px 72px', position: 'relative', width: 'min(1040px,100%)', zIndex: 1 } satisfies CSSProperties,
  title: { fontSize: 'clamp(34px,6vw,58px)', fontWeight: 520, lineHeight: 1, margin: '8px 0 0' } satisfies CSSProperties,
} as const
