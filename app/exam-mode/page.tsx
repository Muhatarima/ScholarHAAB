'use client'

import Link from 'next/link'
import { useMemo, useState, type CSSProperties } from 'react'
import AuthGuard from '@/components/auth/AuthGuard'
import Badge from '@/components/Badge'
import ChatInput from '@/components/ChatInput'
import ExamNightCard from '@/components/ExamNightCard'
import Logo from '@/components/Logo'
import StarBackground from '@/components/StarBackground'
import { BOARDS, LEVELS, SUBJECTS } from '@/lib/profile/setupOptions'

type ExamPlan = {
  meta?: {
    subject?: string
    level?: string
    board?: string
    topicFocus?: string
    daysLeft?: number | null
    examSoon?: boolean
    emergencyMode?: boolean
    dataLabel?: string
  }
  mostRepeatedTopics?: Array<{ topic: string; frequency?: number; yearsAppeared?: Array<string | number>; confidence?: string }>
  highProbabilityTopics?: Array<{ topic: string; whyLikely?: string; confidence?: string }>
  mostLikelyQuestionTypes?: Array<{ questionStyle: string; practiceRecommendation?: string }>
  formulas?: Array<{ formula: string; whenToUse?: string; commonMistake?: string; example?: string }>
  theoryRescue?: Array<{ topic: string; explanation: string }>
  studyPlan?: {
    fifteenMinutePlan?: string[]
    thirtyMinutePractice?: string[]
    sixtyMinuteDeepPractice?: string[]
    doFirst?: string[]
    skipForNow?: string[]
  }
  practiceQuestions?: Array<{ question: string; marks: number; markScheme: string[]; label: string }>
  personalWeaknessBoost?: Array<{ topic: string; action: string }>
}

const localTopicDefaults: Record<string, string[]> = {
  Physics: ['definitions and units', 'formula substitution', 'graphs', 'practical method questions'],
  Chemistry: ['bonding keywords', 'moles calculations', 'rates graphs', 'structure and properties'],
  Mathematics: ['method marks', 'exact form', 'algebra checks', 'calculus setup'],
  Biology: ['process sequence', 'keywords', 'data questions', 'structure to function'],
  Economics: ['definition accuracy', 'diagram labels', 'chain of reasoning', 'evaluation'],
  Accounting: ['format', 'working notes', 'final balances', 'ratio interpretation'],
}

function daysUntil(date: string) {
  if (!date) return null
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return null
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.ceil((parsed.getTime() - today.getTime()) / 86_400_000)
}

function buildFallbackPlan(input: {
  subject: string
  level: string
  board: string
  topic: string
  examDate: string
  paperType: string
}): ExamPlan {
  const remainingDays = daysUntil(input.examDate)
  const baseTopics = localTopicDefaults[input.subject] ?? localTopicDefaults.Physics
  const focus = input.topic.trim() || baseTopics[0]
  const topics = [focus, ...baseTopics.filter((item) => item.toLowerCase() !== focus.toLowerCase())].slice(0, 4)

  return {
    meta: {
      subject: input.subject,
      level: input.level,
      board: input.board,
      topicFocus: focus,
      daysLeft: remainingDays,
      examSoon: remainingDays !== null && remainingDays <= 3,
      emergencyMode: remainingDays !== null && remainingDays <= 1,
      dataLabel: 'Prediction based on available local topic rules.',
    },
    mostRepeatedTopics: topics.map((topic, index) => ({
      topic,
      frequency: Math.max(1, 5 - index),
      yearsAppeared: [],
      confidence: index === 0 ? 'high' : 'medium',
    })),
    highProbabilityTopics: topics.slice(0, 3).map((topic) => ({
      topic,
      whyLikely: `High probability based on ${input.paperType || 'paper'} pattern and core ${input.subject} skills.`,
      confidence: 'pattern-based',
    })),
    mostLikelyQuestionTypes: [
      { questionStyle: 'Definition or keyword question', practiceRecommendation: 'Write exact exam words first.' },
      { questionStyle: 'Structured calculation or explanation', practiceRecommendation: 'Show formula, substitution, answer, unit.' },
    ],
    formulas: [
      {
        formula: input.subject === 'Physics' ? 'v = fλ' : 'Use the core formula from the topic.',
        whenToUse: 'When the question gives matching variables and asks for one missing value.',
        commonMistake: 'Skipping units or writing only the final answer.',
        example: 'Formula first, then substitute numbers.',
      },
    ],
    theoryRescue: topics.slice(0, 2).map((topic) => ({
      topic,
      explanation: `Know the definition, one example, and the mark-scheme keywords for ${topic}.`,
    })),
    studyPlan: {
      fifteenMinutePlan: ['Recall key definitions', 'Write formulas once', 'Solve one short question'],
      thirtyMinutePractice: ['Do one structured question', 'Mark it strictly', 'Rewrite missing keywords'],
      sixtyMinuteDeepPractice: ['Revise weak theory', 'Attempt mini mock', 'Review every lost mark'],
      doFirst: topics.slice(0, 2),
      skipForNow: ['Long textbook reading', 'Low-frequency extension notes'],
    },
    practiceQuestions: [
      {
        question: `A/O Level style ${input.subject} question on ${focus}. Show working and final exam keywords.`,
        marks: 4,
        markScheme: ['Correct idea or formula [1]', 'Correct application [1]', 'Clear explanation [1]', 'Unit/keyword/final statement [1]'],
        label: 'AI-generated mock based on A/O Level pattern',
      },
    ],
    personalWeaknessBoost: [{ topic: focus, action: 'Do this first, then one mark-scheme check.' }],
  }
}

function ExamModeInner() {
  const [subject, setSubject] = useState('Physics')
  const [board, setBoard] = useState('Cambridge')
  const [level, setLevel] = useState('A Level')
  const [topic, setTopic] = useState('wave motion')
  const [examDate, setExamDate] = useState('')
  const [paperType, setPaperType] = useState('Paper 2')
  const [availableStudyMinutes, setAvailableStudyMinutes] = useState('60')
  const [started, setStarted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [plan, setPlan] = useState<ExamPlan | null>(null)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])

  const subjects = useMemo(() => Array.from(new Set([...SUBJECTS['O Level'], ...SUBJECTS['A Level']])), [])
  const examSoon = Boolean(plan?.meta?.examSoon)

  async function start() {
    setError('')
    if (!subject || !level || !board || !examDate) {
      setError('Subject, level, board, and exam date are required.')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/exam-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          level,
          board,
          examDate,
          paperType,
          topicFocus: topic,
          availableStudyMinutes: Number(availableStudyMinutes || 60),
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Could not generate exam plan.')
      setPlan(json.plan ?? buildFallbackPlan({ subject, level, board, topic, examDate, paperType }))
    } catch (err) {
      setPlan(buildFallbackPlan({ subject, level, board, topic, examDate, paperType }))
      setError(err instanceof Error ? `${err.message} Local fallback plan shown.` : 'Local fallback plan shown.')
    } finally {
      setStarted(true)
      setLoading(false)
    }
  }

  function send() {
    const text = input.trim()
    if (!text || !plan) return
    const lower = text.toLowerCase()
    const firstFormula = plan.formulas?.[0]
    const firstQuestion = plan.practiceQuestions?.[0]
    const doFirst = plan.studyPlan?.doFirst?.slice(0, 2).join(', ') || plan.meta?.topicFocus || subject
    const reply = lower.includes('formula')
      ? `${firstFormula?.formula ?? 'Formula first.'}\nUse it when: ${firstFormula?.whenToUse ?? 'the variables match the question.'}\nMistake to avoid: ${firstFormula?.commonMistake ?? 'missing units.'}`
      : lower.includes('question')
        ? `${firstQuestion?.question ?? `Try one ${subject} structured question.`}\nMarks: ${firstQuestion?.marks ?? 4}\nMark scheme: ${(firstQuestion?.markScheme ?? ['method [1]', 'answer [1]']).join('; ')}`
        : lower.includes('summary')
          ? `Do first: ${doFirst}. Keep it tight: definitions, formulas, one practice question, mark scheme check.`
          : `Skip low-yield reading for now. Start with ${doFirst}, then mark one answer strictly.`
    setMessages((current) => [...current, { role: 'user', content: text }, { role: 'assistant', content: reply }])
    setInput('')
  }

  return (
    <main style={styles.page}>
      <StarBackground variant="chat" />
      <style>{`
        @media (max-width: 900px) {
          .exam-mode-inputs,
          .exam-mode-cards {
            grid-template-columns: 1fr !important;
          }
          .exam-mode-header {
            align-items: flex-start !important;
            flex-direction: column !important;
          }
        }
      `}</style>
      <nav style={styles.nav}>
        <Logo compact />
        <div style={styles.links}>
          <Link href="/solver" style={styles.link}>Solver</Link>
          <Link href="/dashboard" style={styles.link}>Dashboard</Link>
          <Link href="/mock" style={styles.link}>Mock</Link>
          <Link href="/ai-approach" style={styles.link}>AI Approach</Link>
        </div>
      </nav>

      {!started ? (
        <section style={styles.setup}>
          <h1 style={styles.title}>What&apos;s your exam?</h1>
          <div className="exam-mode-inputs" style={styles.inputs}>
            <select value={level} onChange={(event) => setLevel(event.target.value)} style={styles.field}>
              {LEVELS.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select value={board} onChange={(event) => setBoard(event.target.value)} style={styles.field}>
              {BOARDS.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select value={subject} onChange={(event) => setSubject(event.target.value)} style={styles.field}>
              {subjects.map((item) => <option key={item}>{item}</option>)}
            </select>
            <input value={paperType} onChange={(event) => setPaperType(event.target.value)} placeholder="Paper/component" style={styles.field} />
            <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Optional topic/chapter" style={styles.fieldWide} />
            <input value={availableStudyMinutes} onChange={(event) => setAvailableStudyMinutes(event.target.value)} inputMode="numeric" placeholder="Minutes today" style={styles.field} />
          </div>
          <label style={styles.dateLine}>
            Exam date
            <input type="date" value={examDate} onChange={(event) => setExamDate(event.target.value)} style={styles.dateField} />
          </label>
          {error ? <div style={styles.error}>{error}</div> : null}
          <button type="button" onClick={() => void start()} disabled={loading} style={styles.startButton}>
            {loading ? `Analysing past papers for ${topic || subject}...` : 'Analyse & Start ->'}
          </button>
        </section>
      ) : (
        <section style={styles.workspace}>
          <div className="exam-mode-header" style={styles.headerLine}>
            <div>
              <Badge tone={examSoon ? 'amber' : 'violet'}>{examSoon ? 'Exam soon - focus mode enabled' : 'Exam mode'}</Badge>
              <h1 style={styles.workspaceTitle}>{plan?.meta?.topicFocus || topic || subject} - Past Paper Analysis</h1>
              <p style={styles.muted}>
                {plan?.meta?.board || board} · {plan?.meta?.level || level} · {plan?.meta?.subject || subject} · {plan?.meta?.daysLeft ?? daysUntil(examDate) ?? 'date set'} days left
              </p>
              {plan?.meta?.dataLabel ? <p style={styles.dataLabel}>{plan.meta.dataLabel}</p> : null}
              {error ? <p style={styles.error}>{error}</p> : null}
            </div>
            <button type="button" onClick={() => setStarted(false)} style={styles.ghostButton}>Edit exam</button>
          </div>

          <div className="exam-mode-cards" style={styles.cardGrid}>
            <ExamNightCard title="Most Repeated Topics">
              <ol style={styles.list}>
                {(plan?.mostRepeatedTopics ?? []).slice(0, 5).map((item) => (
                  <li key={item.topic}>{item.topic} {item.frequency ? `(${item.frequency}x)` : ''}</li>
                ))}
              </ol>
            </ExamNightCard>
            <ExamNightCard title="High Probability Topics">
              <ul style={styles.list}>
                {(plan?.highProbabilityTopics ?? []).slice(0, 4).map((item) => (
                  <li key={item.topic}>{item.topic} - {item.confidence || 'pattern-based'}</li>
                ))}
              </ul>
            </ExamNightCard>
            <ExamNightCard title="Formula Revision">
              <ul style={styles.list}>
                {(plan?.formulas ?? []).slice(0, 4).map((item) => (
                  <li key={item.formula}>{item.formula}: {item.whenToUse}</li>
                ))}
              </ul>
            </ExamNightCard>
            <ExamNightCard title="Practice Plan">
              <ul style={styles.list}>
                {(plan?.studyPlan?.fifteenMinutePlan ?? []).map((item) => <li key={item}>15 min: {item}</li>)}
                {(plan?.studyPlan?.thirtyMinutePractice ?? []).slice(0, 2).map((item) => <li key={item}>30 min: {item}</li>)}
              </ul>
            </ExamNightCard>
          </div>

          <div className="exam-mode-cards" style={styles.cardGrid}>
            <ExamNightCard title="Do First">
              <ul style={styles.list}>{(plan?.studyPlan?.doFirst ?? []).map((item) => <li key={item}>{item}</li>)}</ul>
            </ExamNightCard>
            <ExamNightCard title="Skip For Now">
              <ul style={styles.list}>{(plan?.studyPlan?.skipForNow ?? []).map((item) => <li key={item}>{item}</li>)}</ul>
            </ExamNightCard>
            <ExamNightCard title="Theory Rescue">
              <ul style={styles.list}>{(plan?.theoryRescue ?? []).slice(0, 3).map((item) => <li key={item.topic}>{item.topic}: {item.explanation}</li>)}</ul>
            </ExamNightCard>
            <ExamNightCard title="Weakness Boost">
              <ul style={styles.list}>{(plan?.personalWeaknessBoost ?? []).map((item) => <li key={item.topic}>{item.topic}: {item.action}</li>)}</ul>
            </ExamNightCard>
          </div>

          <div style={styles.chatPanel}>
            <div style={styles.chatHistory}>
              <div style={styles.assistant}>Where do you want to start?</div>
              {messages.map((message, index) => (
                <div key={`${message.role}-${index}`} style={message.role === 'user' ? styles.userMsg : styles.assistant}>
                  {message.content}
                </div>
              ))}
            </div>
            <div style={styles.quickActions}>
              {['Skip', 'Formula', 'Question', 'Summary'].map((action) => (
                <button key={action} type="button" onClick={() => setInput(action.toLowerCase())} style={styles.quickButton}>
                  {action}
                </button>
              ))}
            </div>
            <ChatInput value={input} onChange={setInput} onSubmit={send} />
          </div>
        </section>
      )}
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
  setup: {
    alignContent: 'center',
    display: 'grid',
    gap: 18,
    justifyItems: 'center',
    margin: '0 auto',
    minHeight: 'calc(100vh - 88px)',
    padding: '32px 18px',
    position: 'relative',
    width: 'min(980px, 100%)',
    zIndex: 1,
  } satisfies CSSProperties,
  title: {
    color: '#f4eeff',
    fontSize: 'clamp(40px,7vw,72px)',
    fontWeight: 500,
    letterSpacing: '-0.06em',
    margin: 0,
    textAlign: 'center',
  } satisfies CSSProperties,
  inputs: {
    display: 'grid',
    gap: 10,
    gridTemplateColumns: 'repeat(4, minmax(130px, 1fr))',
    width: '100%',
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
  fieldWide: {
    background: '#0a0718',
    border: '1px solid rgba(170,85,255,0.18)',
    borderRadius: 16,
    color: '#f4eeff',
    colorScheme: 'dark',
    fontSize: 14,
    gridColumn: 'span 3',
    outline: 'none',
    padding: '14px',
  } satisfies CSSProperties,
  dateLine: {
    alignItems: 'center',
    color: '#aaa6ca',
    display: 'inline-flex',
    gap: 10,
    fontSize: 13,
  } satisfies CSSProperties,
  dateField: {
    background: 'rgba(255,255,255,0.035)',
    border: '1px solid rgba(170,85,255,0.14)',
    borderRadius: 14,
    color: '#e8e8ff',
    colorScheme: 'dark',
    padding: '10px 12px',
  } satisfies CSSProperties,
  startButton: {
    background: 'linear-gradient(130deg,#7733cc,#aa55ff)',
    border: 'none',
    borderRadius: 999,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 15,
    fontWeight: 800,
    padding: '14px 22px',
  } satisfies CSSProperties,
  error: {
    color: '#fbbf24',
    fontSize: 13,
    margin: 0,
  } satisfies CSSProperties,
  workspace: {
    display: 'grid',
    gap: 22,
    margin: '0 auto',
    padding: '38px clamp(16px,4vw,52px) 52px',
    position: 'relative',
    width: 'min(1180px, 100%)',
    zIndex: 1,
  } satisfies CSSProperties,
  headerLine: {
    alignItems: 'end',
    display: 'flex',
    gap: 18,
    justifyContent: 'space-between',
  } satisfies CSSProperties,
  workspaceTitle: {
    color: '#f4eeff',
    fontSize: 'clamp(30px,5vw,54px)',
    fontWeight: 500,
    letterSpacing: '-0.05em',
    margin: '14px 0 0',
  } satisfies CSSProperties,
  muted: {
    color: '#aaa6ca',
    margin: '8px 0 0',
  } satisfies CSSProperties,
  dataLabel: {
    color: '#c084fc',
    fontSize: 13,
    margin: '8px 0 0',
  } satisfies CSSProperties,
  ghostButton: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(170,85,255,0.16)',
    borderRadius: 999,
    color: '#d8b4fe',
    cursor: 'pointer',
    padding: '10px 14px',
  } satisfies CSSProperties,
  cardGrid: {
    display: 'grid',
    gap: 16,
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  } satisfies CSSProperties,
  list: {
    display: 'grid',
    gap: 8,
    margin: 0,
    paddingLeft: 18,
  } satisfies CSSProperties,
  chatPanel: {
    background: 'rgba(255,255,255,0.035)',
    border: '1px solid rgba(170,85,255,0.12)',
    borderRadius: 26,
    display: 'grid',
    gap: 12,
    padding: 14,
  } satisfies CSSProperties,
  chatHistory: {
    display: 'grid',
    gap: 12,
    minHeight: 120,
  } satisfies CSSProperties,
  assistant: {
    color: '#e8e8ff',
    lineHeight: 1.65,
    whiteSpace: 'pre-wrap',
  } satisfies CSSProperties,
  userMsg: {
    background: 'linear-gradient(130deg,#7c35d8,#a855f7)',
    borderRadius: '18px 18px 4px 18px',
    color: '#fff',
    justifySelf: 'end',
    padding: '10px 14px',
  } satisfies CSSProperties,
  quickActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  } satisfies CSSProperties,
  quickButton: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(170,85,255,0.16)',
    borderRadius: 999,
    color: '#c9c5e8',
    cursor: 'pointer',
    fontSize: 12,
    padding: '8px 11px',
  } satisfies CSSProperties,
}
