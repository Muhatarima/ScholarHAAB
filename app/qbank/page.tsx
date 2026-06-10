'use client'

import { BarChart3, ListChecks, Search } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import AuthGuard from '@/components/auth/AuthGuard'
import StarBackground from '@/components/StarBackground'
import { buildSupabaseAuthHeaders } from '@/lib/supabase/auth-headers'

type QbankResult = {
  difficultyLevels?: Array<{ evidence?: string; level?: string; sourceIds?: string[] }>
  practiceQuestions?: Array<{ question?: string; sourceIds?: string[]; whyPractice?: string }>
  repeatedConcepts?: Array<{ concept?: string; frequencyHint?: string; sourceIds?: string[] }>
  sources?: Array<{ id?: string; title?: string }>
  studyPlan?: string[]
  summary?: string
}

async function readJson(response: Response) {
  const text = await response.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return { error: 'The server returned an unreadable response.' }
  }
}

function QbankInner() {
  const [subject, setSubject] = useState('Physics')
  const [topic, setTopic] = useState('Waves')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<QbankResult | null>(null)

  async function analyze() {
    if (!subject || !topic.trim()) {
      setError('Subject and topic are required.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/qbank', {
        body: JSON.stringify({ action: 'analysis', subject, topic: topic.trim() }),
        headers: await buildSupabaseAuthHeaders({ 'Content-Type': 'application/json' }),
        method: 'POST',
      })
      const data = await readJson(response)
      if (!response.ok) throw new Error(data.error || 'QBank analysis failed.')
      setResult(data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'QBank analysis failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={styles.page}>
      <StarBackground variant="chat" />
      <section style={styles.shell}>
        <header style={styles.header}>
          <span style={styles.eyebrow}>QBank</span>
          <h1 style={styles.title}>Find the repeated patterns.</h1>
        </header>

        <div style={styles.controls}>
          <select value={subject} onChange={(event) => setSubject(event.target.value)} style={styles.field}>
            <option>Physics</option>
            <option>Mathematics</option>
            <option>Chemistry</option>
          </select>
          <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Topic" style={styles.field} />
          <button type="button" onClick={() => void analyze()} disabled={loading} style={styles.primary}>
            <Search size={17} />
            {loading ? 'Analysing...' : 'Analyse'}
          </button>
        </div>

        {error ? <p style={styles.error}>{error}</p> : null}

        {result ? (
          <div style={styles.results}>
            <section style={styles.section}>
              <div style={styles.sectionTitle}><ListChecks size={19} /> Most repeated concepts</div>
              <div style={styles.grid}>
                {(result.repeatedConcepts ?? []).map((item, index) => (
                  <article key={`${item.concept}-${index}`} style={styles.card}>
                    <strong>{item.concept}</strong>
                    <p>{item.frequencyHint}</p>
                    {item.sourceIds?.length ? <small>{item.sourceIds.join(', ')}</small> : null}
                  </article>
                ))}
              </div>
            </section>

            <section style={styles.section}>
              <div style={styles.sectionTitle}><BarChart3 size={19} /> Difficulty distribution</div>
              <div style={styles.grid}>
                {(result.difficultyLevels ?? []).map((item, index) => (
                  <article key={`${item.level}-${index}`} style={styles.card}>
                    <strong>{item.level}</strong>
                    <p>{item.evidence}</p>
                    {item.sourceIds?.length ? <small>{item.sourceIds.join(', ')}</small> : null}
                  </article>
                ))}
              </div>
            </section>

            <section style={styles.section}>
              <div style={styles.sectionTitle}>Top 3 practice questions</div>
              <div style={styles.list}>
                {(result.practiceQuestions ?? []).slice(0, 3).map((item, index) => (
                  <article key={`${item.question}-${index}`} style={styles.card}>
                    <strong>{item.question}</strong>
                    <p>{item.whyPractice}</p>
                    {item.sourceIds?.length ? <small>{item.sourceIds.join(', ')}</small> : null}
                  </article>
                ))}
              </div>
            </section>

            <section style={styles.section}>
              <div style={styles.sectionTitle}>Study plan</div>
              <ol style={styles.plan}>
                {(result.studyPlan ?? []).map((item) => <li key={item}>{item}</li>)}
              </ol>
              {result.summary ? <p style={styles.muted}>{result.summary}</p> : null}
            </section>
          </div>
        ) : (
          <div style={styles.empty}>Pick a subject and topic to inspect the question bank.</div>
        )}
      </section>
    </main>
  )
}

export default function QBankPage() {
  return (
    <AuthGuard>
      <QbankInner />
    </AuthGuard>
  )
}

const styles = {
  card: { background: 'rgba(255,255,255,.032)', border: '1px solid rgba(176,128,255,.14)', borderRadius: 8, lineHeight: 1.65, padding: 16 } satisfies CSSProperties,
  controls: { background: 'rgba(255,255,255,.025)', border: '1px solid rgba(176,128,255,.12)', borderRadius: 8, display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', padding: 14 } satisfies CSSProperties,
  empty: { color: '#aaa7c8', display: 'grid', minHeight: 260, placeItems: 'center' } satisfies CSSProperties,
  error: { color: '#fbbf24' } satisfies CSSProperties,
  eyebrow: { color: '#b983ff', fontSize: 12, fontWeight: 850, textTransform: 'uppercase' } satisfies CSSProperties,
  field: { background: '#090816', border: '1px solid rgba(176,128,255,.18)', borderRadius: 8, color: '#f4f1ff', height: 44, minWidth: 0, outline: 'none', padding: '0 12px' } satisfies CSSProperties,
  grid: { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' } satisfies CSSProperties,
  header: { display: 'grid', gap: 8 } satisfies CSSProperties,
  list: { display: 'grid', gap: 12 } satisfies CSSProperties,
  muted: { color: '#aaa7c8', lineHeight: 1.65 } satisfies CSSProperties,
  page: { background: '#02020c', color: '#ecebff', minHeight: 'calc(100vh - 74px)', position: 'relative' } satisfies CSSProperties,
  plan: { display: 'grid', gap: 8, lineHeight: 1.7, marginLeft: 22 } satisfies CSSProperties,
  primary: { alignItems: 'center', background: '#9b4dff', border: 0, borderRadius: 8, color: '#fff', cursor: 'pointer', display: 'inline-flex', fontWeight: 850, gap: 8, height: 44, justifyContent: 'center', padding: '0 18px' } satisfies CSSProperties,
  results: { display: 'grid', gap: 28 } satisfies CSSProperties,
  section: { display: 'grid', gap: 12 } satisfies CSSProperties,
  sectionTitle: { alignItems: 'center', color: '#c798ff', display: 'flex', fontSize: 18, fontWeight: 850, gap: 8 } satisfies CSSProperties,
  shell: { display: 'grid', gap: 22, margin: '0 auto', padding: '42px 16px 72px', position: 'relative', width: 'min(1120px,100%)', zIndex: 1 } satisfies CSSProperties,
  title: { fontSize: 'clamp(34px,6vw,62px)', fontWeight: 520, lineHeight: 1, margin: 0 } satisfies CSSProperties,
} as const
