'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import AuthGuard from '@/components/auth/AuthGuard'
import Badge from '@/components/Badge'
import Logo from '@/components/Logo'
import StarBackground from '@/components/StarBackground'
import { BOARDS, LEVELS, SUBJECTS } from '@/lib/profile/setupOptions'

type MockQuestion = {
  questionText: string
  markScheme: string
  marks: number
  basedOnQuestionIds?: string[]
}

function splitMarkScheme(markScheme: string) {
  return markScheme
    .split(/\n|•|-/)
    .map((point) => point.trim())
    .filter((point) => point.length > 8)
    .slice(0, 6)
}

function scoreAnswer(answer: string, markScheme: string, marks: number) {
  const cleanAnswer = answer.toLowerCase()
  const points = splitMarkScheme(markScheme)
  const hitPoints = points.filter((point) => {
    const keywords = point
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 5)
      .slice(0, 4)
    return keywords.some((word) => cleanAnswer.includes(word))
  })
  const score = Math.min(marks, Math.max(0, Math.round((hitPoints.length / Math.max(1, points.length)) * marks)))
  return { score, hitPoints, missingPoints: points.filter((point) => !hitPoints.includes(point)) }
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function MockInner() {
  const [level, setLevel] = useState('A Level')
  const [board, setBoard] = useState('Cambridge')
  const [subject, setSubject] = useState('Physics')
  const [topic, setTopic] = useState('waves')
  const [paper, setPaper] = useState('Paper 2')
  const [difficulty, setDifficulty] = useState('medium')
  const [questionCount, setQuestionCount] = useState('1')
  const [timeLimit, setTimeLimit] = useState('15')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [questions, setQuestions] = useState<MockQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState<ReturnType<typeof scoreAnswer> | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState(0)

  const subjects = useMemo(() => Array.from(new Set([...SUBJECTS['O Level'], ...SUBJECTS['A Level']])), [])
  const current = questions[currentIndex]

  useEffect(() => {
    if (!remainingSeconds || !questions.length || feedback) return
    const id = window.setInterval(() => {
      setRemainingSeconds((value) => Math.max(0, value - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [remainingSeconds, questions.length, feedback])

  async function generateMock() {
    setError('')
    setFeedback(null)
    setAnswer('')
    setLoading(true)
    try {
      const count = Math.max(1, Math.min(10, Number(questionCount || 1)))
      const response = await fetch('/api/mock/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: count > 1 ? 'drill' : 'question',
          level,
          board,
          subject,
          topic,
          paper,
          difficulty,
          count,
          timeLimitMinutes: Number(timeLimit || 15),
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Could not generate mock.')
      const nextQuestions: MockQuestion[] = Array.isArray(json.questions)
        ? json.questions
        : json.question
          ? [json.question]
          : json.mockPaper?.questions ?? []
      if (!nextQuestions.length) throw new Error('No mock questions returned.')
      setQuestions(nextQuestions)
      setCurrentIndex(0)
      setRemainingSeconds(Math.max(1, Number(timeLimit || 15)) * 60)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate mock.')
    } finally {
      setLoading(false)
    }
  }

  async function submitAnswer() {
    if (!current || !answer.trim()) {
      setError('Write an answer first.')
      return
    }
    const result = scoreAnswer(answer, current.markScheme, current.marks)
    setFeedback(result)
    await fetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject,
        topic,
        isCorrect: result.score / Math.max(1, current.marks) >= 0.6,
        confidenceScore: Math.round((result.score / Math.max(1, current.marks)) * 100),
      }),
    }).catch(() => undefined)
  }

  function nextQuestion() {
    setCurrentIndex((value) => Math.min(questions.length - 1, value + 1))
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
        <div style={styles.links}>
          <Link href="/solver" style={styles.link}>Solver</Link>
          <Link href="/dashboard" style={styles.link}>Dashboard</Link>
          <Link href="/exam-mode" style={styles.link}>Exam Mode</Link>
          <Link href="/ai-approach" style={styles.link}>AI Approach</Link>
        </div>
      </nav>

      <section style={styles.content}>
        <div style={styles.hero}>
          <Badge tone="violet">AI-generated mock based on A/O Level pattern</Badge>
          <h1 style={styles.title}>Mock practice</h1>
        </div>

        <div className="mock-form" style={styles.form}>
          <select value={level} onChange={(event) => setLevel(event.target.value)} style={styles.field}>
            {LEVELS.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select value={board} onChange={(event) => setBoard(event.target.value)} style={styles.field}>
            {BOARDS.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select value={subject} onChange={(event) => setSubject(event.target.value)} style={styles.field}>
            {subjects.map((item) => <option key={item}>{item}</option>)}
          </select>
          <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Topic/chapter" style={styles.field} />
          <input value={paper} onChange={(event) => setPaper(event.target.value)} placeholder="Paper/component" style={styles.field} />
          <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)} style={styles.field}>
            <option value="easy">Foundation</option>
            <option value="medium">Core</option>
            <option value="hard">Extension</option>
          </select>
          <input value={questionCount} onChange={(event) => setQuestionCount(event.target.value)} inputMode="numeric" placeholder="Questions" style={styles.field} />
          <input value={timeLimit} onChange={(event) => setTimeLimit(event.target.value)} inputMode="numeric" placeholder="Minutes" style={styles.field} />
        </div>

        {error ? <div style={styles.error}>{error}</div> : null}
        <button type="button" onClick={() => void generateMock()} disabled={loading} style={styles.primary}>
          {loading ? 'Generating mock...' : 'Generate mock ->'}
        </button>

        {current ? (
          <div className="mock-workspace" style={styles.workspace}>
            <section style={styles.card}>
              <div style={styles.cardHeader}>
                <Badge tone="violet">Question {currentIndex + 1}/{questions.length}</Badge>
                <span style={styles.timer}>{formatTime(remainingSeconds)}</span>
              </div>
              <h2 style={styles.question}>{current.questionText}</h2>
              <p style={styles.muted}>{current.marks} marks · {board} {level} {subject} · {paper}</p>
              <textarea value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Write your answer..." style={styles.answerBox} />
              <div style={styles.actions}>
                <button type="button" onClick={() => void submitAnswer()} style={styles.primarySmall}>Submit answer</button>
                {currentIndex < questions.length - 1 ? <button type="button" onClick={nextQuestion} style={styles.secondary}>Next</button> : null}
              </div>
            </section>

            <section style={styles.card}>
              <div style={styles.cardHeader}>
                <span style={styles.panelTitle}>Mark scheme feedback</span>
                {feedback ? <Badge tone={feedback.score >= Math.ceil(current.marks * 0.6) ? 'green' : 'amber'}>{feedback.score}/{current.marks}</Badge> : null}
              </div>
              {feedback ? (
                <div style={styles.feedbackGrid}>
                  <div>
                    <h3 style={styles.smallTitle}>You got</h3>
                    {feedback.hitPoints.length ? feedback.hitPoints.map((point) => <p key={point} style={styles.good}>+ {point}</p>) : <p style={styles.muted}>No clear mark-scheme keywords detected.</p>}
                  </div>
                  <div>
                    <h3 style={styles.smallTitle}>Missing</h3>
                    {feedback.missingPoints.length ? feedback.missingPoints.map((point) => <p key={point} style={styles.warn}>- {point}</p>) : <p style={styles.good}>Nothing major missing.</p>}
                  </div>
                  <div>
                    <h3 style={styles.smallTitle}>Model answer / mark scheme</h3>
                    <pre style={styles.scheme}>{current.markScheme}</pre>
                  </div>
                </div>
              ) : (
                <p style={styles.muted}>Submit your answer to see marks, missing points, and improvement advice.</p>
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
  page: {
    background: '#00000d',
    color: '#e8e8ff',
    minHeight: '100vh',
    overflowX: 'hidden',
    position: 'relative',
  } satisfies CSSProperties,
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
  links: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 14,
  } satisfies CSSProperties,
  link: {
    color: '#aaa6ca',
    fontSize: 13,
    textDecoration: 'none',
  } satisfies CSSProperties,
  content: {
    display: 'grid',
    gap: 18,
    margin: '0 auto',
    padding: '34px clamp(16px,4vw,52px) 60px',
    position: 'relative',
    width: 'min(1180px, 100%)',
    zIndex: 1,
  } satisfies CSSProperties,
  hero: {
    display: 'grid',
    gap: 12,
  } satisfies CSSProperties,
  title: {
    color: '#f4eeff',
    fontSize: 'clamp(40px,7vw,72px)',
    fontWeight: 500,
    letterSpacing: '-0.06em',
    margin: 0,
  } satisfies CSSProperties,
  form: {
    display: 'grid',
    gap: 10,
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  } satisfies CSSProperties,
  field: {
    background: '#0a0718',
    border: '1px solid rgba(170,85,255,0.18)',
    borderRadius: 16,
    color: '#f4eeff',
    colorScheme: 'dark',
    fontSize: 14,
    outline: 'none',
    padding: '14px',
  } satisfies CSSProperties,
  primary: {
    background: 'linear-gradient(130deg,#7733cc,#aa55ff)',
    border: 'none',
    borderRadius: 999,
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
    borderRadius: 999,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 800,
    padding: '10px 14px',
  } satisfies CSSProperties,
  secondary: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(170,85,255,0.16)',
    borderRadius: 999,
    color: '#d8b4fe',
    cursor: 'pointer',
    padding: '10px 14px',
  } satisfies CSSProperties,
  error: {
    color: '#fbbf24',
    fontSize: 13,
  } satisfies CSSProperties,
  workspace: {
    display: 'grid',
    gap: 16,
    gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 0.95fr)',
  } satisfies CSSProperties,
  card: {
    background: 'rgba(255,255,255,0.035)',
    border: '1px solid rgba(170,85,255,0.1)',
    borderRadius: 24,
    display: 'grid',
    gap: 14,
    padding: 18,
  } satisfies CSSProperties,
  cardHeader: {
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
  } satisfies CSSProperties,
  timer: {
    color: '#c084fc',
    fontSize: 13,
    fontWeight: 900,
  } satisfies CSSProperties,
  question: {
    color: '#f4eeff',
    fontSize: 20,
    lineHeight: 1.55,
    margin: 0,
    whiteSpace: 'pre-wrap',
  } satisfies CSSProperties,
  muted: {
    color: '#aaa6ca',
    lineHeight: 1.65,
    margin: 0,
  } satisfies CSSProperties,
  answerBox: {
    background: '#0a0718',
    border: '1px solid rgba(170,85,255,0.18)',
    borderRadius: 18,
    color: '#f4eeff',
    minHeight: 180,
    outline: 'none',
    padding: 14,
    resize: 'vertical',
  } satisfies CSSProperties,
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
  } satisfies CSSProperties,
  panelTitle: {
    color: '#f4eeff',
    fontSize: 16,
    fontWeight: 800,
  } satisfies CSSProperties,
  feedbackGrid: {
    display: 'grid',
    gap: 12,
  } satisfies CSSProperties,
  smallTitle: {
    color: '#f4eeff',
    fontSize: 13,
    margin: '0 0 8px',
  } satisfies CSSProperties,
  good: {
    color: '#86efac',
    lineHeight: 1.55,
    margin: '5px 0',
  } satisfies CSSProperties,
  warn: {
    color: '#fcd34d',
    lineHeight: 1.55,
    margin: '5px 0',
  } satisfies CSSProperties,
  scheme: {
    background: '#0a0718',
    border: '1px solid rgba(170,85,255,0.12)',
    borderRadius: 14,
    color: '#d8d2f2',
    fontFamily: 'inherit',
    lineHeight: 1.6,
    margin: 0,
    overflowX: 'auto',
    padding: 12,
    whiteSpace: 'pre-wrap',
  } satisfies CSSProperties,
}
