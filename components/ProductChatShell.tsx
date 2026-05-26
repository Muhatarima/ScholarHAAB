'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import RichMessageContent from '@/components/RichMessageContent'
import StarBackdrop from '@/components/StarBackdrop'
import type { Product, PromptMode } from '@/lib/products'
import { createSupabaseClient } from '@/lib/supabase/clientClient'

type SourceCitation = {
  title?: string
  source?: string
  url?: string | null
  label?: string
  year?: number | string | null
  paper?: string | null
}

type Message = {
  id?: string
  role: 'user' | 'assistant'
  content: string
  sources?: SourceCitation[]
}

type ChatSessionSummary = {
  id: string
  title: string
  lastMessagePreview?: string
  updatedAt?: string
}

type UsageState = {
  remainingCredits?: number
  usedCredits?: number
}

const ENDPOINT = '/api/qbank/chat'
const SUGGESTIONS = [
  'Explain photosynthesis',
  'Force and motion formulas',
  '2022 Chemistry paper questions',
  'Test me on calculus',
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
    // Demo mode can still run without a client session.
  }

  return headers
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

function Logo({ compact = false }: { compact?: boolean }) {
  const curveId = compact ? 'chatScholarCurveCompact' : 'chatScholarCurveFull'
  const gradientId = compact ? 'chatHaabGradientCompact' : 'chatHaabGradientFull'

  return (
    <Link href="/" style={{ display: 'inline-flex', lineHeight: 0, textDecoration: 'none' }} aria-label="ScholarHAAB home">
      <svg width={compact ? 104 : 136} height={compact ? 42 : 54} viewBox="0 0 136 54" role="img" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="24" x2="112" y1="18" y2="48" gradientUnits="userSpaceOnUse">
            <stop stopColor="#d7a0ff" />
            <stop offset="0.52" stopColor="#b867ff" />
            <stop offset="1" stopColor="#8f38f0" />
          </linearGradient>
          <path id={curveId} d="M 18 23 Q 68 4 118 23" />
        </defs>
        <text
          fill="#9f5df7"
          fontFamily="Georgia, serif"
          fontSize={compact ? 10 : 11}
          fontStyle="italic"
          letterSpacing={compact ? 4 : 5}
          opacity="0.92"
        >
          <textPath href={`#${curveId}`} startOffset="50%" textAnchor="middle">
            SCHOLAR
          </textPath>
        </text>
        <text
          x="68"
          y="45"
          fill={`url(#${gradientId})`}
          fontFamily="var(--font-sans), sans-serif"
          fontSize={compact ? 28 : 31}
          fontWeight="800"
          letterSpacing={compact ? 3 : 4}
          textAnchor="middle"
        >
          HAAB
        </text>
      </svg>
    </Link>
  )
}

function sourceText(sources?: SourceCitation[]) {
  const source = sources?.[0]
  if (!source) return ''
  return String(source.title || source.source || source.label || 'Cambridge mark scheme')
}

function formatRelativeDate(value?: string) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(parsed)
}

export default function ProductChatShell({ product }: { product: Product }) {
  void product
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<PromptMode>('direct')
  const [loading, setLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [usage, setUsage] = useState<UsageState | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    void refreshSessions()
  }, [])

  async function refreshSessions() {
    try {
      const res = await fetch('/api/history?product=qbank', { cache: 'no-store' })
      const data = await res.json()
      setSessions(Array.isArray(data.sessions) ? data.sessions : [])
    } catch {
      setSessions([])
    }
  }

  async function loadSession(nextSessionId: string) {
    if (loading) return
    try {
      const res = await fetch(`/api/history/${nextSessionId}`, { cache: 'no-store' })
      const data = await res.json()
      const nextMessages = Array.isArray(data.messages) ? data.messages : []
      setSessionId(nextSessionId)
      setMessages(
        nextMessages.map((entry: Message) => ({
          id: entry.id,
          role: entry.role,
          content: entry.content,
          sources: entry.sources,
        }))
      )
      if (data.session?.mode === 'direct' || data.session?.mode === 'tutor') {
        setMode(data.session.mode)
      }
    } catch {
      setMessages([])
    }
  }

  function newChat() {
    setSessionId(null)
    setMessages([])
    setInput('')
    setSelectedFiles([])
    setMode('direct')
  }

  async function signOut() {
    await createSupabaseClient().auth.signOut()
    window.location.href = '/login'
  }

  async function sendMessage(preset?: string) {
    const text = (preset ?? input).trim()
    if ((!text && selectedFiles.length === 0) || loading) return

    const preview = [text, ...selectedFiles.map((file) => `[${file.name}]`)].filter(Boolean).join('\n')
    setMessages((current) => [...current, { role: 'user', content: preview || '📎' }])
    setInput('')
    setLoading(true)

    try {
      const files = await Promise.all(
        selectedFiles.map(async (file) => ({
          base64: await readFileAsBase64(file),
          type: file.type || null,
          name: file.name,
        }))
      )
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: await buildJsonAuthHeaders(),
        body: JSON.stringify({
          message: text,
          mode,
          sessionId,
          files,
        }),
      })
      const data = await res.json()
      if (typeof data.sessionId === 'string') setSessionId(data.sessionId)
      if (data.usage) setUsage(data.usage)
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: data.answer || data.response || data.error || 'Try again.',
          sources: Array.isArray(data.sources)
            ? data.sources
            : data.truth?.source
              ? [{ title: String(data.truth.source) }]
              : undefined,
        },
      ])
      setSelectedFiles([])
      void refreshSessions()
    } catch {
      setMessages((current) => [...current, { role: 'assistant', content: 'Try again.' }])
    } finally {
      setLoading(false)
    }
  }

  const credits = usage?.remainingCredits ?? usage?.usedCredits ?? 0
  const hasMessages = messages.length > 0

  return (
    <main style={styles.shell}>
      <StarBackdrop variant="chat" />
      <style>{`
        .mobile-chat-logo,
        .mobile-new-chat,
        .mobile-actions {
          display: none;
        }
        @media (max-width: 760px) {
          .shaab-sidebar {
            display: none !important;
          }
          .shaab-main {
            margin-left: 0 !important;
            padding: 76px 18px 118px !important;
          }
          .shaab-composer {
            left: 16px !important;
            right: 16px !important;
            width: auto !important;
            bottom: 14px !important;
          }
          .mobile-chat-logo {
            display: block !important;
            position: fixed;
            top: 17px;
            left: 18px;
            z-index: 25;
          }
          .mobile-new-chat {
            display: inline-grid !important;
            place-items: center;
          }
          .mobile-actions {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>

      <aside className={sidebarOpen ? 'shaab-sidebar shaab-sidebar-open' : 'shaab-sidebar'} style={styles.sidebar(sidebarOpen)}>
        <button type="button" onClick={() => setSidebarOpen((value) => !value)} style={styles.logoButton}>
          <Logo compact={!sidebarOpen} />
        </button>

        <button type="button" onClick={newChat} style={styles.newChat}>
          {sidebarOpen ? 'New chat +' : '+'}
        </button>

        <div className="shaab-session-list" style={styles.sessions}>
          {sessions.slice(0, 12).map((session) => (
            <button key={session.id} type="button" onClick={() => void loadSession(session.id)} style={styles.sessionButton}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {session.title || session.lastMessagePreview || 'Chat'}
              </span>
              <span style={{ color: '#77779d', fontSize: 11 }}>{formatRelativeDate(session.updatedAt)}</span>
            </button>
          ))}
        </div>

        <div style={styles.sidebarBottom}>
          <Link href="/dashboard" style={styles.iconLink} title="Dashboard">
            📊
          </Link>
          <Link href="/exam-prep" style={styles.iconLink} title="Exam Mode">
            🎯
          </Link>
          <button type="button" onClick={() => void signOut()} style={styles.iconButton} title="Profile">
            👤
          </button>
        </div>
      </aside>

      <section className="shaab-main" style={styles.main(sidebarOpen)}>
        <div className="mobile-chat-logo">
          <Logo compact />
        </div>
        <header style={styles.topbar}>
          <div style={styles.modeTabs}>
            {(['direct', 'tutor'] as PromptMode[]).map((item) => (
              <button key={item} type="button" onClick={() => setMode(item)} style={styles.modeTab(mode === item)}>
                {item === 'direct' ? 'Direct' : 'Tutor'}
              </button>
            ))}
          </div>
          <button type="button" onClick={newChat} className="mobile-new-chat" style={styles.mobileNewChat} title="New chat">
            +
          </button>
          <div style={styles.credit}>{credits}</div>
        </header>

        {!hasMessages ? (
          <div style={styles.empty}>
            <h1 style={styles.emptyTitle}>What are you studying?</h1>
            <div style={styles.chips}>
              {SUGGESTIONS.map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => void sendMessage(suggestion)} style={styles.chip}>
                  {suggestion}
                </button>
              ))}
            </div>
            <div className="mobile-actions" style={styles.mobileActions}>
              <button type="button" onClick={newChat} style={styles.mobileActionCard}>
                <span style={styles.mobileActionIcon}>+</span>
                <span>New chat</span>
              </button>
              <Link href="/dashboard" style={styles.mobileActionCard}>
                <span style={styles.mobileActionIcon}>📊</span>
                <span>Dashboard</span>
              </Link>
              <Link href="/exam-prep" style={styles.mobileActionCard}>
                <span style={styles.mobileActionIcon}>🎯</span>
                <span>Exam mode</span>
              </Link>
              <button type="button" onClick={() => void signOut()} style={styles.mobileActionCard}>
                <span style={styles.mobileActionIcon}>👤</span>
                <span>Profile</span>
              </button>
            </div>
          </div>
        ) : (
          <div style={styles.history}>
            {messages.map((message, index) => {
              const isUser = message.role === 'user'
              const citation = sourceText(message.sources)
              return (
                <div key={`${message.role}-${index}-${message.id ?? ''}`} style={styles.messageRow(isUser)}>
                  <div style={isUser ? styles.userBubble : styles.aiText}>
                    <RichMessageContent content={message.content} />
                    {!isUser && citation ? <div style={styles.source}>{citation}</div> : null}
                  </div>
                </div>
              )
            })}
            {loading ? (
              <div style={styles.messageRow(false)}>
                <div style={styles.aiText}>...</div>
              </div>
            ) : null}
            <div ref={bottomRef} />
          </div>
        )}
      </section>

      <form
        className="shaab-composer"
        onSubmit={(event) => {
          event.preventDefault()
          void sendMessage()
        }}
        style={styles.composer(sidebarOpen)}
      >
        <input
          ref={fileRef}
          type="file"
          multiple
          onChange={(event) => setSelectedFiles(Array.from(event.target.files ?? []).slice(0, 4))}
          style={{ display: 'none' }}
        />
        <button type="button" onClick={() => fileRef.current?.click()} style={styles.attach}>
          📎
        </button>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={selectedFiles[0] ? selectedFiles.map((file) => file.name).join(', ') : 'Type anything...'}
          style={styles.input}
        />
        <button type="submit" disabled={loading} style={styles.send}>
          →
        </button>
      </form>
    </main>
  )
}

const styles = {
  shell: {
    minHeight: '100vh',
    background: '#00000d',
    color: '#E8E8FF',
    fontFamily: 'var(--font-sans), sans-serif',
    overflow: 'hidden',
    position: 'relative',
  } satisfies CSSProperties,
  sidebar: (open: boolean) =>
    ({
      position: 'fixed',
      inset: '0 auto 0 0',
      zIndex: 30,
      width: open ? 252 : 74,
      background: 'rgba(8,7,22,0.96)',
      borderRight: '1px solid rgba(170,85,255,0.1)',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      padding: 14,
      transition: 'width 160ms ease',
    }) satisfies CSSProperties,
  logoButton: {
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    padding: 0,
    textAlign: 'left',
  } satisfies CSSProperties,
  newChat: {
    border: '1px solid rgba(170,85,255,0.18)',
    borderRadius: 14,
    background: 'rgba(255,255,255,0.04)',
    color: '#E8E8FF',
    cursor: 'pointer',
    fontSize: 13,
    padding: '11px 12px',
    textAlign: 'left',
  } satisfies CSSProperties,
  sessions: {
    display: 'grid',
    gap: 6,
    overflow: 'auto',
  } satisfies CSSProperties,
  sessionButton: {
    border: 'none',
    borderRadius: 12,
    background: 'transparent',
    color: '#c9c5e8',
    cursor: 'pointer',
    display: 'grid',
    gap: 3,
    fontSize: 13,
    padding: '9px 10px',
    textAlign: 'left',
  } satisfies CSSProperties,
  sidebarBottom: {
    marginTop: 'auto',
    display: 'grid',
    gap: 8,
  } satisfies CSSProperties,
  iconLink: {
    borderRadius: 14,
    color: '#E8E8FF',
    display: 'grid',
    fontSize: 20,
    height: 44,
    placeItems: 'center',
    textDecoration: 'none',
  } satisfies CSSProperties,
  iconButton: {
    border: 'none',
    borderRadius: 14,
    background: 'transparent',
    color: '#E8E8FF',
    cursor: 'pointer',
    fontSize: 20,
    height: 44,
  } satisfies CSSProperties,
  main: (open: boolean) =>
    ({
      minHeight: '100vh',
      marginLeft: open ? 252 : 74,
      padding: '64px clamp(18px, 5vw, 72px) 116px',
      position: 'relative',
      transition: 'margin-left 160ms ease',
      zIndex: 1,
    }) satisfies CSSProperties,
  topbar: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    height: 54,
    display: 'grid',
    placeItems: 'center',
    pointerEvents: 'none',
  } satisfies CSSProperties,
  modeTabs: {
    display: 'inline-flex',
    gap: 10,
    pointerEvents: 'auto',
  } satisfies CSSProperties,
  modeTab: (active: boolean) =>
    ({
      border: 'none',
      background: 'transparent',
      color: active ? '#E8E8FF' : '#77779d',
      cursor: 'pointer',
      fontSize: 13,
      padding: 4,
    }) satisfies CSSProperties,
  credit: {
    position: 'fixed',
    top: 18,
    right: 22,
    color: '#9F9FC4',
    fontSize: 12,
    pointerEvents: 'auto',
  } satisfies CSSProperties,
  mobileNewChat: {
    position: 'fixed',
    top: 11,
    right: 54,
    zIndex: 25,
    width: 32,
    height: 32,
    border: '1px solid rgba(170,85,255,0.18)',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.04)',
    color: '#E8E8FF',
    cursor: 'pointer',
    fontSize: 18,
    lineHeight: 1,
    pointerEvents: 'auto',
  } satisfies CSSProperties,
  empty: {
    minHeight: 'calc(100vh - 180px)',
    display: 'grid',
    placeContent: 'center',
    justifyItems: 'center',
    textAlign: 'center',
  } satisfies CSSProperties,
  emptyTitle: {
    color: '#F4EEFF',
    fontSize: 'clamp(32px, 6vw, 54px)',
    fontWeight: 500,
    letterSpacing: '-0.045em',
    margin: 0,
  } satisfies CSSProperties,
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: 24,
    maxWidth: 560,
  } satisfies CSSProperties,
  chip: {
    border: '1px solid rgba(170,85,255,0.14)',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.035)',
    color: '#aaa6ca',
    cursor: 'pointer',
    fontSize: 13,
    padding: '9px 12px',
  } satisfies CSSProperties,
  mobileActions: {
    gap: 10,
    marginTop: 18,
    width: 'min(100%, 360px)',
  } satisfies CSSProperties,
  mobileActionCard: {
    alignItems: 'center',
    border: '1px solid rgba(170,85,255,0.14)',
    borderRadius: 18,
    background: 'rgba(255,255,255,0.035)',
    color: '#d8d2f2',
    cursor: 'pointer',
    display: 'flex',
    gap: 9,
    minHeight: 48,
    padding: '11px 12px',
    textAlign: 'left',
    textDecoration: 'none',
    fontFamily: 'inherit',
    fontSize: 13,
  } satisfies CSSProperties,
  mobileActionIcon: {
    display: 'inline-grid',
    placeItems: 'center',
    width: 22,
    color: '#ba7cff',
    fontSize: 17,
  } satisfies CSSProperties,
  history: {
    display: 'grid',
    gap: 22,
    maxWidth: 860,
    margin: '0 auto',
    width: '100%',
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
    paddingTop: 4,
  } satisfies CSSProperties,
  source: {
    color: '#77779d',
    fontSize: 11,
    marginTop: 8,
  } satisfies CSSProperties,
  composer: (open: boolean) =>
    ({
      position: 'fixed',
      zIndex: 40,
      left: open ? 272 : 94,
      bottom: 18,
      width: open ? 'calc(100vw - 304px)' : 'calc(100vw - 126px)',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      border: '1px solid rgba(170,85,255,0.16)',
      borderRadius: 24,
      background: 'rgba(12,10,28,0.96)',
      boxShadow: '0 18px 60px rgba(0,0,0,0.34)',
      padding: 9,
      transition: 'left 160ms ease, width 160ms ease',
    }) satisfies CSSProperties,
  attach: {
    width: 38,
    height: 38,
    border: 'none',
    borderRadius: 999,
    background: 'transparent',
    color: '#9F9FC4',
    cursor: 'pointer',
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
