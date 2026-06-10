'use client'

import { ImageUp, Send, Sparkles } from 'lucide-react'
import { useMemo, useState, type CSSProperties } from 'react'
import AnswerRenderer from '@/components/AnswerRenderer'
import AuthGuard from '@/components/auth/AuthGuard'
import StarBackground from '@/components/StarBackground'
import { recognizeImage } from '@/lib/ocr/tesseract'
import { buildSupabaseAuthHeaders } from '@/lib/supabase/auth-headers'

type Message = {
  answer?: string
  question: string
  sources?: Source[]
}

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

function SolverInner() {
  const [question, setQuestion] = useState('')
  const [subject, setSubject] = useState('')
  const [topic, setTopic] = useState('')
  const [ocrText, setOcrText] = useState('')
  const [loading, setLoading] = useState(false)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [error, setError] = useState('')
  const [messages, setMessages] = useState<Message[]>([])

  const combinedQuestion = useMemo(
    () => [question.trim(), ocrText.trim()].filter(Boolean).join('\n\n'),
    [ocrText, question]
  )

  async function uploadImage(file: File | null) {
    if (!file) return
    setOcrLoading(true)
    setError('')
    try {
      const text = await recognizeImage(file)
      setOcrText(text)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Image text extraction failed.')
    } finally {
      setOcrLoading(false)
    }
  }

  async function ask() {
    if (!combinedQuestion.trim()) {
      setError('Write a question or upload an image first.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const history = messages.flatMap((message) => [
        { role: 'user' as const, content: message.question },
        ...(message.answer ? [{ role: 'assistant' as const, content: message.answer }] : []),
      ])
      const response = await fetch('/api/solver', {
        body: JSON.stringify({
          history,
          question: combinedQuestion,
          subject: subject.trim() || null,
          topic: topic.trim() || null,
        }),
        headers: await buildSupabaseAuthHeaders({ 'Content-Type': 'application/json' }),
        method: 'POST',
      })
      const data = await readJson(response)
      if (!response.ok) throw new Error(data.error || 'Solver failed.')

      setMessages((items) => [
        ...items,
        {
          answer: String(data.answer || ''),
          question: combinedQuestion,
          sources: Array.isArray(data.sources) ? data.sources : [],
        },
      ])
      setQuestion('')
      setOcrText('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Solver failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={styles.page}>
      <StarBackground variant="chat" />
      <section style={styles.shell}>
        <header style={styles.header}>
          <span style={styles.eyebrow}>Solver</span>
          <h1 style={styles.title}>Ask a question. Get the working.</h1>
        </header>

        <div style={styles.controls}>
          <input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Subject (optional)" style={styles.field} />
          <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Topic (optional)" style={styles.field} />
        </div>

        <div style={styles.askBox}>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Paste or type the exact question..."
            style={styles.textarea}
          />
          {ocrText ? (
            <div style={styles.ocrBox}>
              <strong>Image text</strong>
              <p>{ocrText}</p>
            </div>
          ) : null}
          <div style={styles.actions}>
            <label style={styles.upload}>
              <ImageUp size={17} />
              {ocrLoading ? 'Reading image...' : 'Upload image'}
              <input
                accept="image/*"
                type="file"
                onChange={(event) => void uploadImage(event.target.files?.[0] ?? null)}
                style={{ display: 'none' }}
              />
            </label>
            <button type="button" onClick={() => void ask()} disabled={loading || ocrLoading} style={styles.primary}>
              {loading ? <Sparkles size={17} /> : <Send size={17} />}
              {loading ? 'Solving...' : 'Solve'}
            </button>
          </div>
        </div>

        {error ? <p style={styles.error}>{error}</p> : null}

        <div style={styles.thread}>
          {messages.map((message, index) => (
            <article key={`${index}-${message.question}`} style={styles.message}>
              <div style={styles.userBubble}>{message.question}</div>
              {message.answer ? (
                <div style={styles.answer}>
                  <AnswerRenderer content={message.answer} />
                  {message.sources?.length ? (
                    <div style={styles.sources}>
                      <strong>Sources</strong>
                      {message.sources.slice(0, 5).map((source, sourceIndex) => (
                        <span key={`${source.id}-${sourceIndex}`}>{sourceLine(source)}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))}
          {!messages.length ? (
            <div style={styles.empty}>Upload a question image or type a topic to start.</div>
          ) : null}
        </div>
      </section>
    </main>
  )
}

export default function SolverPage() {
  return (
    <AuthGuard>
      <SolverInner />
    </AuthGuard>
  )
}

const styles = {
  actions: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  } satisfies CSSProperties,
  answer: {
    background: 'rgba(255,255,255,.035)',
    border: '1px solid rgba(176,128,255,.14)',
    borderRadius: 8,
    padding: 18,
  } satisfies CSSProperties,
  askBox: {
    background: 'rgba(255,255,255,.025)',
    border: '1px solid rgba(176,128,255,.14)',
    borderRadius: 8,
    display: 'grid',
    gap: 12,
    padding: 14,
  } satisfies CSSProperties,
  controls: {
    display: 'grid',
    gap: 10,
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  } satisfies CSSProperties,
  empty: {
    color: '#aaa7c8',
    display: 'grid',
    minHeight: 200,
    placeItems: 'center',
  } satisfies CSSProperties,
  error: {
    color: '#fbbf24',
    lineHeight: 1.6,
  } satisfies CSSProperties,
  eyebrow: {
    color: '#b983ff',
    fontSize: 12,
    fontWeight: 850,
    textTransform: 'uppercase',
  } satisfies CSSProperties,
  field: {
    background: '#090816',
    border: '1px solid rgba(176,128,255,.18)',
    borderRadius: 8,
    color: '#f4f1ff',
    height: 44,
    outline: 'none',
    padding: '0 12px',
  } satisfies CSSProperties,
  header: {
    display: 'grid',
    gap: 8,
  } satisfies CSSProperties,
  message: {
    display: 'grid',
    gap: 14,
  } satisfies CSSProperties,
  ocrBox: {
    background: 'rgba(74,222,128,.05)',
    border: '1px solid rgba(74,222,128,.18)',
    borderRadius: 8,
    color: '#d8fce5',
    lineHeight: 1.65,
    padding: 12,
  } satisfies CSSProperties,
  page: {
    background: '#02020c',
    color: '#ecebff',
    minHeight: 'calc(100vh - 74px)',
    position: 'relative',
  } satisfies CSSProperties,
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
    padding: '0 18px',
  } satisfies CSSProperties,
  shell: {
    display: 'grid',
    gap: 18,
    margin: '0 auto',
    padding: '42px 16px 72px',
    position: 'relative',
    width: 'min(980px, 100%)',
    zIndex: 1,
  } satisfies CSSProperties,
  sources: {
    borderTop: '1px solid rgba(176,128,255,.12)',
    color: '#bcb5d8',
    display: 'grid',
    fontSize: 13,
    gap: 7,
    marginTop: 16,
    paddingTop: 12,
  } satisfies CSSProperties,
  textarea: {
    background: '#070614',
    border: '1px solid rgba(176,128,255,.18)',
    borderRadius: 8,
    color: '#f4f1ff',
    minHeight: 140,
    outline: 'none',
    padding: 14,
    resize: 'vertical',
    width: '100%',
  } satisfies CSSProperties,
  thread: {
    display: 'grid',
    gap: 18,
  } satisfies CSSProperties,
  title: {
    fontSize: 'clamp(34px,6vw,62px)',
    fontWeight: 520,
    lineHeight: 1,
    margin: 0,
  } satisfies CSSProperties,
  upload: {
    alignItems: 'center',
    border: '1px solid rgba(176,128,255,.24)',
    borderRadius: 8,
    color: '#d8ccf2',
    cursor: 'pointer',
    display: 'inline-flex',
    fontWeight: 800,
    gap: 8,
    height: 44,
    padding: '0 14px',
  } satisfies CSSProperties,
  userBubble: {
    alignSelf: 'end',
    background: 'linear-gradient(135deg,#7c3aed,#b45cff)',
    borderRadius: '18px 18px 4px 18px',
    justifySelf: 'end',
    lineHeight: 1.55,
    maxWidth: 'min(760px, 100%)',
    overflowWrap: 'anywhere',
    padding: '12px 16px',
  } satisfies CSSProperties,
} as const
