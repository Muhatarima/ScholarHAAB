'use client'

import { Lightbulb, Search } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import AnswerRenderer from '@/components/AnswerRenderer'
import AuthGuard from '@/components/auth/AuthGuard'
import StarBackground from '@/components/StarBackground'
import { buildSupabaseAuthHeaders } from '@/lib/supabase/auth-headers'

type SkippedResult = {
  concept?: string
  explanation?: string
  practicePrompt?: string
  sources?: Array<{ id?: string; title?: string }>
}

async function readJson(response: Response) {
  const text = await response.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return { error: 'The server returned an unreadable response.' }
  }
}

function SkippedInner() {
  const [subject, setSubject] = useState('Physics')
  const [topic, setTopic] = useState('')
  const [confusion, setConfusion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<SkippedResult | null>(null)

  async function explain() {
    if (!topic.trim()) {
      setError('Topic is required.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/skipped', {
        body: JSON.stringify({ confusion, subject, topic: topic.trim() }),
        headers: await buildSupabaseAuthHeaders({ 'Content-Type': 'application/json' }),
        method: 'POST',
      })
      const data = await readJson(response)
      if (!response.ok) throw new Error(data.error || 'Alternative explanation failed.')
      setResult(data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Alternative explanation failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={styles.page}>
      <StarBackground variant="chat" />
      <section style={styles.shell}>
        <header style={styles.header}>
          <Lightbulb size={30} color="#ba7cff" />
          <div>
            <span style={styles.eyebrow}>Alternative Explanation</span>
            <h1 style={styles.title}>Try the same idea from another angle.</h1>
          </div>
        </header>

        <div style={styles.controls}>
          <select value={subject} onChange={(event) => setSubject(event.target.value)} style={styles.field}>
            <option>Physics</option>
            <option>Mathematics</option>
            <option>Chemistry</option>
          </select>
          <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Topic" style={styles.field} />
          <input value={confusion} onChange={(event) => setConfusion(event.target.value)} placeholder="What feels unclear? (optional)" style={styles.field} />
          <button type="button" onClick={() => void explain()} disabled={loading} style={styles.primary}>
            <Search size={17} />
            {loading ? 'Finding...' : 'Explain'}
          </button>
        </div>

        {error ? <p style={styles.error}>{error}</p> : null}

        {result ? (
          <article style={styles.card}>
            <h2>{result.concept || topic}</h2>
            <AnswerRenderer content={result.explanation || ''} />
            {result.practicePrompt ? (
              <div style={styles.practice}>
                <strong>Try this</strong>
                <p>{result.practicePrompt}</p>
              </div>
            ) : null}
            {result.sources?.length ? (
              <div style={styles.sources}>
                <strong>Sources</strong>
                {result.sources.slice(0, 4).map((source, index) => (
                  <span key={`${source.id}-${index}`}>{source.title}</span>
                ))}
              </div>
            ) : null}
          </article>
        ) : (
          <div style={styles.empty}>Enter a topic you want explained differently.</div>
        )}
      </section>
    </main>
  )
}

export default function SkippedPage() {
  return (
    <AuthGuard>
      <SkippedInner />
    </AuthGuard>
  )
}

const styles = {
  card: { background: 'rgba(255,255,255,.032)', border: '1px solid rgba(176,128,255,.14)', borderRadius: 8, display: 'grid', gap: 12, padding: 18 } satisfies CSSProperties,
  controls: { background: 'rgba(255,255,255,.025)', border: '1px solid rgba(176,128,255,.12)', borderRadius: 8, display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', padding: 14 } satisfies CSSProperties,
  empty: { color: '#aaa7c8', display: 'grid', minHeight: 260, placeItems: 'center' } satisfies CSSProperties,
  error: { color: '#fbbf24' } satisfies CSSProperties,
  eyebrow: { color: '#b983ff', display: 'block', fontSize: 12, fontWeight: 850, textTransform: 'uppercase' } satisfies CSSProperties,
  field: { background: '#090816', border: '1px solid rgba(176,128,255,.18)', borderRadius: 8, color: '#f4f1ff', height: 44, minWidth: 0, outline: 'none', padding: '0 12px' } satisfies CSSProperties,
  header: { alignItems: 'center', display: 'flex', gap: 14 } satisfies CSSProperties,
  page: { background: '#02020c', color: '#ecebff', minHeight: 'calc(100vh - 74px)', position: 'relative' } satisfies CSSProperties,
  practice: { borderLeft: '3px solid #a855f7', color: '#e9d5ff', lineHeight: 1.6, paddingLeft: 12 } satisfies CSSProperties,
  primary: { alignItems: 'center', background: '#9b4dff', border: 0, borderRadius: 8, color: '#fff', cursor: 'pointer', display: 'inline-flex', fontWeight: 850, gap: 8, height: 44, justifyContent: 'center', padding: '0 18px' } satisfies CSSProperties,
  shell: { display: 'grid', gap: 22, margin: '0 auto', padding: '42px 16px 72px', position: 'relative', width: 'min(980px,100%)', zIndex: 1 } satisfies CSSProperties,
  sources: { borderTop: '1px solid rgba(176,128,255,.12)', color: '#bdb7d5', display: 'grid', fontSize: 13, gap: 7, paddingTop: 12 } satisfies CSSProperties,
  title: { fontSize: 'clamp(34px,6vw,58px)', fontWeight: 520, lineHeight: 1, margin: '8px 0 0' } satisfies CSSProperties,
} as const
