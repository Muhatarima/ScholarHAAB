'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import AIReasoningBadge from '@/components/AIReasoningBadge'
import RichMessageContent from '@/components/RichMessageContent'
import SourceCard from '@/components/SourceCard'
import StarBackdrop from '@/components/StarBackdrop'
import VerifiedBadge from '@/components/VerifiedBadge'
import type { Product, PromptMode } from '@/lib/products'
import { createSupabaseClient } from '@/lib/supabase/clientClient'

type SourceCitation = {
  board?: string
  level?: string
  subject?: string
  title?: string
  source?: string
  url?: string | null
  label?: string
  year?: number | string | null
  paper?: string | null
  question_number?: string | number | null
  marks?: number | null
  source_url?: string | null
}

type Message = {
  id?: string
  role: 'user' | 'assistant'
  content: string
  sources?: SourceCitation[]
  confidence?: string
  confidenceBadge?: string
  confidenceScore?: number
  chapterGap?: {
    skippedTopic?: string
    currentTopic?: string
    recommendation?: string
  }
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

type FilePreview = {
  name: string
  type: string
  url?: string
}

type ThemeIconName = 'dashboard' | 'exam' | 'logout' | 'file' | 'attach'

const ENDPOINT = '/api/qbank/chat'
const SUGGESTIONS = [
  'wave motion Physics 2021',
  'waev motion phsyics 2021',
  'bhai integration bujhte parchi na',
  '2022 Chemistry paper questions',
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

function LogoSvg({ compact = false }: { compact?: boolean }) {
  const curveId = compact ? 'chatScholarCurveCompact' : 'chatScholarCurveFull'
  const gradientId = compact ? 'chatHaabGradientCompact' : 'chatHaabGradientFull'

  return (
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
  )
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" style={{ display: 'inline-flex', lineHeight: 0, textDecoration: 'none' }} aria-label="ScholarHAAB home">
      <LogoSvg compact={compact} />
    </Link>
  )
}

function ThemeIcon({ name, size = 20 }: { name: ThemeIconName; size?: number }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.8,
  }

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {name === 'dashboard' ? (
        <>
          <path {...common} d="M4 13.5h6.5V20H4zM13.5 4H20v16h-6.5zM4 4h6.5v6.5H4z" />
          <path {...common} d="M6.5 17h1.8M16 8h1.8M16 12h1.8" />
        </>
      ) : null}
      {name === 'exam' ? (
        <>
          <path {...common} d="M12 3.5l2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.9-5.4 2.9 1-6-4.4-4.3 6.1-.9z" />
          <path {...common} d="M12 8.2v4.2l2.6 1.5" />
        </>
      ) : null}
      {name === 'logout' ? (
        <>
          <path {...common} d="M9.5 4.5H6.8A2.3 2.3 0 004.5 6.8v10.4a2.3 2.3 0 002.3 2.3h2.7" />
          <path {...common} d="M13 8l4 4-4 4M17 12H8" />
        </>
      ) : null}
      {name === 'file' ? (
        <>
          <path {...common} d="M7 3.8h6.2L18 8.6v11.6H7z" />
          <path {...common} d="M13 4v5h5M9.8 13h5M9.8 16h3.5" />
        </>
      ) : null}
      {name === 'attach' ? (
        <>
          <path {...common} d="M8.4 12.7l5.7-5.7a3.2 3.2 0 014.5 4.5l-7.1 7.1a4.7 4.7 0 01-6.6-6.6l7.7-7.7" />
          <path {...common} d="M10.3 14.6l5.4-5.4" />
        </>
      ) : null}
    </svg>
  )
}

function sourceText(sources?: SourceCitation[]) {
  const source = sources?.[0]
  if (!source) return ''
  return String(source.title || source.source || source.label || 'Cambridge mark scheme')
}

function confidenceText(confidence?: string) {
  if (confidence === 'VERIFIED') return 'VERIFIED - from Cambridge/Edexcel past papers'
  if (confidence === 'PARTIAL') return 'PARTIAL MATCH - AI reasoning applied'
  return 'AI REASONING - verify before exam'
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
  const [filePreviews, setFilePreviews] = useState<FilePreview[]>([])
  const [usage, setUsage] = useState<UsageState | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    void refreshSessions()
  }, [])

  useEffect(() => {
    return () => {
      filePreviews.forEach((preview) => {
        if (preview.url) URL.revokeObjectURL(preview.url)
      })
    }
  }, [filePreviews])

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
          confidence: entry.confidence,
          confidenceBadge: entry.confidenceBadge,
          confidenceScore: entry.confidenceScore,
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
    updateSelectedFiles([])
    setMode('direct')
  }

  function updateSelectedFiles(files: File[]) {
    const nextFiles = files.slice(0, 4)
    setSelectedFiles(nextFiles)
    setFilePreviews(
      nextFiles.map((file) => ({
        name: file.name,
        type: file.type || 'file',
        url: file.type?.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      }))
    )
    if (fileRef.current) fileRef.current.value = ''
  }

  function removeSelectedFile(index: number) {
    updateSelectedFiles(selectedFiles.filter((_, currentIndex) => currentIndex !== index))
  }

  async function signOut() {
    await createSupabaseClient().auth.signOut()
    window.location.href = '/login'
  }

  async function sendMessage(preset?: string) {
    const text = (preset ?? input).trim()
    if ((!text && selectedFiles.length === 0) || loading) return

    const preview = [text, ...selectedFiles.map((file) => `[${file.name}]`)].filter(Boolean).join('\n')
    setMessages((current) => [...current, { role: 'user', content: preview || '[Attachment]' }])
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
          content: data.answer || data.response || data.error || 'Connection issue. Send the question once more.',
          confidence: typeof data.confidence === 'string' ? data.confidence : undefined,
          confidenceBadge: typeof data.confidenceBadge === 'string' ? data.confidenceBadge : undefined,
          confidenceScore: typeof data.confidenceScore === 'number' ? data.confidenceScore : undefined,
          chapterGap:
            data.chapterGap && typeof data.chapterGap === 'object'
              ? (data.chapterGap as Message['chapterGap'])
              : data.understood?.skippedTopic
                ? {
                    skippedTopic: String(data.understood.skippedTopic),
                    currentTopic: typeof data.topic === 'string' ? data.topic : 'Current topic',
                    recommendation: `We will avoid ${data.understood.skippedTopic} and use a simpler route first.`,
                  }
                : undefined,
          sources: Array.isArray(data.sources)
            ? data.sources
            : data.truth?.source
              ? [{ title: String(data.truth.source) }]
              : undefined,
        },
      ])
      updateSelectedFiles([])
      void refreshSessions()
    } catch {
      setMessages((current) => [...current, { role: 'assistant', content: 'Connection issue. Send the question once more.' }])
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
        .mobile-new-chat {
          display: none;
        }
        @media (max-width: 900px) {
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
          .shaab-top-nav {
            right: 10px !important;
            gap: 6px !important;
          }
          .shaab-top-nav-link {
            height: 30px !important;
            padding: 0 9px !important;
            font-size: 11px !important;
          }
          .shaab-top-nav-link svg {
            display: none;
          }
          .shaab-credit {
            display: none !important;
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

      </aside>

      <section className="shaab-main" style={styles.main(sidebarOpen)}>
        <div className="mobile-chat-logo" style={styles.mobileLogoButton}>
          <LogoSvg compact />
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
          <nav className="shaab-top-nav" style={styles.topNav} aria-label="App navigation">
            <span className="shaab-credit" style={styles.credit}>Credits {credits}</span>
            <Link className="shaab-top-nav-link" href="/dashboard" style={styles.topNavLink} title="Dashboard" aria-label="Dashboard">
              <ThemeIcon name="dashboard" size={17} />
              <span>Dashboard</span>
            </Link>
            <Link className="shaab-top-nav-link" href="/exam-mode" style={styles.topNavLink} title="Exam Mode" aria-label="Exam Mode">
              <ThemeIcon name="exam" size={17} />
              <span>Exam Mode</span>
            </Link>
            <button className="shaab-top-nav-link" type="button" onClick={() => void signOut()} style={styles.topNavButton} title="Logout" aria-label="Logout">
              <ThemeIcon name="logout" size={17} />
              <span>Logout</span>
            </button>
          </nav>
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
          </div>
        ) : (
          <div style={styles.history}>
            {messages.map((message, index) => {
              const isUser = message.role === 'user'
              const citation = sourceText(message.sources)
              return (
                <div key={`${message.role}-${index}-${message.id ?? ''}`} style={styles.messageRow(isUser)}>
                  <div style={isUser ? styles.userBubble : styles.aiText}>
                    {!isUser && (message.confidenceBadge || message.confidence) ? (
                      <div style={styles.confidenceBadge}>
                        {message.confidence === 'VERIFIED' ? (
                          <VerifiedBadge
                            label={`${message.confidenceBadge || confidenceText(message.confidence)}${
                              typeof message.confidenceScore === 'number' ? ` · ${message.confidenceScore}%` : ''
                            }`}
                          />
                        ) : (
                          <AIReasoningBadge
                            label={`${message.confidenceBadge || confidenceText(message.confidence)}${
                              typeof message.confidenceScore === 'number' ? ` · ${message.confidenceScore}%` : ''
                            }`}
                          />
                        )}
                      </div>
                    ) : null}
                    {!isUser && message.chapterGap ? (
                      <div style={styles.chapterGapCard}>
                        <div style={styles.chapterGapLabel}>Chapter Gap Detected</div>
                        <div style={styles.chapterGapGrid}>
                          <span>Skipped: {message.chapterGap.skippedTopic || 'tracked gap'}</span>
                          <span>Current: {message.chapterGap.currentTopic || 'current topic'}</span>
                          <span>{message.chapterGap.recommendation || 'Using a simpler explanation path.'}</span>
                        </div>
                      </div>
                    ) : null}
                    <RichMessageContent content={message.content} />
                    {!isUser && message.sources?.[0] ? <SourceCard source={message.sources[0]} /> : null}
                    {!isUser && citation && !message.sources?.[0] ? <div style={styles.source}>{citation}</div> : null}
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
        {filePreviews.length ? (
          <div style={styles.attachmentTray}>
            {filePreviews.map((preview, index) => (
              <div key={`${preview.name}-${index}`} style={styles.attachmentPill}>
                {preview.url ? (
                  <img src={preview.url} alt="" style={styles.attachmentThumb} />
                ) : (
                  <span style={styles.attachmentFileIcon}>
                    <ThemeIcon name="file" size={18} />
                  </span>
                )}
                <span style={styles.attachmentName}>{preview.name}</span>
                <button type="button" onClick={() => removeSelectedFile(index)} style={styles.attachmentRemove} aria-label={`Remove ${preview.name}`}>
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.pdf"
          multiple
          onChange={(event) => updateSelectedFiles(Array.from(event.target.files ?? []))}
          style={{ display: 'none' }}
        />
        <div style={styles.composerRow}>
          <button type="button" onClick={() => fileRef.current?.click()} style={styles.attach} aria-label="Upload photo or PDF">
            <ThemeIcon name="attach" />
          </button>
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Type anything..."
            style={styles.input}
          />
          <button type="submit" disabled={loading} style={styles.send}>
            →
          </button>
        </div>
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
  mobileDrawerOverlay: (open: boolean) =>
    ({
      position: 'fixed',
      inset: 0,
      zIndex: 55,
      border: 'none',
      background: open ? 'rgba(0,0,13,0.48)' : 'transparent',
      opacity: open ? 1 : 0,
      pointerEvents: open ? 'auto' : 'none',
      transition: 'opacity 180ms ease',
    }) satisfies CSSProperties,
  mobileDrawer: (open: boolean) =>
    ({
      position: 'fixed',
      inset: '0 auto 0 0',
      zIndex: 60,
      width: 'min(82vw, 310px)',
      background: 'rgba(8,7,22,0.98)',
      borderRight: '1px solid rgba(170,85,255,0.16)',
      boxShadow: '28px 0 80px rgba(0,0,0,0.42)',
      flexDirection: 'column',
      gap: 14,
      padding: '16px 14px',
      transform: open ? 'translateX(0)' : 'translateX(-104%)',
      transition: 'transform 220ms ease',
    }) satisfies CSSProperties,
  mobileDrawerHeader: {
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'space-between',
  } satisfies CSSProperties,
  drawerClose: {
    width: 34,
    height: 34,
    border: '1px solid rgba(170,85,255,0.14)',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.04)',
    color: '#E8E8FF',
    cursor: 'pointer',
    fontSize: 19,
  } satisfies CSSProperties,
  drawerPrimary: {
    border: '1px solid rgba(170,85,255,0.22)',
    borderRadius: 16,
    background: 'linear-gradient(130deg, rgba(119,51,204,0.5), rgba(170,85,255,0.28))',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 700,
    padding: '13px 14px',
    textAlign: 'left',
  } satisfies CSSProperties,
  drawerSessions: {
    display: 'grid',
    gap: 6,
    maxHeight: '42vh',
    overflow: 'auto',
  } satisfies CSSProperties,
  drawerActions: {
    display: 'grid',
    gap: 8,
    marginTop: 'auto',
  } satisfies CSSProperties,
  drawerAction: {
    border: '1px solid rgba(170,85,255,0.12)',
    borderRadius: 15,
    background: 'rgba(255,255,255,0.035)',
    color: '#d8d2f2',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 13,
    padding: '12px 13px',
    textAlign: 'left',
    textDecoration: 'none',
    width: '100%',
  } satisfies CSSProperties,
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
  topNav: {
    position: 'fixed',
    top: 11,
    right: 22,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    pointerEvents: 'auto',
  } satisfies CSSProperties,
  credit: {
    color: '#9F9FC4',
    fontSize: 12,
    minWidth: 16,
    textAlign: 'center',
  } satisfies CSSProperties,
  topNavLink: {
    minWidth: 34,
    height: 34,
    border: '1px solid rgba(170,85,255,0.16)',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.035)',
    color: '#b975ff',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    justifyContent: 'center',
    padding: '0 12px',
    textDecoration: 'none',
    fontSize: 12,
    fontWeight: 700,
  } satisfies CSSProperties,
  topNavButton: {
    minWidth: 34,
    height: 34,
    border: '1px solid rgba(170,85,255,0.16)',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.035)',
    color: '#b975ff',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    justifyContent: 'center',
    padding: '0 12px',
    fontSize: 12,
    fontWeight: 700,
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
  mobileLogoButton: {
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    lineHeight: 0,
    padding: 0,
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
  confidenceBadge: {
    color: '#cda2ff',
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '0.01em',
    marginBottom: 8,
  } satisfies CSSProperties,
  chapterGapCard: {
    background: 'rgba(245,158,11,0.1)',
    border: '1px solid rgba(251,191,36,0.24)',
    borderRadius: 18,
    color: '#fde68a',
    display: 'grid',
    gap: 8,
    marginBottom: 12,
    padding: 14,
  } satisfies CSSProperties,
  chapterGapLabel: {
    color: '#fcd34d',
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: '0.09em',
    textTransform: 'uppercase',
  } satisfies CSSProperties,
  chapterGapGrid: {
    color: '#f7e7b6',
    display: 'grid',
    fontSize: 13,
    gap: 5,
  } satisfies CSSProperties,
  composer: (open: boolean) =>
    ({
      position: 'fixed',
      zIndex: 40,
      left: open ? 272 : 94,
      bottom: 18,
      width: open ? 'calc(100vw - 304px)' : 'calc(100vw - 126px)',
      display: 'flex',
      alignItems: 'stretch',
      flexDirection: 'column',
      gap: 8,
      border: '1px solid rgba(170,85,255,0.16)',
      borderRadius: 24,
      background: 'rgba(12,10,28,0.96)',
      boxShadow: '0 18px 60px rgba(0,0,0,0.34)',
      padding: 9,
      transition: 'left 160ms ease, width 160ms ease',
    }) satisfies CSSProperties,
  attachmentTray: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    maxHeight: 106,
    overflow: 'auto',
    padding: '0 4px',
  } satisfies CSSProperties,
  attachmentPill: {
    alignItems: 'center',
    border: '1px solid rgba(170,85,255,0.16)',
    borderRadius: 15,
    background: 'rgba(255,255,255,0.045)',
    color: '#d8d2f2',
    display: 'flex',
    gap: 8,
    maxWidth: 230,
    padding: '6px 7px',
  } satisfies CSSProperties,
  attachmentThumb: {
    width: 38,
    height: 38,
    borderRadius: 10,
    objectFit: 'cover',
  } satisfies CSSProperties,
  attachmentFileIcon: {
    display: 'grid',
    placeItems: 'center',
    width: 38,
    height: 38,
    borderRadius: 10,
    background: 'rgba(170,85,255,0.12)',
    color: '#b975ff',
  } satisfies CSSProperties,
  attachmentName: {
    flex: 1,
    fontSize: 12,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } satisfies CSSProperties,
  attachmentRemove: {
    border: 'none',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.08)',
    color: '#E8E8FF',
    cursor: 'pointer',
    width: 24,
    height: 24,
  } satisfies CSSProperties,
  composerRow: {
    alignItems: 'center',
    display: 'flex',
    gap: 8,
  } satisfies CSSProperties,
  attach: {
    width: 38,
    height: 38,
    border: 'none',
    borderRadius: 999,
    background: 'transparent',
    color: '#b975ff',
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
