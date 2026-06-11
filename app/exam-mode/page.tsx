'use client'

import { Search } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import AnswerRenderer from '@/components/AnswerRenderer'
import AuthGuard from '@/components/auth/AuthGuard'
import StarBackground from '@/components/StarBackground'
import { buildSupabaseAuthHeaders } from '@/lib/supabase/auth-headers'

type PastPaperQuestion = {
  id: string
  markScheme: string
  marks: number
  paper?: string | null
  questionNumber?: string | number | null
  questionText: string
  sourceTitle?: string
  year?: number | string | null
}

type ExamResult = {
  questions?: PastPaperQuestion[]
}

const SUBJECTS = ['Physics', 'Mathematics', 'Chemistry']

async function readJson(response: Response) {
  const text = await response.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return { error: 'The server returned an unreadable response.' }
  }
}

function errorMessage(value: unknown, fallback: string) {
  if (typeof value === 'string' && value.trim()) return value
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (typeof record.message === 'string') return record.message
    if (typeof record.error === 'string') return record.error
  }
  return fallback
}

function ExamModeInner() {
  const [subject, setSubject] = useState('Physics')
  const [topic, setTopic] = useState('Kinematics')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ExamResult | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  async function loadQuestions() {
    if (!subject || !topic.trim()) {
      setError('Subject and topic are required.')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)
    try {
      const response = await fetch('/api/exam-mode', {
        body: JSON.stringify({ subject, topic: topic.trim() }),
        headers: await buildSupabaseAuthHeaders({ 'Content-Type': 'application/json' }),
        method: 'POST',
      })
      const data = await readJson(response)
      if (!response.ok) throw new Error(errorMessage(data.error, 'Could not load questions.'))
      setResult(data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load questions.')
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
          <h1 style={styles.title}>Past-paper questions</h1>
        </header>

        <div style={styles.controls}>
          <select value={subject} onChange={(event) => setSubject(event.target.value)} style={styles.field}>
            {SUBJECTS.map((item) => <option key={item}>{item}</option>)}
          </select>
          <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Topic" style={styles.field} />
          <button type="button" onClick={() => void loadQuestions()} disabled={loading} style={styles.primary}>
            <Search size={17} />
            {loading ? 'Loading...' : 'Load Questions'}
          </button>
        </div>

        {error ? <p style={styles.error}>{error}</p> : null}

        {result?.questions?.length ? (
          <div style={styles.list}>
            {result.questions.map((question, index) => {
              const isOpen = openId === question.id
              return (
                <article key={question.id} style={styles.card}>
                  <div style={styles.cardHeader}>
                    <strong>Question {index + 1}</strong>
                    <span style={styles.meta}>
                      {question.marks} marks
                      {question.paper ? ` · ${question.paper}` : ''}
                      {question.year ? ` · ${question.year}` : ''}
                      {question.questionNumber ? ` · Q${question.questionNumber}` : ''}
                    </span>
                  </div>
                  <AnswerRenderer content={question.questionText} />
                  <button type="button" onClick={() => setOpenId(isOpen ? null : question.id)} style={styles.secondary}>
                    {isOpen ? 'Hide Mark Scheme' : 'Show Mark Scheme'}
                  </button>
                  {isOpen ? (
                    <div style={styles.scheme}>
                      <AnswerRenderer content={question.markScheme} />
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        ) : result ? (
          <div style={styles.empty}>No questions found.</div>
        ) : (
          <div style={styles.empty}>Choose a subject and topic.</div>
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
    display: 'grid',
    gap: 12,
    lineHeight: 1.65,
    padding: 16,
  } satisfies CSSProperties,
  cardHeader: { alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' } satisfies CSSProperties,
  controls: {
    background: 'rgba(255,255,255,.025)',
    border: '1px solid rgba(176,128,255,.12)',
    borderRadius: 8,
    display: 'grid',
    gap: 10,
    gridTemplateColumns: 'minmax(160px,.6fr) minmax(240px,1.4fr) auto',
    padding: 14,
  } satisfies CSSProperties,
  empty: { color: '#aaa7c8', display: 'grid', minHeight: 260, placeItems: 'center' } satisfies CSSProperties,
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
  header: { display: 'grid', gap: 8 } satisfies CSSProperties,
  list: { display: 'grid', gap: 14 } satisfies CSSProperties,
  meta: { color: '#aaa7c8', fontSize: 13 } satisfies CSSProperties,
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
  scheme: {
    background: '#080716',
    border: '1px solid rgba(176,128,255,.12)',
    borderRadius: 8,
    padding: 14,
  } satisfies CSSProperties,
  secondary: {
    background: 'rgba(255,255,255,.04)',
    border: '1px solid rgba(176,128,255,.18)',
    borderRadius: 8,
    color: '#e9d5ff',
    cursor: 'pointer',
    fontWeight: 800,
    justifySelf: 'start',
    padding: '9px 12px',
  } satisfies CSSProperties,
  shell: { display: 'grid', gap: 22, margin: '0 auto', padding: '42px 16px 72px', position: 'relative', width: 'min(1120px,100%)', zIndex: 1 } satisfies CSSProperties,
  title: { fontSize: 'clamp(34px,6vw,64px)', fontWeight: 520, lineHeight: 1, margin: 0 } satisfies CSSProperties,
} as const
