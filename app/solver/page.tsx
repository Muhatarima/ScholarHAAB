'use client'

import { ImageUp, Send, X } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import AnswerRenderer from '@/components/AnswerRenderer'
import AuthGuard from '@/components/auth/AuthGuard'
import StarBackground from '@/components/StarBackground'
import { buildSupabaseAuthHeaders } from '@/lib/supabase/auth-headers'

type ChatMessage = {
  content: string
  role: 'assistant' | 'user'
}

async function readJson(response: Response) {
  const text = await response.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return { error: 'The server returned an unreadable response.' }
  }
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      resolve(result.includes(',') ? result.split(',')[1] ?? '' : result)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
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

function SolverInner() {
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  function uploadFiles(files: FileList | null) {
    setError('')
    setSelectedFiles(Array.from(files ?? []).slice(0, 4))
    if (fileRef.current) fileRef.current.value = ''
  }

  async function sendMessage() {
    const question = input.trim()
    if ((!question && selectedFiles.length === 0) || loading) return

    const preview = [question, ...selectedFiles.map((file) => `[${file.name}]`)].filter(Boolean).join('\n')
    const nextMessages: ChatMessage[] = [...messages, { content: preview || '[Attachment]', role: 'user' }]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)
    setError('')

    try {
      const files = await Promise.all(
        selectedFiles.map(async (file) => ({
          base64: await readFileAsBase64(file),
          name: file.name,
          type: file.type || null,
        }))
      )
      const history = messages.slice(-10).map((message) => ({
        content: message.content,
        role: message.role,
      }))
      const response = await fetch('/api/solver', {
        body: JSON.stringify({ files, history, question: question || 'Please solve the uploaded question.' }),
        headers: await buildSupabaseAuthHeaders({ 'Content-Type': 'application/json' }),
        method: 'POST',
      })
      const data = await readJson(response)
      if (!response.ok) throw new Error(errorMessage(data.error, 'Solver failed.'))
      setMessages((current) => [
        ...current,
        {
          content: String(data.answer || data.response || 'I could not solve that yet.'),
          role: 'assistant',
        },
      ])
      setSelectedFiles([])
    } catch (caught) {
      setMessages((current) => [
        ...current,
        {
          content: caught instanceof Error ? caught.message : 'Solver failed.',
          role: 'assistant',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={styles.page}>
      <StarBackground variant="chat" />
      <section style={styles.chat}>
        {!messages.length ? (
          <div style={styles.empty}>
            <h1 style={styles.title}>Solver</h1>
            <p style={styles.muted}>Type a question or upload a photo.</p>
          </div>
        ) : (
          <div style={styles.messages}>
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} style={styles.row(message.role)}>
                <div style={styles.bubble(message.role)}>
                  {message.role === 'assistant' ? <AnswerRenderer content={message.content} /> : message.content}
                </div>
              </div>
            ))}
            {loading ? (
              <div style={styles.row('assistant')}>
                <div style={styles.bubble('assistant')}>Solving...</div>
              </div>
            ) : null}
            <div ref={bottomRef} />
          </div>
        )}
      </section>

      {error ? <div style={styles.error}>{error}</div> : null}

      <form
        style={styles.composer}
        onSubmit={(event) => {
          event.preventDefault()
          void sendMessage()
        }}
      >
        <input
          ref={fileRef}
          accept="image/*,.pdf"
          multiple
          type="file"
          onChange={(event) => uploadFiles(event.target.files)}
          style={{ display: 'none' }}
        />
        {selectedFiles.length ? (
          <div style={styles.attachments}>
            {selectedFiles.map((file) => (
              <span key={`${file.name}-${file.size}`} style={styles.attachment}>
                {file.name}
                <button type="button" onClick={() => setSelectedFiles((current) => current.filter((item) => item !== file))} style={styles.removeAttachment} aria-label={`Remove ${file.name}`}>
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <div style={styles.composerRow}>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={loading} style={styles.iconButton} aria-label="Upload image or PDF">
            <ImageUp size={20} />
          </button>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void sendMessage()
              }
            }}
            placeholder="Message Solver..."
            style={styles.input}
          />
          <button type="submit" disabled={(!input.trim() && selectedFiles.length === 0) || loading} style={styles.send} aria-label="Send">
            <Send size={19} />
          </button>
        </div>
      </form>
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
  bubble: (role: ChatMessage['role']) => ({
    background: role === 'user' ? 'linear-gradient(130deg,#7733cc,#aa55ff)' : 'transparent',
    border: role === 'user' ? 'none' : '0',
    borderRadius: role === 'user' ? '18px 18px 4px 18px' : 8,
    color: '#f4f1ff',
    fontSize: role === 'user' ? 16 : 18,
    lineHeight: role === 'user' ? 1.65 : 1.85,
    maxWidth: role === 'user' ? 'min(760px, 88vw)' : 'min(820px, 92vw)',
    overflowWrap: 'anywhere',
    padding: role === 'user' ? '12px 16px' : '2px 0',
    whiteSpace: 'pre-wrap',
  }) satisfies CSSProperties,
  chat: {
    margin: '0 auto',
    minHeight: 'calc(100vh - 116px)',
    padding: '54px 16px 190px',
    position: 'relative',
    width: 'min(980px, 100%)',
    zIndex: 1,
  } satisfies CSSProperties,
  composer: {
    background: 'rgba(10,8,24,.97)',
    border: '1px solid rgba(176,128,255,.22)',
    borderRadius: 22,
    bottom: 24,
    boxShadow: '0 24px 80px rgba(0,0,0,.48)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    left: '50%',
    padding: 12,
    position: 'fixed',
    transform: 'translateX(-50%)',
    width: 'min(860px, calc(100vw - 32px))',
    zIndex: 20,
  } satisfies CSSProperties,
  attachment: {
    alignItems: 'center',
    background: 'rgba(155,77,255,.14)',
    border: '1px solid rgba(176,128,255,.22)',
    borderRadius: 8,
    color: '#d8ccf2',
    display: 'inline-flex',
    fontSize: 12,
    gap: 6,
    maxWidth: 190,
    overflow: 'hidden',
    padding: '7px 8px',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } satisfies CSSProperties,
  attachments: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    maxWidth: 260,
  } satisfies CSSProperties,
  composerRow: {
    alignItems: 'end',
    display: 'grid',
    gap: 10,
    gridTemplateColumns: '44px minmax(0,1fr) 44px',
    width: '100%',
  } satisfies CSSProperties,
  empty: {
    alignContent: 'center',
    display: 'grid',
    minHeight: 'calc(100vh - 220px)',
    placeItems: 'center',
    textAlign: 'center',
  } satisfies CSSProperties,
  error: {
    bottom: 94,
    color: '#fbbf24',
    left: '50%',
    position: 'fixed',
    transform: 'translateX(-50%)',
    width: 'min(920px, calc(100vw - 28px))',
    zIndex: 21,
  } satisfies CSSProperties,
  iconButton: {
    alignItems: 'center',
    background: 'rgba(255,255,255,.04)',
    border: '1px solid rgba(176,128,255,.16)',
    borderRadius: 8,
    color: '#d8ccf2',
    cursor: 'pointer',
    display: 'inline-flex',
    height: 44,
    justifyContent: 'center',
    width: 44,
  } satisfies CSSProperties,
  input: {
    background: 'transparent',
    border: 0,
    color: '#f4f1ff',
    font: 'inherit',
    maxHeight: 150,
    minHeight: 48,
    outline: 'none',
    padding: '11px 4px',
    resize: 'none',
    width: '100%',
  } satisfies CSSProperties,
  messages: {
    display: 'grid',
    gap: 24,
  } satisfies CSSProperties,
  muted: { color: '#aaa7c8', lineHeight: 1.6, margin: 0 } satisfies CSSProperties,
  page: {
    background: '#02020c',
    color: '#ecebff',
    minHeight: 'calc(100vh - 74px)',
    position: 'relative',
  } satisfies CSSProperties,
  row: (role: ChatMessage['role']) => ({
    display: 'flex',
    justifyContent: role === 'user' ? 'flex-end' : 'flex-start',
  }) satisfies CSSProperties,
  send: {
    alignItems: 'center',
    background: '#9b4dff',
    border: 0,
    borderRadius: 8,
    color: '#fff',
    cursor: 'pointer',
    display: 'inline-flex',
    height: 44,
    justifyContent: 'center',
    width: 44,
  } satisfies CSSProperties,
  removeAttachment: {
    alignItems: 'center',
    background: 'rgba(255,255,255,.08)',
    border: 0,
    borderRadius: 999,
    color: '#f4f1ff',
    cursor: 'pointer',
    display: 'inline-flex',
    height: 20,
    justifyContent: 'center',
    padding: 0,
    width: 20,
  } satisfies CSSProperties,
  title: {
    color: '#f4f1ff',
    fontSize: 'clamp(42px,7vw,76px)',
    fontWeight: 520,
    lineHeight: 1,
    margin: '0 0 10px',
  } satisfies CSSProperties,
} as const
