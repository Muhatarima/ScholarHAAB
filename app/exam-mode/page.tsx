'use client'

import Link from 'next/link'
import { useMemo, useState, type CSSProperties } from 'react'
import AuthGuard from '@/components/auth/AuthGuard'
import Badge from '@/components/Badge'
import ChatInput from '@/components/ChatInput'
import ExamNightCard from '@/components/ExamNightCard'
import Logo from '@/components/Logo'
import StarBackground from '@/components/StarBackground'

const subjectDefaults: Record<string, string[]> = {
  Physics: ['wave speed equation', 'definitions of amplitude and wavelength', 'ray diagrams', 'calculation with units'],
  Chemistry: ['ionic structure', 'rate of reaction', 'moles calculations', 'bonding explanations'],
  Mathematics: ['method marks', 'calculus setup', 'algebraic manipulation', 'final exact form'],
  Biology: ['process sequence', 'keywords', 'graph interpretation', 'structure to function links'],
  Economics: ['diagram labels', 'chain of reasoning', 'definition accuracy', 'evaluation point'],
  Accounting: ['format', 'calculation layout', 'working notes', 'final balance'],
}

function daysUntil(date: string) {
  if (!date) return null
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return null
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.ceil((parsed.getTime() - today.getTime()) / 86_400_000)
}

function ExamModeInner() {
  const [subject, setSubject] = useState('Physics')
  const [board, setBoard] = useState('Cambridge')
  const [level, setLevel] = useState('A Level')
  const [topic, setTopic] = useState('wave motion')
  const [examDate, setExamDate] = useState('')
  const [started, setStarted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])
  const remainingDays = daysUntil(examDate)
  const examSoon = remainingDays !== null && remainingDays <= 3
  const important = useMemo(() => {
    const base = subjectDefaults[subject] ?? subjectDefaults.Physics
    const normalizedTopic = topic.trim() || 'core topic'
    return [normalizedTopic, ...base].slice(0, 5)
  }, [subject, topic])

  async function start() {
    setLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 900))
    setStarted(true)
    setLoading(false)
  }

  function send() {
    const text = input.trim()
    if (!text) return
    const lower = text.toLowerCase()
    const reply = lower.includes('formula')
      ? `Formula revision for ${topic}: write the formula first, define every symbol, then substitute with units.`
      : lower.includes('question')
        ? `Mini mock: A ${level} ${subject} question on ${topic}. Show method marks, final answer, and one examiner keyword. [4 marks]`
        : `Focus answer: start with ${important[0]}, then practise one calculation and one explain question. Skip low-yield notes until the core is secure.`
    setMessages((current) => [...current, { role: 'user', content: text }, { role: 'assistant', content: reply }])
    setInput('')
  }

  return (
    <main style={styles.page}>
      <StarBackground variant="chat" />
      <style>{`
        @media (max-width: 860px) {
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
          <Link href="/ai-approach" style={styles.link}>AI Approach</Link>
        </div>
      </nav>

      {!started ? (
        <section style={styles.setup}>
          <h1 style={styles.title}>What&apos;s your exam?</h1>
          <div className="exam-mode-inputs" style={styles.inputs}>
            <select value={subject} onChange={(event) => setSubject(event.target.value)} style={styles.field}>
              {Object.keys(subjectDefaults).map((item) => <option key={item}>{item}</option>)}
            </select>
            <select value={board} onChange={(event) => setBoard(event.target.value)} style={styles.field}>
              <option>Cambridge</option>
              <option>Edexcel</option>
            </select>
            <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Chapter/Topic" style={styles.field} />
            <select value={level} onChange={(event) => setLevel(event.target.value)} style={styles.field}>
              <option>A Level</option>
              <option>O Level</option>
              <option>IAL</option>
              <option>IGCSE</option>
            </select>
          </div>
          <label style={styles.dateLine}>
            Exam date
            <input type="date" value={examDate} onChange={(event) => setExamDate(event.target.value)} style={styles.dateField} />
          </label>
          {examSoon ? <Badge tone="amber">Exam soon - focus mode enabled</Badge> : null}
          <button type="button" onClick={() => void start()} style={styles.startButton}>
            {loading ? `Analysing past papers for ${topic || subject}...` : 'Analyse & Start ->'}
          </button>
        </section>
      ) : (
        <section style={styles.workspace}>
          <div className="exam-mode-header" style={styles.headerLine}>
            <div>
              <Badge tone={examSoon ? 'amber' : 'violet'}>{examSoon ? 'Focus mode' : 'Exam mode'}</Badge>
              <h1 style={styles.workspaceTitle}>{topic || subject} — Past Paper Analysis</h1>
              <p style={styles.muted}>{board} · {level} · {remainingDays === null ? 'exam date not set' : `${Math.max(0, remainingDays)} days left`}</p>
            </div>
            <button type="button" onClick={() => setStarted(false)} style={styles.ghostButton}>Edit exam</button>
          </div>

          <div className="exam-mode-cards" style={styles.cardGrid}>
            <ExamNightCard title="Most Important Topics">
              <ol style={styles.list}>
                {important.slice(0, 4).map((item) => <li key={item}>{item}</li>)}
              </ol>
            </ExamNightCard>
            <ExamNightCard title="Formula Revision">
              <ul style={styles.list}>
                <li>Write the formula before numbers.</li>
                <li>Define symbols and units.</li>
                <li>Circle the final answer with unit.</li>
              </ul>
            </ExamNightCard>
            <ExamNightCard title="Practice Overview">
              <ul style={styles.list}>
                <li>15 min weak topic drill</li>
                <li>30 min mini mock</li>
                <li>Review wrong answers immediately</li>
              </ul>
            </ExamNightCard>
            <ExamNightCard title="Emergency Plan">
              <ul style={styles.list}>
                <li>Do first: {important[0]}</li>
                <li>Then: one explain question</li>
                <li>Skip for now: low-yield reading</li>
              </ul>
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
    width: 'min(920px, 100%)',
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
    gridTemplateColumns: '150px 140px 1fr 130px',
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
