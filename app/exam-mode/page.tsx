'use client'

import { BookOpen, Calculator, Search, Target } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import AuthGuard from '@/components/auth/AuthGuard'
import Logo from '@/components/Logo'
import ProductNav from '@/components/ProductNav'
import StarBackground from '@/components/StarBackground'
import { buildSupabaseAuthHeaders } from '@/lib/supabase/auth-headers'

type Source = {
  id: string
  title: string
  url: string | null
  board: string | null
  year: number | string | null
  paper: string | null
  questionNumber: string | number | null
  similarity: number | null
}

type ExamResult = {
  subject: string
  topic: string
  confidenceScore: number
  confidenceLabel: string
  retrievalMode: string
  importantTopics: Array<{
    name?: string
    importance?: string
    whyImportant?: string
    sourceIds?: string[]
  }>
  formulas: Array<{
    formula?: string
    meaning?: string
    whenToUse?: string
    sourceIds?: string[]
  }>
  importantQuestions: Array<{
    question?: string
    whyImportant?: string
    sourceIds?: string[]
  }>
  summary: string
  sources: Source[]
}

const SUBJECTS = ['Physics', 'Mathematics', 'Chemistry']
const BOARDS = ['Cambridge', 'Edexcel', 'Any']

function sourceLabel(source: Source) {
  return [
    source.board,
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
  const [board, setBoard] = useState('Cambridge')
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
        method: 'POST',
        headers: await buildSupabaseAuthHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          subject,
          topic: topic.trim(),
          board: board === 'Any' ? null : board,
        }),
      })
      const data = (await response.json()) as ExamResult & { error?: string }
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
      <style>{`
        @media (max-width: 760px) {
          .exam-rag-controls {
            grid-template-columns: 1fr !important;
          }
          .exam-rag-header {
            align-items: flex-start !important;
            flex-direction: column !important;
          }
          .exam-rag-source {
            align-items: flex-start !important;
            flex-direction: column !important;
          }
        }
      `}</style>
      <nav style={styles.nav}>
        <Logo compact />
        <ProductNav compact style={styles.navLinks} />
      </nav>

      <section style={styles.shell}>
        <header className="exam-rag-header" style={styles.header}>
          <div>
            <div style={styles.eyebrow}>EXAM MODE</div>
            <h1 style={styles.title}>Past-paper priorities</h1>
          </div>
          {result ? (
            <div style={styles.confidence}>
              <strong>{result.confidenceScore}%</strong>
              <span>{result.confidenceLabel.replaceAll('_', ' ')}</span>
            </div>
          ) : null}
        </header>

        <div className="exam-rag-controls" style={styles.controls}>
          <label style={styles.label}>
            Subject
            <select value={subject} onChange={(event) => setSubject(event.target.value)} style={styles.field}>
              {SUBJECTS.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label style={styles.label}>
            Board
            <select value={board} onChange={(event) => setBoard(event.target.value)} style={styles.field}>
              {BOARDS.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label style={{ ...styles.label, ...styles.topicLabel }}>
            Topic
            <input value={topic} onChange={(event) => setTopic(event.target.value)} style={styles.field} />
          </label>
          <button type="button" onClick={() => void analyze()} disabled={loading} style={styles.primaryButton}>
            <Search size={17} />
            {loading ? 'Analysing...' : 'Analyse'}
          </button>
        </div>

        {error ? <p style={styles.error}>{error}</p> : null}

        {result ? (
          <div style={styles.results}>
            <section style={styles.band}>
              <div style={styles.sectionHeading}>
                <Target size={20} />
                <h2>Important topics</h2>
              </div>
              <div style={styles.grid}>
                {result.importantTopics.map((item, index) => (
                  <article key={`${item.name}-${index}`} style={styles.item}>
                    <div style={styles.itemTop}>
                      <strong>{item.name}</strong>
                      <span style={styles.tag}>{item.importance || 'medium'}</span>
                    </div>
                    <p>{item.whyImportant}</p>
                    <small>{item.sourceIds?.join(', ')}</small>
                  </article>
                ))}
              </div>
            </section>

            <section style={styles.band}>
              <div style={styles.sectionHeading}>
                <Calculator size={20} />
                <h2>Key formulas</h2>
              </div>
              <div style={styles.grid}>
                {result.formulas.map((item, index) => (
                  <article key={`${item.formula}-${index}`} style={styles.item}>
                    <strong style={styles.formula}>{item.formula}</strong>
                    <p>{item.meaning}</p>
                    <p style={styles.muted}>{item.whenToUse}</p>
                    <small>{item.sourceIds?.join(', ')}</small>
                  </article>
                ))}
              </div>
            </section>

            <section style={styles.band}>
              <div style={styles.sectionHeading}>
                <BookOpen size={20} />
                <h2>Important questions</h2>
              </div>
              <div style={styles.questionList}>
                {result.importantQuestions.map((item, index) => (
                  <article key={`${item.question}-${index}`} style={styles.item}>
                    <strong>{item.question}</strong>
                    <p>{item.whyImportant}</p>
                    <small>{item.sourceIds?.join(', ')}</small>
                  </article>
                ))}
              </div>
            </section>

            <section style={styles.sourceBand}>
              <h2 style={styles.sourceTitle}>Retrieved evidence</h2>
              <p style={styles.summary}>{result.summary}</p>
              <div style={styles.sources}>
                {result.sources.map((source, index) => (
                  <a
                    key={source.id}
                    className="exam-rag-source"
                    href={source.url || undefined}
                    target={source.url ? '_blank' : undefined}
                    rel={source.url ? 'noreferrer' : undefined}
                    style={styles.source}
                  >
                    <span>[S{index + 1}] {source.title}</span>
                    <small>{sourceLabel(source)} · {Math.round((source.similarity ?? 0) * 100)}%</small>
                  </a>
                ))}
                {!result.sources.length ? (
                  <p style={styles.muted}>No matching document is indexed for this topic yet.</p>
                ) : null}
              </div>
            </section>
          </div>
        ) : (
          <div style={styles.empty}>
            <Search size={28} />
            <span>Select a subject and topic.</span>
          </div>
        )}
      </section>
    </main>
  )
}

export default function ExamModePage() {
  return <AuthGuard><ExamModeInner /></AuthGuard>
}

const styles = {
  page: { minHeight: '100vh', background: '#02020c', color: '#ecebff', position: 'relative' } satisfies CSSProperties,
  nav: { height: 62, padding: '0 clamp(18px,4vw,48px)', borderBottom: '1px solid rgba(176,128,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 2 } satisfies CSSProperties,
  navLinks: { display: 'flex', gap: 18 } satisfies CSSProperties,
  shell: { width: 'min(1180px, calc(100% - 32px))', margin: '0 auto', padding: '44px 0 70px', position: 'relative', zIndex: 1 } satisfies CSSProperties,
  header: { display: 'flex', alignItems: 'end', justifyContent: 'space-between', gap: 20, marginBottom: 24 } satisfies CSSProperties,
  eyebrow: { color: '#b983ff', fontSize: 12, fontWeight: 800 } satisfies CSSProperties,
  title: { margin: '8px 0 0', fontSize: 'clamp(34px,6vw,62px)', fontWeight: 500 } satisfies CSSProperties,
  confidence: { display: 'grid', textAlign: 'right', gap: 3, color: '#bdb9da', fontSize: 11 } satisfies CSSProperties,
  controls: { display: 'grid', gridTemplateColumns: '180px 180px minmax(220px,1fr) auto', gap: 10, alignItems: 'end', padding: 14, borderTop: '1px solid rgba(176,128,255,.14)', borderBottom: '1px solid rgba(176,128,255,.14)', background: 'rgba(255,255,255,.025)' } satisfies CSSProperties,
  label: { display: 'grid', gap: 7, color: '#aaa7c8', fontSize: 12 } satisfies CSSProperties,
  topicLabel: {} satisfies CSSProperties,
  field: { height: 44, border: '1px solid rgba(176,128,255,.18)', borderRadius: 6, background: '#090816', color: '#f4f1ff', padding: '0 12px', outline: 'none', colorScheme: 'dark' } satisfies CSSProperties,
  primaryButton: { height: 44, border: 0, borderRadius: 6, background: '#9b4dff', color: 'white', fontWeight: 800, padding: '0 18px', display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' } satisfies CSSProperties,
  error: { color: '#fbbf24', margin: '14px 0 0' } satisfies CSSProperties,
  results: { display: 'grid', gap: 30, marginTop: 32 } satisfies CSSProperties,
  band: { display: 'grid', gap: 14 } satisfies CSSProperties,
  sectionHeading: { display: 'flex', gap: 9, alignItems: 'center', color: '#c798ff' } satisfies CSSProperties,
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 10 } satisfies CSSProperties,
  questionList: { display: 'grid', gap: 10 } satisfies CSSProperties,
  item: { border: '1px solid rgba(176,128,255,.13)', borderRadius: 8, background: 'rgba(255,255,255,.028)', padding: 16, lineHeight: 1.6 } satisfies CSSProperties,
  itemTop: { display: 'flex', justifyContent: 'space-between', gap: 12 } satisfies CSSProperties,
  tag: { color: '#facc15', fontSize: 11, textTransform: 'uppercase' } satisfies CSSProperties,
  formula: { color: '#f5dcff', fontFamily: 'Georgia,serif', fontSize: 19 } satisfies CSSProperties,
  muted: { color: '#aaa7c8' } satisfies CSSProperties,
  sourceBand: { borderTop: '1px solid rgba(176,128,255,.14)', paddingTop: 22 } satisfies CSSProperties,
  sourceTitle: { fontSize: 18, margin: 0 } satisfies CSSProperties,
  summary: { color: '#c9c6df', lineHeight: 1.7 } satisfies CSSProperties,
  sources: { display: 'grid', gap: 7 } satisfies CSSProperties,
  source: { color: '#d9c3ff', textDecoration: 'none', display: 'flex', justifyContent: 'space-between', gap: 14, borderBottom: '1px solid rgba(176,128,255,.08)', padding: '9px 0' } satisfies CSSProperties,
  empty: { minHeight: 300, display: 'grid', placeContent: 'center', justifyItems: 'center', gap: 12, color: '#777493' } satisfies CSSProperties,
} as const
