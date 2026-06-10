'use client'

import { BookOpen, Calculator, Search, Target } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import AnswerRenderer from '@/components/AnswerRenderer'
import AuthGuard from '@/components/auth/AuthGuard'
import StarBackground from '@/components/StarBackground'
import { buildSupabaseAuthHeaders } from '@/lib/supabase/auth-headers'

type Source = {
  board?: string | null
  id?: string
  paper?: string | null
  questionNumber?: string | number | null
  subject?: string | null
  title?: string
  topic?: string | null
  year?: number | string | null
}

type ExamResult = {
  formulas?: Array<{ formula?: string; meaning?: string; sourceIds?: string[]; whenToUse?: string }>
  importantQuestions?: Array<{ question?: string; sourceIds?: string[]; whyImportant?: string }>
  importantTopics?: Array<{ name?: string; sourceIds?: string[]; whyImportant?: string }>
  observation?: string
  sources?: Source[]
  summary?: string
}

const SUBJECTS = ['Physics', 'Mathematics', 'Chemistry']
const DIFFICULTIES = ['easy', 'medium', 'hard']

async function readJson(response: Response) {
  const text = await response.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return { error: 'The server returned an unreadable response.' }
  }
}

function sourceLine(source: Source) {
  return [
    source.title,
    source.board,
    source.subject,
    source.topic,
    source.year,
    source.paper,
    source.questionNumber ? `Q${source.questionNumber}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

function ExamModeInner() {
  const [subject, setSubject] = useState('Physics')
  const [topic, setTopic] = useState('Kinematics')
  const [difficulty, setDifficulty] = useState('medium')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ExamResult | null>(null)

  async function analyze() {
    if (!subject || !topic.trim()) {
      setError('Subject and topic are required.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/exam-mode', {
        body: JSON.stringify({ difficulty, subject, topic: topic.trim() }),
        headers: await buildSupabaseAuthHeaders({ 'Content-Type': 'application/json' }),
        method: 'POST',
      })
      const data = await readJson(response)
      if (!response.ok) throw new Error(data.error || 'Analysis failed.')
      setResult(data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Analysis failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={styles.page}>
      <StarBackground variant="chat" />
      <section style={styles.shell}>
        <header style={styles.header}>
          <span style={styles.eyebrow}>Exam Mode</span>
          <h1 style={styles.title}>Past-paper priorities</h1>
        </header>

        <div style={styles.controls}>
          <select value={subject} onChange={(event) => setSubject(event.target.value)} style={styles.field}>
            {SUBJECTS.map((item) => <option key={item}>{item}</option>)}
          </select>
          <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Topic" style={styles.field} />
          <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)} style={styles.field}>
            {DIFFICULTIES.map((item) => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}
          </select>
          <button type="button" onClick={() => void analyze()} disabled={loading} style={styles.primary}>
            <Search size={17} />
            {loading ? 'Analysing...' : 'Analyse'}
          </button>
        </div>

        {error ? <p style={styles.error}>{error}</p> : null}

        {result ? (
          <div style={styles.results}>
            <section style={styles.section}>
              <div style={styles.sectionTitle}><Calculator size={19} /> Key formulas</div>
              <div style={styles.grid}>
                {(result.formulas ?? []).map((item, index) => (
                  <article key={`${item.formula}-${index}`} style={styles.card}>
                    <strong style={styles.formula}>{item.formula}</strong>
                    <p>{item.meaning}</p>
                    <p style={styles.muted}>{item.whenToUse}</p>
                    {item.sourceIds?.length ? <small>{item.sourceIds.join(', ')}</small> : null}
                  </article>
                ))}
                {!result.formulas?.length ? <p style={styles.muted}>No formula was extracted from the retrieved chunks.</p> : null}
              </div>
            </section>

            <section style={styles.section}>
              <div style={styles.sectionTitle}><Target size={19} /> Observation</div>
              <article style={styles.card}>
                <AnswerRenderer content={result.observation || result.summary || 'No observation returned yet.'} />
              </article>
            </section>

            <section style={styles.section}>
              <div style={styles.sectionTitle}><Target size={19} /> Important topics</div>
              <div style={styles.grid}>
                {(result.importantTopics ?? []).map((item, index) => (
                  <article key={`${item.name}-${index}`} style={styles.card}>
                    <strong>{item.name}</strong>
                    <p>{item.whyImportant}</p>
                    {item.sourceIds?.length ? <small>{item.sourceIds.join(', ')}</small> : null}
                  </article>
                ))}
              </div>
            </section>

            <section style={styles.section}>
              <div style={styles.sectionTitle}><BookOpen size={19} /> Important questions</div>
              <div style={styles.list}>
                {(result.importantQuestions ?? []).slice(0, 5).map((item, index) => (
                  <article key={`${item.question}-${index}`} style={styles.card}>
                    <strong>{item.question}</strong>
                    <p>{item.whyImportant}</p>
                    {item.sourceIds?.length ? <small>{item.sourceIds.join(', ')}</small> : null}
                  </article>
                ))}
              </div>
            </section>

            <section style={styles.section}>
              <div style={styles.sectionTitle}>Retrieved evidence</div>
              <div style={styles.sources}>
                {(result.sources ?? []).slice(0, 8).map((source, index) => (
                  <span key={`${source.id}-${index}`}>{sourceLine(source)}</span>
                ))}
              </div>
            </section>
          </div>
        ) : (
          <div style={styles.empty}>Choose a subject and topic to analyse.</div>
        )}
      </section>
    </main>
  )
}

export default function ExamModePage() {
  return (
    <AuthGuard>
      <ExamModeInner />
    </AuthGuard>
  )
}

const styles = {
  card: {
    background: 'rgba(255,255,255,.032)',
    border: '1px solid rgba(176,128,255,.14)',
    borderRadius: 8,
    lineHeight: 1.65,
    padding: 16,
  } satisfies CSSProperties,
  controls: {
    background: 'rgba(255,255,255,.025)',
    border: '1px solid rgba(176,128,255,.12)',
    borderRadius: 8,
    display: 'grid',
    gap: 10,
    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
    padding: 14,
  } satisfies CSSProperties,
  empty: {
    color: '#aaa7c8',
    display: 'grid',
    minHeight: 260,
    placeItems: 'center',
  } satisfies CSSProperties,
  error: { color: '#fbbf24' } satisfies CSSProperties,
  eyebrow: { color: '#b983ff', fontSize: 12, fontWeight: 850, textTransform: 'uppercase' } satisfies CSSProperties,
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
  formula: { color: '#f3d9ff', display: 'block', fontSize: 18, marginBottom: 8 } satisfies CSSProperties,
  grid: { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' } satisfies CSSProperties,
  header: { display: 'grid', gap: 8 } satisfies CSSProperties,
  list: { display: 'grid', gap: 12 } satisfies CSSProperties,
  muted: { color: '#aaa7c8' } satisfies CSSProperties,
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
  results: { display: 'grid', gap: 28 } satisfies CSSProperties,
  section: { display: 'grid', gap: 12 } satisfies CSSProperties,
  sectionTitle: { alignItems: 'center', color: '#c798ff', display: 'flex', fontSize: 18, fontWeight: 850, gap: 8 } satisfies CSSProperties,
  shell: { display: 'grid', gap: 22, margin: '0 auto', padding: '42px 16px 72px', position: 'relative', width: 'min(1120px,100%)', zIndex: 1 } satisfies CSSProperties,
  sources: { color: '#bdb7d5', display: 'grid', fontSize: 13, gap: 7 } satisfies CSSProperties,
  title: { fontSize: 'clamp(34px,6vw,64px)', fontWeight: 520, lineHeight: 1, margin: 0 } satisfies CSSProperties,
} as const
