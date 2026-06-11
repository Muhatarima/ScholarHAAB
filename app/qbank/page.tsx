'use client'

import { CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, Search } from 'lucide-react'
import { useMemo, useState, type CSSProperties } from 'react'
import AnswerRenderer from '@/components/AnswerRenderer'
import AuthGuard from '@/components/auth/AuthGuard'
import StarBackground from '@/components/StarBackground'
import { type MockGradeResult } from '@/lib/mock/gradeMock'
import { buildSupabaseAuthHeaders } from '@/lib/supabase/auth-headers'

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

type SavedAnswer = {
  answer: string
  feedback: MockGradeResult | null
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

function cleanText(value: unknown): string {
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of ['description', 'point', 'text', 'criterion', 'mark', 'missing', 'feedback', 'reason', 'message']) {
      if (typeof record[key] === 'string' && record[key].trim()) {
        return cleanText(record[key])
      }
    }
    return ''
  }

  const raw = String(value ?? '').trim()
  if ((raw.startsWith('{') && raw.endsWith('}')) || (raw.startsWith('[') && raw.endsWith(']'))) {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) {
        return parsed.map((item) => cleanText(item)).filter(Boolean).join('\n')
      }
      const parsedText = cleanText(parsed)
      if (parsedText) return parsedText
    } catch {}
  }

  return raw
    .replace(/\bS\d+(?:\s*,\s*S\d+)*\b/gi, '')
    .replace(/\[(?:S|s)\d+(?:\s*,\s*(?:S|s)\d+)*\]/g, '')
    .replace(/\[object Object\]/g, '')
    .replace(/^\{?"?description"?\s*:\s*"?/i, '')
    .replace(/"?\s*,\s*"?marks"?\s*:\s*\d+\}?$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function QbankMockInner() {
  const [subject, setSubject] = useState('Physics')
  const [topic, setTopic] = useState('Waves')
  const [questionCount, setQuestionCount] = useState('3')
  const [questions, setQuestions] = useState<MockQuestion[]>([])
  const [answers, setAnswers] = useState<Record<number, SavedAnswer>>({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [grading, setGrading] = useState(false)
  const [error, setError] = useState('')

  const current = questions[currentIndex]
  const currentAnswer = answers[currentIndex]?.answer ?? ''
  const currentFeedback = answers[currentIndex]?.feedback ?? null
  const completedCount = useMemo(
    () => Object.values(answers).filter((entry) => entry.feedback).length,
    [answers]
  )
  const totalScore = useMemo(
    () => Object.values(answers).reduce((sum, entry) => sum + (entry.feedback?.score ?? 0), 0),
    [answers]
  )
  const totalMarks = useMemo(
    () => questions.reduce((sum, question) => sum + Number(question.marks || 0), 0),
    [questions]
  )

  function updateAnswer(value: string) {
    setAnswers((currentAnswers) => ({
      ...currentAnswers,
      [currentIndex]: {
        answer: value,
        feedback: currentAnswers[currentIndex]?.feedback ?? null,
      },
    }))
  }

  async function generateMock() {
    if (!subject || !topic.trim()) {
      setError('Choose a subject and topic first.')
      return
    }

    setError('')
    setLoading(true)
    setQuestions([])
    setAnswers({})
    setCurrentIndex(0)

    try {
      const count = Math.max(1, Math.min(10, Number(questionCount || 3)))
      const response = await fetch('/api/mock/generate', {
        body: JSON.stringify({ count, subject, topic: topic.trim() }),
        headers: await buildSupabaseAuthHeaders({ 'Content-Type': 'application/json' }),
        method: 'POST',
      })
      const data = await readJson(response)
      if (!response.ok) throw new Error(errorMessage(data.error, 'Could not load mock test questions.'))
      const nextQuestions = Array.isArray(data.questions) ? data.questions : []
      if (!nextQuestions.length) throw new Error('No real past-paper questions were found for this topic.')
      setQuestions(nextQuestions)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load mock test questions.')
    } finally {
      setLoading(false)
    }
  }

  async function submitAnswer() {
    if (!current) return
    if (!currentAnswer.trim()) {
      setError('Write your answer before submitting.')
      return
    }

    setError('')
    setGrading(true)
    try {
      const response = await fetch('/api/mock/grade', {
        body: JSON.stringify({
          answer: currentAnswer,
          markScheme: current.markScheme,
          marks: current.marks,
          paper: current.paper,
          questionText: current.questionText,
          subject,
          topic,
        }),
        headers: await buildSupabaseAuthHeaders({ 'Content-Type': 'application/json' }),
        method: 'POST',
      })
      const data = await readJson(response)
      if (!response.ok) throw new Error(errorMessage(data.error, 'Could not mark the answer.'))
      setAnswers((currentAnswers) => ({
        ...currentAnswers,
        [currentIndex]: {
          answer: currentAnswer,
          feedback: data.grade as MockGradeResult,
        },
      }))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not mark the answer.')
    } finally {
      setGrading(false)
    }
  }

  function move(delta: number) {
    const next = Math.max(0, Math.min(questions.length - 1, currentIndex + delta))
    setCurrentIndex(next)
    setError('')
  }

  return (
    <main style={styles.page}>
      <StarBackground variant="chat" />
      <style>{`
        @media (max-width: 900px) {
          .qbank-setup,
          .qbank-workspace {
            grid-template-columns: 1fr !important;
          }
          .qbank-title {
            font-size: 42px !important;
          }
          .qbank-shell {
            padding: 34px 16px 72px !important;
          }
        }
      `}</style>

      <section className="qbank-shell" style={styles.shell}>
        <header style={styles.header}>
          <span style={styles.eyebrow}>Mock Test</span>
          <h1 className="qbank-title" style={styles.title}>Practice like the real exam.</h1>
        </header>

        <div className="qbank-setup" style={styles.setup}>
          <select value={subject} onChange={(event) => setSubject(event.target.value)} style={styles.field}>
            {SUBJECTS.map((item) => <option key={item}>{item}</option>)}
          </select>
          <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Topic" style={styles.field} />
          <input value={questionCount} onChange={(event) => setQuestionCount(event.target.value)} inputMode="numeric" placeholder="Questions 1-10" style={styles.field} />
          <button type="button" onClick={() => void generateMock()} disabled={loading} style={styles.primary}>
            <Search size={17} />
            {loading ? 'Loading...' : 'Generate Mock Test'}
          </button>
        </div>

        {error ? <p style={styles.error}>{error}</p> : null}

        {current ? (
          <>
            <div style={styles.progressBar}>
              <span>{completedCount}/{questions.length} marked</span>
              <span>{totalMarks ? `${totalScore}/${totalMarks} marks` : 'Marks will appear after submission'}</span>
            </div>

            <div className="qbank-workspace" style={styles.workspace}>
              <article style={styles.paper}>
                <div style={styles.paperHeader}>
                  <span style={styles.questionNumber}>Question {currentIndex + 1}</span>
                  <span style={styles.meta}>
                    {current.marks} marks
                    {current.paper ? ` · ${current.paper}` : ''}
                    {current.year ? ` · ${current.year}` : ''}
                    {current.questionNumber ? ` · Q${current.questionNumber}` : ''}
                  </span>
                </div>

                <div style={styles.questionText}>
                  <AnswerRenderer content={cleanText(current.questionText)} />
                </div>

                <textarea
                  value={currentAnswer}
                  onChange={(event) => updateAnswer(event.target.value)}
                  placeholder="Write the answer you would give in the exam..."
                  style={styles.answerBox}
                />

                <div style={styles.actions}>
                  <button type="button" onClick={() => move(-1)} disabled={currentIndex === 0} style={styles.secondary}>
                    <ChevronLeft size={16} />
                    Previous
                  </button>
                  <button type="button" onClick={() => void submitAnswer()} disabled={grading} style={styles.submit}>
                    <ClipboardCheck size={16} />
                    {grading ? 'Marking...' : 'Submit Answer'}
                  </button>
                  <button type="button" onClick={() => move(1)} disabled={currentIndex === questions.length - 1} style={styles.secondary}>
                    Next
                    <ChevronRight size={16} />
                  </button>
                </div>
              </article>

              <aside style={styles.feedbackPanel}>
                <div style={styles.feedbackHeader}>
                  <span>Teacher feedback</span>
                  {currentFeedback ? (
                    <strong style={currentFeedback.isCorrect ? styles.correct : styles.needsWork}>
                      {currentFeedback.score}/{currentFeedback.totalMarks}
                    </strong>
                  ) : null}
                </div>

                {currentFeedback ? (
                  <div style={styles.feedbackBody}>
                    <section style={styles.feedbackBlock}>
                      <h2 style={styles.feedbackTitle}>
                        <CheckCircle2 size={18} />
                        What you earned marks for
                      </h2>
                      {currentFeedback.hitPoints.length ? (
                        currentFeedback.hitPoints.map((point, index) => <p key={`${index}-${cleanText(point)}`} style={styles.goodPoint}>{cleanText(point)}</p>)
                      ) : (
                        <p style={styles.muted}>Your answer does not clearly hit a mark-scheme point yet.</p>
                      )}
                    </section>

                    <section style={styles.feedbackBlock}>
                      <h2 style={styles.feedbackTitle}>What to improve</h2>
                      {currentFeedback.missingPoints.length ? (
                        currentFeedback.missingPoints.slice(0, 5).map((point, index) => <p key={`${index}-${cleanText(point)}`} style={styles.missingPoint}>{cleanText(point)}</p>)
                      ) : (
                        <p style={styles.goodPoint}>Strong answer. No major missing point detected.</p>
                      )}
                    </section>

                    <section style={styles.feedbackBlock}>
                      <h2 style={styles.feedbackTitle}>Model answer from the mark scheme</h2>
                      <div style={styles.scheme}>
                        <AnswerRenderer content={cleanText(currentFeedback.correctAnswer)} />
                      </div>
                      <p style={styles.teacherNote}>{cleanText(currentFeedback.improvementAdvice)}</p>
                    </section>
                  </div>
                ) : (
                  <p style={styles.muted}>
                    Submit your answer. The check uses the stored mark scheme and gives feedback like a teacher.
                  </p>
                )}
              </aside>
            </div>
          </>
        ) : (
          <div style={styles.empty}>Choose a subject, topic, and number of questions to start.</div>
        )}
      </section>
    </main>
  )
}

export default function QBankPage() {
  return (
    <AuthGuard>
      <QbankMockInner />
    </AuthGuard>
  )
}

const styles = {
  actions: { display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' } satisfies CSSProperties,
  answerBox: {
    background: '#070614',
    border: '1px solid rgba(176,128,255,.18)',
    borderRadius: 8,
    color: '#f4f1ff',
    font: 'inherit',
    lineHeight: 1.65,
    minHeight: 180,
    outline: 'none',
    padding: 14,
    resize: 'vertical',
  } satisfies CSSProperties,
  correct: { color: '#86efac' } satisfies CSSProperties,
  empty: { color: '#aaa7c8', display: 'grid', minHeight: 260, placeItems: 'center' } satisfies CSSProperties,
  error: { color: '#fbbf24', fontWeight: 700, margin: 0 } satisfies CSSProperties,
  eyebrow: { color: '#b983ff', fontSize: 12, fontWeight: 850, textTransform: 'uppercase' } satisfies CSSProperties,
  feedbackBlock: { display: 'grid', gap: 9 } satisfies CSSProperties,
  feedbackBody: { display: 'grid', gap: 18 } satisfies CSSProperties,
  feedbackHeader: {
    alignItems: 'center',
    borderBottom: '1px solid rgba(176,128,255,.12)',
    color: '#f4f1ff',
    display: 'flex',
    fontSize: 18,
    fontWeight: 850,
    justifyContent: 'space-between',
    paddingBottom: 14,
  } satisfies CSSProperties,
  feedbackPanel: {
    alignSelf: 'start',
    background: 'rgba(255,255,255,.032)',
    border: '1px solid rgba(176,128,255,.14)',
    borderRadius: 8,
    display: 'grid',
    gap: 16,
    padding: 18,
  } satisfies CSSProperties,
  feedbackTitle: {
    alignItems: 'center',
    color: '#f4f1ff',
    display: 'flex',
    fontSize: 15,
    gap: 8,
    margin: 0,
  } satisfies CSSProperties,
  field: {
    background: '#090816',
    border: '1px solid rgba(176,128,255,.18)',
    borderRadius: 8,
    color: '#f4f1ff',
    colorScheme: 'dark',
    font: 'inherit',
    height: 46,
    minWidth: 0,
    outline: 'none',
    padding: '0 14px',
  } satisfies CSSProperties,
  goodPoint: { color: '#b7f7cf', lineHeight: 1.55, margin: 0 } satisfies CSSProperties,
  header: { display: 'grid', gap: 8 } satisfies CSSProperties,
  meta: { color: '#aaa7c8', fontSize: 13 } satisfies CSSProperties,
  missingPoint: { color: '#fcd34d', lineHeight: 1.55, margin: 0 } satisfies CSSProperties,
  muted: { color: '#aaa7c8', lineHeight: 1.65, margin: 0 } satisfies CSSProperties,
  needsWork: { color: '#fcd34d' } satisfies CSSProperties,
  page: { background: '#02020c', color: '#ecebff', minHeight: 'calc(100vh - 74px)', position: 'relative' } satisfies CSSProperties,
  paper: {
    background: 'rgba(255,255,255,.032)',
    border: '1px solid rgba(176,128,255,.14)',
    borderRadius: 8,
    display: 'grid',
    gap: 16,
    padding: 18,
  } satisfies CSSProperties,
  paperHeader: { alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' } satisfies CSSProperties,
  primary: {
    alignItems: 'center',
    background: 'linear-gradient(130deg,#7733cc,#aa55ff)',
    border: 0,
    borderRadius: 8,
    color: '#fff',
    cursor: 'pointer',
    display: 'inline-flex',
    fontWeight: 850,
    gap: 8,
    height: 46,
    justifyContent: 'center',
    padding: '0 18px',
  } satisfies CSSProperties,
  progressBar: {
    alignItems: 'center',
    border: '1px solid rgba(176,128,255,.12)',
    borderRadius: 8,
    color: '#c9c2e8',
    display: 'flex',
    flexWrap: 'wrap',
    fontSize: 13,
    gap: 12,
    justifyContent: 'space-between',
    padding: '12px 14px',
  } satisfies CSSProperties,
  questionNumber: { color: '#f4f1ff', fontSize: 18, fontWeight: 850 } satisfies CSSProperties,
  questionText: { color: '#f4f1ff', fontSize: 17, lineHeight: 1.75 } satisfies CSSProperties,
  scheme: {
    background: '#080716',
    border: '1px solid rgba(176,128,255,.12)',
    borderRadius: 8,
    padding: 12,
  } satisfies CSSProperties,
  secondary: {
    alignItems: 'center',
    background: 'rgba(255,255,255,.04)',
    border: '1px solid rgba(176,128,255,.18)',
    borderRadius: 8,
    color: '#e9d5ff',
    cursor: 'pointer',
    display: 'inline-flex',
    fontWeight: 800,
    gap: 6,
    padding: '10px 12px',
  } satisfies CSSProperties,
  setup: {
    background: 'rgba(255,255,255,.025)',
    border: '1px solid rgba(176,128,255,.12)',
    borderRadius: 8,
    display: 'grid',
    gap: 10,
    gridTemplateColumns: 'minmax(150px,.7fr) minmax(220px,1.25fr) minmax(130px,.55fr) auto',
    padding: 14,
  } satisfies CSSProperties,
  shell: { display: 'grid', gap: 22, margin: '0 auto', padding: '42px 16px 72px', position: 'relative', width: 'min(1180px,100%)', zIndex: 1 } satisfies CSSProperties,
  submit: {
    alignItems: 'center',
    background: '#9b4dff',
    border: 0,
    borderRadius: 8,
    color: '#fff',
    cursor: 'pointer',
    display: 'inline-flex',
    fontWeight: 850,
    gap: 8,
    padding: '10px 14px',
  } satisfies CSSProperties,
  teacherNote: { color: '#c8bfff', lineHeight: 1.65, margin: 0 } satisfies CSSProperties,
  title: { fontSize: 'clamp(40px,6vw,68px)', fontWeight: 520, lineHeight: 1, margin: 0 } satisfies CSSProperties,
  workspace: { display: 'grid', gap: 16, gridTemplateColumns: 'minmax(0,1.1fr) minmax(320px,.9fr)' } satisfies CSSProperties,
} as const
