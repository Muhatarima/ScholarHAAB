'use client'

import { useMemo, useState, type CSSProperties } from 'react'
import AnswerRenderer from '@/components/AnswerRenderer'
import AuthGuard from '@/components/auth/AuthGuard'
import Logo from '@/components/Logo'
import ProductNav from '@/components/ProductNav'
import StarBackground from '@/components/StarBackground'
import { SUBJECTS } from '@/lib/profile/setupOptions'
import { gradeMockAnswer, type MockGradeResult } from '@/lib/mock/gradeMock'

type MockQuestion = {
  id?: string
  markScheme: string
  marks: number
  paper?: string | null
  questionNumber?: string | number | null
  questionText: string
  sourceTitle?: string
  year?: string | number | null
}

async function readJson(response: Response) {
  const text = await response.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return { error: 'The server returned an unreadable response.' }
  }
}

function MockInner() {
  const [subject, setSubject] = useState('Physics')
  const [topic, setTopic] = useState('Waves')
  const [questionCount, setQuestionCount] = useState('1')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [questions, setQuestions] = useState<MockQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState<MockGradeResult | null>(null)

  const subjects = useMemo(() => Array.from(new Set([...SUBJECTS['O Level'], ...SUBJECTS['A Level']])), [])
  const current = questions[currentIndex]

  async function generateMock() {
    setError('')
    setFeedback(null)
    setAnswer('')
    setLoading(true)
    try {
      const count = Math.max(1, Math.min(10, Number(questionCount || 1)))
      const response = await fetch('/api/mock/generate', {
        body: JSON.stringify({ count, subject, topic: topic.trim() }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      const json = await readJson(response)
      if (!response.ok) throw new Error(json.error || 'Could not load past paper questions.')
      const nextQuestions: MockQuestion[] = Array.isArray(json.questions) ? json.questions : []
      if (!nextQuestions.length) throw new Error('No real past paper questions found for this topic.')
      setQuestions(nextQuestions)
      setCurrentIndex(0)
    } catch (err) {
      setQuestions([])
      setError(err instanceof Error ? err.message : 'Could not load past paper questions.')
    } finally {
      setLoading(false)
    }
  }

  async function submitAnswer() {
    if (!current || !answer.trim()) {
      setError('Write an answer first.')
      return
    }
    setError('')
    try {
      const response = await fetch('/api/mock/grade', {
        body: JSON.stringify({
          answer,
          markScheme: current.markScheme,
          marks: current.marks,
          questionText: current.questionText,
          subject,
          topic,
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      const json = await readJson(response)
      if (!response.ok) throw new Error(json.error || 'Could not check answer.')
      setFeedback(json.grade)
    } catch (err) {
      setFeedback(gradeMockAnswer({ answer, markScheme: current.markScheme, marks: current.marks }))
      setError(err instanceof Error ? `${err.message} Showing mark-scheme check.` : 'Showing mark-scheme check.')
    }
  }

  function goToQuestion(index: number) {
    setCurrentIndex(index)
    setAnswer('')
    setFeedback(null)
    setError('')
  }

  return (
    <main style={styles.page}>
      <StarBackground variant="chat" />
      <style>{`
        @media (max-width: 860px) {
          .mock-form,
          .mock-workspace {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
      <nav style={styles.nav}>
        <Logo compact />
        <ProductNav compact style={styles.links} />
      </nav>

      <section style={styles.content}>
        <header style={styles.hero}>
          <h1 style={styles.title}>Mock test</h1>
        </header>

        <div className="mock-form" style={styles.form}>
          <select value={subject} onChange={(event) => setSubject(event.target.value)} style={styles.field}>
            {subjects.map((item) => <option key={item}>{item}</option>)}
          </select>
          <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Topic" style={styles.field} />
          <input value={questionCount} onChange={(event) => setQuestionCount(event.target.value)} inputMode="numeric" placeholder="Questions (1-10)" style={styles.field} />
        </div>

        {error ? <div style={styles.error}>{error}</div> : null}
        <button type="button" onClick={() => void generateMock()} disabled={loading} style={styles.primary}>
          {loading ? 'Loading questions...' : 'Generate Mock Test'}
        </button>

        {current ? (
          <div className="mock-workspace" style={styles.workspace}>
            <section style={styles.card}>
              <div style={styles.cardHeader}>
                <span style={styles.panelTitle}>Question {currentIndex + 1}/{questions.length}</span>
                <div style={styles.dots}>
                  {questions.map((question, index) => (
                    <button
                      key={question.id ?? index}
                      type="button"
                      onClick={() => goToQuestion(index)}
                      style={styles.dot(index === currentIndex)}
                      aria-label={`Question ${index + 1}`}
                    />
                  ))}
                </div>
              </div>
              <div style={styles.question}>
                <AnswerRenderer content={current.questionText} />
              </div>
              <p style={styles.muted}>
                {current.marks} marks · {subject}
                {current.paper ? ` · ${current.paper}` : ''}
                {current.year ? ` · ${current.year}` : ''}
                {current.questionNumber ? ` · Q${current.questionNumber}` : ''}
              </p>
              <textarea value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Write your answer..." style={styles.answerBox} />
              <div style={styles.actions}>
                <button type="button" onClick={() => void submitAnswer()} style={styles.primarySmall}>Submit Answer</button>
                {currentIndex < questions.length - 1 ? <button type="button" onClick={() => goToQuestion(currentIndex + 1)} style={styles.secondary}>Next</button> : null}
              </div>
            </section>

            <section style={styles.card}>
              <div style={styles.cardHeader}>
                <span style={styles.panelTitle}>Mark scheme feedback</span>
                {feedback ? <span style={feedback.isCorrect ? styles.correctPill : styles.incorrectPill}>{feedback.isCorrect ? 'Correct' : 'Incorrect'} · {feedback.score}/{feedback.totalMarks}</span> : null}
              </div>
              {feedback ? (
                <div style={styles.feedbackGrid}>
                  <div>
                    <h3 style={styles.smallTitle}>Matched points</h3>
                    {feedback.hitPoints.length ? feedback.hitPoints.map((point) => <div key={point} style={styles.good}>+ <AnswerRenderer content={point} /></div>) : <p style={styles.muted}>No clear mark-scheme keywords detected.</p>}
                  </div>
                  <div>
                    <h3 style={styles.smallTitle}>Missing points</h3>
                    {feedback.missingPoints.length ? feedback.missingPoints.map((point) => <div key={point} style={styles.warn}>- <AnswerRenderer content={point} /></div>) : <p style={styles.good}>Nothing major missing.</p>}
                  </div>
                  <div>
                    <h3 style={styles.smallTitle}>Mark scheme solution</h3>
                    <div style={styles.scheme}><AnswerRenderer content={feedback.correctAnswer} /></div>
                    <div style={styles.muted}><AnswerRenderer content={feedback.improvementAdvice} /></div>
                  </div>
                </div>
              ) : (
                <p style={styles.muted}>Submit your answer to check it against the mark scheme.</p>
              )}
            </section>
          </div>
        ) : null}
      </section>
    </main>
  )
}

export default function MockPage() {
  return (
    <AuthGuard>
      <MockInner />
    </AuthGuard>
  )
}

const styles = {
  actions: { display: 'flex', flexWrap: 'wrap', gap: 10 } satisfies CSSProperties,
  answerBox: {
    background: '#0a0718',
    border: '1px solid rgba(170,85,255,0.18)',
    borderRadius: 12,
    color: '#f4eeff',
    minHeight: 180,
    outline: 'none',
    padding: 14,
    resize: 'vertical',
  } satisfies CSSProperties,
  card: {
    background: 'rgba(255,255,255,0.035)',
    border: '1px solid rgba(170,85,255,0.1)',
    borderRadius: 8,
    display: 'grid',
    gap: 14,
    padding: 18,
  } satisfies CSSProperties,
  cardHeader: { alignItems: 'center', display: 'flex', gap: 12, justifyContent: 'space-between' } satisfies CSSProperties,
  content: {
    display: 'grid',
    gap: 18,
    margin: '0 auto',
    padding: '34px clamp(16px,4vw,52px) 60px',
    position: 'relative',
    width: 'min(1180px, 100%)',
    zIndex: 1,
  } satisfies CSSProperties,
  correctPill: {
    background: 'rgba(34,197,94,.14)',
    border: '1px solid rgba(34,197,94,.36)',
    borderRadius: 999,
    color: '#86efac',
    fontSize: 12,
    fontWeight: 850,
    padding: '6px 10px',
  } satisfies CSSProperties,
  dot: (active: boolean) => ({
    background: active ? '#aa55ff' : 'rgba(255,255,255,.12)',
    border: 'none',
    borderRadius: 999,
    cursor: 'pointer',
    height: 9,
    width: 9,
  }) satisfies CSSProperties,
  dots: { display: 'flex', gap: 7 } satisfies CSSProperties,
  error: { color: '#fbbf24', fontSize: 13 } satisfies CSSProperties,
  feedbackGrid: { display: 'grid', gap: 12 } satisfies CSSProperties,
  field: {
    background: '#0a0718',
    border: '1px solid rgba(170,85,255,0.18)',
    borderRadius: 8,
    color: '#f4eeff',
    colorScheme: 'dark',
    fontSize: 14,
    outline: 'none',
    padding: '14px',
  } satisfies CSSProperties,
  form: { display: 'grid', gap: 10, gridTemplateColumns: '1fr 1.4fr .7fr' } satisfies CSSProperties,
  good: { color: '#86efac', lineHeight: 1.55, margin: '5px 0' } satisfies CSSProperties,
  hero: { display: 'grid', gap: 12 } satisfies CSSProperties,
  incorrectPill: {
    background: 'rgba(245,158,11,.14)',
    border: '1px solid rgba(245,158,11,.36)',
    borderRadius: 999,
    color: '#fcd34d',
    fontSize: 12,
    fontWeight: 850,
    padding: '6px 10px',
  } satisfies CSSProperties,
  links: { display: 'flex', flexWrap: 'wrap', gap: 14 } satisfies CSSProperties,
  muted: { color: '#aaa6ca', lineHeight: 1.65, margin: 0 } satisfies CSSProperties,
  nav: {
    alignItems: 'center',
    borderBottom: '1px solid rgba(170,85,255,0.1)',
    display: 'flex',
    flexWrap: 'wrap',
    gap: 18,
    justifyContent: 'space-between',
    padding: '14px clamp(16px,4vw,40px)',
    position: 'relative',
    zIndex: 2,
  } satisfies CSSProperties,
  page: { background: '#00000d', color: '#e8e8ff', minHeight: '100vh', overflowX: 'hidden', position: 'relative' } satisfies CSSProperties,
  panelTitle: { color: '#f4eeff', fontSize: 16, fontWeight: 800 } satisfies CSSProperties,
  primary: {
    background: 'linear-gradient(130deg,#7733cc,#aa55ff)',
    border: 'none',
    borderRadius: 8,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 15,
    fontWeight: 800,
    justifySelf: 'start',
    padding: '14px 22px',
  } satisfies CSSProperties,
  primarySmall: {
    background: 'linear-gradient(130deg,#7733cc,#aa55ff)',
    border: 'none',
    borderRadius: 8,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 800,
    padding: '10px 14px',
  } satisfies CSSProperties,
  question: { color: '#f4eeff', fontSize: 20, lineHeight: 1.55, margin: 0, whiteSpace: 'pre-wrap' } satisfies CSSProperties,
  scheme: {
    background: '#0a0718',
    border: '1px solid rgba(170,85,255,0.12)',
    borderRadius: 8,
    color: '#d8d2f2',
    fontFamily: 'inherit',
    lineHeight: 1.6,
    margin: 0,
    overflowX: 'auto',
    padding: 12,
    whiteSpace: 'pre-wrap',
  } satisfies CSSProperties,
  secondary: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(170,85,255,0.16)',
    borderRadius: 8,
    color: '#d8b4fe',
    cursor: 'pointer',
    padding: '10px 14px',
  } satisfies CSSProperties,
  smallTitle: { color: '#f4eeff', fontSize: 13, margin: '0 0 8px' } satisfies CSSProperties,
  title: { color: '#f4eeff', fontSize: 'clamp(40px,7vw,72px)', fontWeight: 500, margin: 0 } satisfies CSSProperties,
  warn: { color: '#fcd34d', lineHeight: 1.55, margin: '5px 0' } satisfies CSSProperties,
  workspace: { display: 'grid', gap: 16, gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 0.95fr)' } satisfies CSSProperties,
} as const
