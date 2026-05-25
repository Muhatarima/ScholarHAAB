'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import AuthGuard from '@/components/auth/AuthGuard'
import RichMessageContent from '@/components/RichMessageContent'
import { createSupabaseClient } from '@/lib/supabase/clientClient'

type Message = {
  role: 'user' | 'assistant'
  content: string
}

type ExamPrepMode = 'start' | 'chat'

const quickActions = [
  { label: '⏭ Skip', message: 'skip' },
  { label: '🔢 Formula', message: 'formula' },
  { label: '📝 Question', message: 'question' },
  { label: '📋 Summary', message: 'summary' },
]

async function buildJsonAuthHeaders() {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  try {
    const {
      data: { session },
    } = await createSupabaseClient().auth.getSession()

    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`
    }
  } catch {
    // Demo mode works without a browser session token.
  }

  return headers
}

function analysisMessage(topic: string) {
  return [
    `📊 ${topic} — Past Paper Analysis`,
    '',
    '🔴 Must know (appeared 8+ times):',
    '· Definitions',
    '· Calculations',
    '',
    '🟡 Important (appeared 4-7 times):',
    '· Explanations',
    '',
    '🟢 Good to know:',
    '· Graphs',
    '',
    'Where do you want to start?',
  ].join('\n')
}

function Logo() {
  return (
    <Link href="/" style={{ display: 'inline-flex', alignItems: 'baseline', gap: 2, textDecoration: 'none' }}>
      <span
        style={{
          color: '#7744aa',
          fontFamily: 'Georgia, serif',
          fontSize: 10,
          fontStyle: 'italic',
          letterSpacing: 3,
          textTransform: 'uppercase',
        }}
      >
        scholar
      </span>
      <span
        style={{
          background: 'linear-gradient(120deg,#cc88ff,#aa55ff,#8833dd)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          fontSize: 20,
          fontWeight: 600,
          letterSpacing: 2,
          textTransform: 'uppercase',
        }}
      >
        HAAB
      </span>
    </Link>
  )
}

function ExamPrepInner() {
  const bottomRef = useRef<HTMLDivElement>(null)
  const [subject, setSubject] = useState('Physics')
  const [topic, setTopic] = useState('')
  const [level, setLevel] = useState('A Level')
  const [examDate, setExamDate] = useState('')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [started, setStarted] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setSubject(params.get('subject') || 'Physics')
    setTopic(params.get('topic') || '')
    setLevel(params.get('level') || 'A Level')
  }, [])

  async function streamExamPrep(nextMessage: string, mode: ExamPrepMode) {
    if (loading) return

    const activeTopic = topic.trim() || 'Forces and Motion'
    const userText = mode === 'start' ? `Start prep: ${subject} · ${activeTopic} · ${level}` : nextMessage.trim()
    if (!userText) return

    const history = messages.slice(-12)
    if (mode === 'start') {
      setLoading(true)
      await new Promise((resolve) => setTimeout(resolve, 1200))
      setStarted(true)
      setMessages([{ role: 'assistant', content: analysisMessage(activeTopic) }])
    } else {
      setMessages((prev) => [...prev, { role: 'user', content: userText }, { role: 'assistant', content: '' }])
    }
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/exam-prep', {
        method: 'POST',
        headers: await buildJsonAuthHeaders(),
        body: JSON.stringify({
          subject,
          topic: activeTopic,
          level,
          message: mode === 'start' ? `Start prep for ${activeTopic}` : nextMessage,
          history,
          mode,
          sessionId,
          examDate,
        }),
      })

      if (!res.ok || !res.body) throw new Error('Exam prep failed')

      const nextSessionId = res.headers.get('x-exam-prep-session-id')
      if (nextSessionId) setSessionId(nextSessionId)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let assistantText = mode === 'start' ? analysisMessage(activeTopic) : ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        if (mode === 'start') {
          assistantText = analysisMessage(activeTopic)
        } else {
          assistantText += chunk
        }
        setMessages((prev) => {
          const next = [...prev]
          if (mode === 'start') {
            next[0] = { role: 'assistant', content: assistantText }
          } else {
            next[next.length - 1] = { role: 'assistant', content: assistantText }
          }
          return next
        })
      }
    } catch {
      if (mode === 'chat') {
        setMessages((prev) => {
          const next = [...prev]
          next[next.length - 1] = { role: 'assistant', content: 'Try again.' }
          return next
        })
      }
    } finally {
      setLoading(false)
    }
  }

  if (!started) {
    return (
      <main style={styles.setupPage}>
        <style>{`
          @media (max-width: 760px) {
            .exam-setup-inputs { grid-template-columns: 1fr !important; }
            .exam-composer { left: 74px !important; right: 12px !important; }
            .exam-actions { left: 74px !important; right: 12px !important; }
          }
        `}</style>
        <Logo />
        <section style={styles.setup}>
          <h1 style={styles.setupTitle}>What&apos;s your exam?</h1>
          <div className="exam-setup-inputs" style={styles.setupInputs}>
            <select value={subject} onChange={(event) => setSubject(event.target.value)} style={styles.field}>
              <option>Physics</option>
              <option>Chemistry</option>
              <option>Mathematics</option>
              <option>Biology</option>
              <option>Economics</option>
              <option>Accounting</option>
            </select>
            <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Chapter/Topic" style={styles.field} />
            <select value={level} onChange={(event) => setLevel(event.target.value)} style={styles.field}>
              <option>A Level</option>
              <option>O Level</option>
              <option>IGCSE</option>
              <option>IAL</option>
            </select>
          </div>
          <label style={styles.dateLine}>
            Exam date:
            <input value={examDate} onChange={(event) => setExamDate(event.target.value)} type="date" style={styles.dateField} />
          </label>
          <button type="button" onClick={() => void streamExamPrep('', 'start')} disabled={loading} style={styles.startButton}>
            {loading ? `Analysing past papers for ${topic || 'topic'}...` : 'Analyse & Start →'}
          </button>
        </section>
      </main>
    )
  }

  return (
    <main style={styles.chatPage}>
      <style>{`
        @media (max-width: 760px) {
          .exam-composer { left: 74px !important; right: 12px !important; }
          .exam-actions { left: 74px !important; right: 12px !important; }
        }
      `}</style>
      <aside style={styles.sidebar}>
        <Logo />
        <button type="button" onClick={() => setStarted(false)} style={styles.sideButton}>
          +
        </button>
        <div style={{ marginTop: 'auto', display: 'grid', gap: 8 }}>
          <Link href="/dashboard" style={styles.iconLink}>
            📊
          </Link>
          <Link href="/qbank" style={styles.iconLink}>
            💬
          </Link>
        </div>
      </aside>

      <section style={styles.chatMain}>
        <div style={styles.history}>
          {messages.map((message, index) => {
            const isUser = message.role === 'user'
            return (
              <div key={`${message.role}-${index}`} style={styles.messageRow(isUser)}>
                <div style={isUser ? styles.userBubble : styles.aiText}>
                  <RichMessageContent content={message.content || '...'} />
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
      </section>

      <div className="exam-actions" style={styles.quickActions}>
        {quickActions.map((action) => (
          <button key={action.message} type="button" onClick={() => void streamExamPrep(action.message, 'chat')} style={styles.quickButton}>
            {action.label}
          </button>
        ))}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          void streamExamPrep(input, 'chat')
        }}
        style={styles.composer}
        className="exam-composer"
      >
        <button type="button" style={styles.attach}>
          📎
        </button>
        <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Type anything..." style={styles.input} />
        <button type="submit" disabled={loading} style={styles.send}>
          →
        </button>
      </form>
    </main>
  )
}

export default function ExamPrepPage() {
  return (
    <AuthGuard>
      <ExamPrepInner />
    </AuthGuard>
  )
}

const styles = {
  setupPage: {
    minHeight: '100vh',
    background: '#00000d',
    color: '#E8E8FF',
    display: 'grid',
    gridTemplateRows: 'auto 1fr',
    justifyItems: 'center',
    padding: 24,
    fontFamily: 'var(--font-sans), sans-serif',
  } satisfies CSSProperties,
  setup: {
    width: 'min(100%, 760px)',
    alignSelf: 'center',
    display: 'grid',
    gap: 18,
    justifyItems: 'center',
  } satisfies CSSProperties,
  setupTitle: {
    color: '#F4EEFF',
    fontSize: 'clamp(34px, 6vw, 58px)',
    fontWeight: 500,
    letterSpacing: '-0.05em',
    margin: 0,
    textAlign: 'center',
  } satisfies CSSProperties,
  setupInputs: {
    width: '100%',
    display: 'grid',
    gridTemplateColumns: '150px 1fr 130px',
    gap: 10,
  } satisfies CSSProperties,
  field: {
    width: '100%',
    border: '1px solid rgba(170,85,255,0.16)',
    borderRadius: 16,
    background: 'rgba(255,255,255,0.04)',
    color: '#E8E8FF',
    outline: 'none',
    padding: '14px 14px',
    fontSize: 14,
  } satisfies CSSProperties,
  dateLine: {
    color: '#9F9FC4',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
  } satisfies CSSProperties,
  dateField: {
    border: '1px solid rgba(170,85,255,0.14)',
    borderRadius: 14,
    background: 'rgba(255,255,255,0.035)',
    color: '#E8E8FF',
    padding: '10px 12px',
  } satisfies CSSProperties,
  startButton: {
    border: 'none',
    borderRadius: 999,
    background: 'linear-gradient(130deg,#7733cc,#aa55ff)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 15,
    fontWeight: 800,
    padding: '13px 20px',
  } satisfies CSSProperties,
  chatPage: {
    minHeight: '100vh',
    background: '#00000d',
    color: '#E8E8FF',
    fontFamily: 'var(--font-sans), sans-serif',
  } satisfies CSSProperties,
  sidebar: {
    position: 'fixed',
    inset: '0 auto 0 0',
    width: 74,
    background: 'rgba(8,7,22,0.96)',
    borderRight: '1px solid rgba(170,85,255,0.1)',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    padding: 14,
    zIndex: 30,
  } satisfies CSSProperties,
  sideButton: {
    border: '1px solid rgba(170,85,255,0.18)',
    borderRadius: 14,
    background: 'rgba(255,255,255,0.04)',
    color: '#E8E8FF',
    cursor: 'pointer',
    height: 42,
  } satisfies CSSProperties,
  iconLink: {
    display: 'grid',
    placeItems: 'center',
    color: '#E8E8FF',
    fontSize: 20,
    height: 44,
    textDecoration: 'none',
  } satisfies CSSProperties,
  chatMain: {
    marginLeft: 74,
    minHeight: '100vh',
    padding: '64px clamp(18px, 5vw, 72px) 154px',
  } satisfies CSSProperties,
  history: {
    display: 'grid',
    gap: 22,
    maxWidth: 860,
    margin: '0 auto',
  } satisfies CSSProperties,
  messageRow: (user: boolean) =>
    ({
      display: 'flex',
      justifyContent: user ? 'flex-end' : 'flex-start',
    }) satisfies CSSProperties,
  userBubble: {
    maxWidth: 'min(76%, 660px)',
    borderRadius: '20px 20px 4px 20px',
    background: 'linear-gradient(130deg,#7c35d8,#a855f7)',
    color: '#fff',
    padding: '11px 15px',
    lineHeight: 1.65,
  } satisfies CSSProperties,
  aiText: {
    maxWidth: 'min(86%, 780px)',
    color: '#E8E8FF',
    lineHeight: 1.75,
  } satisfies CSSProperties,
  quickActions: {
    position: 'fixed',
    left: 94,
    right: 20,
    bottom: 86,
    zIndex: 35,
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  } satisfies CSSProperties,
  quickButton: {
    border: '1px solid rgba(170,85,255,0.16)',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.04)',
    color: '#c9c5e8',
    cursor: 'pointer',
    fontSize: 12,
    padding: '8px 11px',
  } satisfies CSSProperties,
  composer: {
    position: 'fixed',
    zIndex: 40,
    left: 94,
    right: 20,
    bottom: 18,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    border: '1px solid rgba(170,85,255,0.16)',
    borderRadius: 24,
    background: 'rgba(12,10,28,0.96)',
    boxShadow: '0 18px 60px rgba(0,0,0,0.34)',
    padding: 9,
  } satisfies CSSProperties,
  attach: {
    width: 38,
    height: 38,
    border: 'none',
    borderRadius: 999,
    background: 'transparent',
    color: '#9F9FC4',
    fontSize: 18,
  } satisfies CSSProperties,
  input: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: '#E8E8FF',
    fontSize: 15,
    minWidth: 0,
    padding: '10px 2px',
  } satisfies CSSProperties,
  send: {
    width: 40,
    height: 40,
    border: 'none',
    borderRadius: 999,
    background: 'linear-gradient(130deg,#7733cc,#aa55ff)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 18,
    fontWeight: 900,
  } satisfies CSSProperties,
}
