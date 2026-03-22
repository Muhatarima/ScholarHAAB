'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import Blackhole from '@/components/Blackhole'
import SessionBadge from '@/components/SessionBadge'
import Stars from '@/components/Stars'
import type { Product, PromptMode } from '@/lib/products'

type SourceCitation = {
  title: string
  url?: string | null
  tier?: string
  lastChecked?: string | null
}

type Message = {
  id?: string
  role: 'user' | 'assistant'
  content: string
  sources?: SourceCitation[]
}

type ChatSessionSummary = {
  id: string
  mode: PromptMode
  title: string
  lastMessagePreview: string
  updatedAt: string
}

type UsageState = {
  enabled: boolean
  tier: string
  dailyLimitCredits: number
  usedCredits: number
  remainingCredits: number
  actionCost: number
  nextResetLabel: string
  nextResetIn: string
  message?: string
}

type ProductConfig = {
  title: string
  subtitle: string
  placeholder: string
  welcome: string
  endpoint: string
  quickPrompts: string[]
}

const PRODUCT_CONFIG: Record<Product, ProductConfig> = {
  abroad: {
    title: 'ScholarHAAB Abroad',
    subtitle: 'Scholarship matching, document guidance, and realistic study-abroad planning.',
    placeholder: 'Ask about scholarships, SOP, documents, or country fit...',
    welcome:
      'I am your abroad consultant. Tell me your profile, target country, or scholarship goal, and I will help you plan the smartest next move.',
    endpoint: '/api/abroad/chat',
    quickPrompts: [
      'Match scholarships for a 3.55 CGPA CSE student from Bangladesh.',
      'Review what my SOP must include for Chevening-level applications.',
      'Tell me the document checklist for a funded masters application.',
    ],
  },
  qbank: {
    title: 'ScholarHAAB QBank',
    subtitle: 'Board-aware past-paper solving with direct and tutor modes.',
    placeholder: 'Ask about a paper, topic, or exact question...',
    welcome:
      'I am your QBank tutor. Ask for a direct solution, switch to tutor mode, or ask which topics matter most for your board and year.',
    endpoint: '/api/qbank/chat',
    quickPrompts: [
      '2021 physics edexl paper 1 important questions.',
      'Important questions of vectors year wise for Edexcel A Level.',
      'Tutor mode: teach me periodic table trends like I am weak at chemistry.',
      'Which algebra topics repeat most often in recent O Level papers?',
    ],
  },
}

function getDefaultMessages(product: Product): Message[] {
  return [
    {
      role: 'assistant',
      content: PRODUCT_CONFIG[product].welcome,
    },
  ]
}

function formatRelativeDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function formatLastChecked(value?: string | null) {
  if (!value) {
    return ''
  }

  return `checked ${value}`
}

export default function ProductChatShell({ product }: { product: Product }) {
  const config = PRODUCT_CONFIG[product]
  const bottomRef = useRef<HTMLDivElement>(null)

  const [messages, setMessages] = useState<Message[]>(getDefaultMessages(product))
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [mode, setMode] = useState<PromptMode>('direct')
  const [usage, setUsage] = useState<UsageState | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, loadingHistory])

  useEffect(() => {
    setMessages(getDefaultMessages(product))
    setSessions([])
    setSessionId(null)
    setInput('')
    setLoading(false)
    setLoadingHistory(false)
    setUsage(null)
    setMode('direct')

    void (async () => {
      try {
        const res = await fetch(`/api/history?product=${product}`, {
          cache: 'no-store',
        })
        const data = await res.json()
        setSessions(Array.isArray(data.sessions) ? data.sessions : [])
      } catch {
        setSessions([])
      }
    })()
  }, [product])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const prompt = new URLSearchParams(window.location.search).get('prompt')
    if (!prompt) {
      return
    }

    setInput(prompt)
  }, [product])

  const refreshSessions = async (nextProduct = product) => {
    try {
      const res = await fetch(`/api/history?product=${nextProduct}`, {
        cache: 'no-store',
      })
      const data = await res.json()
      setSessions(Array.isArray(data.sessions) ? data.sessions : [])
    } catch {
      setSessions([])
    }
  }

  const loadSession = async (nextSessionId: string) => {
    if (loading || loadingHistory) {
      return
    }

    setLoadingHistory(true)

    try {
      const res = await fetch(`/api/history/${nextSessionId}`, {
        cache: 'no-store',
      })
      const data = await res.json()
      const nextMessages = Array.isArray(data.messages) ? data.messages : []

      if (data.session?.mode === 'direct' || data.session?.mode === 'tutor') {
        setMode(data.session.mode)
      }

      setSessionId(nextSessionId)
      setMessages(
        nextMessages.length > 0
          ? nextMessages.map((entry: Message) => ({
              id: entry.id,
              role: entry.role,
              content: entry.content,
              sources: entry.sources,
            }))
          : getDefaultMessages(product)
      )
    } catch {
      setMessages([
        {
          role: 'assistant',
          content: 'Could not load that chat right now.',
        },
      ])
    } finally {
      setLoadingHistory(false)
    }
  }

  const sendMessage = async (preset?: string) => {
    const nextMessage = (preset ?? input).trim()
    if (!nextMessage || loading || loadingHistory) {
      return
    }

    setMessages((prev) => [...prev, { role: 'user', content: nextMessage }])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch(config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: nextMessage,
          mode,
          sessionId,
        }),
      })
      const data = await res.json()

      if (data.usage) {
        setUsage(data.usage)
      }

      if (typeof data.sessionId === 'string') {
        setSessionId(data.sessionId)
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            data.answer ||
            data.error ||
            'Something went wrong. Please try again.',
          sources: Array.isArray(data.sources) ? data.sources : undefined,
        },
      ])

      void refreshSessions()
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Connection failed. Please try again.',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleNewChat = () => {
    setSessionId(null)
    setMessages(getDefaultMessages(product))
    setInput('')
    setMode('direct')
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#00000d',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-sans), sans-serif',
        position: 'relative',
      }}
    >
      <Stars />
      <Blackhole />

      <nav
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          padding: '14px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 20,
          borderBottom: '1px solid rgba(140,80,255,0.1)',
          background: 'rgba(0,0,13,0.85)',
          backdropFilter: 'blur(10px)',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <Link
            href="/"
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '2px',
              textDecoration: 'none',
            }}
          >
            <span
              style={{
                fontSize: '10px',
                fontWeight: 400,
                letterSpacing: '3px',
                textTransform: 'uppercase',
                color: '#7744aa',
                fontFamily: 'Georgia, serif',
                fontStyle: 'italic',
              }}
            >
              scholar
            </span>
            <span
              style={{
                fontSize: '20px',
                fontWeight: 600,
                letterSpacing: '2px',
                textTransform: 'uppercase',
                background: 'linear-gradient(120deg,#cc88ff,#aa55ff,#8833dd)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              HAAB
            </span>
          </Link>

          <button
            onClick={handleNewChat}
            title="New chat"
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              border: '1px solid rgba(170,85,255,0.3)',
              background: 'transparent',
              color: '#aa55ff',
              cursor: 'pointer',
              fontSize: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 10px 2px #7733cc44',
            }}
          >
            +
          </button>

          <div
            style={{
              display: 'flex',
              gap: '8px',
              padding: '4px',
              borderRadius: '999px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(170,85,255,0.14)',
            }}
          >
            {([
              ['abroad', '/abroad', 'Abroad'],
              ['qbank', '/qbank', 'QBank'],
            ] as const).map(([key, href, label]) => {
              const active = product === key
              return (
                <Link
                  key={key}
                  href={href}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    color: active ? '#fff' : '#8D8DB5',
                    textDecoration: 'none',
                    background: active ? 'linear-gradient(130deg,#7733cc,#aa55ff)' : 'transparent',
                  }}
                >
                  {label}
                </Link>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {product === 'qbank' && (
            <>
              <Link
                href="/qbank/search"
                style={{
                  fontSize: '12px',
                  color: '#6be4ff',
                  textDecoration: 'none',
                  border: '1px solid rgba(107,228,255,0.22)',
                  padding: '8px 14px',
                  borderRadius: '999px',
                  background: 'rgba(107,228,255,0.06)',
                }}
              >
                Search workbench
              </Link>
              <Link
                href="/qbank/concepts"
                style={{
                  fontSize: '12px',
                  color: '#93c5fd',
                  textDecoration: 'none',
                  border: '1px solid rgba(147,197,253,0.22)',
                  padding: '8px 14px',
                  borderRadius: '999px',
                  background: 'rgba(147,197,253,0.06)',
                }}
              >
                Concepts
              </Link>
            </>
          )}

          {product === 'abroad' && (
            <>
              <Link
                href="/abroad/search"
                style={{
                  fontSize: '12px',
                  color: '#85efac',
                  textDecoration: 'none',
                  border: '1px solid rgba(133,239,172,0.22)',
                  padding: '8px 14px',
                  borderRadius: '999px',
                  background: 'rgba(133,239,172,0.06)',
                }}
              >
                Scholarship workbench
              </Link>
              <Link
                href="/abroad/guidance"
                style={{
                  fontSize: '12px',
                  color: '#7dd3fc',
                  textDecoration: 'none',
                  border: '1px solid rgba(125,211,252,0.22)',
                  padding: '8px 14px',
                  borderRadius: '999px',
                  background: 'rgba(125,211,252,0.06)',
                }}
              >
                Guidance workbench
              </Link>
              <Link
                href="/abroad/review"
                style={{
                  fontSize: '12px',
                  color: '#fcd34d',
                  textDecoration: 'none',
                  border: '1px solid rgba(252,211,77,0.22)',
                  padding: '8px 14px',
                  borderRadius: '999px',
                  background: 'rgba(252,211,77,0.06)',
                }}
              >
                Document review
              </Link>
              <Link
                href="/abroad/document-check"
                style={{
                  fontSize: '12px',
                  color: '#f0abfc',
                  textDecoration: 'none',
                  border: '1px solid rgba(240,171,252,0.22)',
                  padding: '8px 14px',
                  borderRadius: '999px',
                  background: 'rgba(240,171,252,0.06)',
                }}
              >
                Document check
              </Link>
              <Link
                href="/abroad/planner"
                style={{
                  fontSize: '12px',
                  color: '#bef264',
                  textDecoration: 'none',
                  border: '1px solid rgba(190,242,100,0.22)',
                  padding: '8px 14px',
                  borderRadius: '999px',
                  background: 'rgba(190,242,100,0.06)',
                }}
              >
                Budget planner
              </Link>
            </>
          )}

          {product === 'qbank' && (
            <div
              style={{
                display: 'flex',
                gap: '8px',
                padding: '4px',
                borderRadius: '999px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(170,85,255,0.14)',
              }}
            >
              {(['direct', 'tutor'] as const).map((option) => {
                const active = mode === option
                return (
                  <button
                    key={option}
                    onClick={() => setMode(option)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '999px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '12px',
                      color: active ? '#fff' : '#8D8DB5',
                      background: active ? 'linear-gradient(130deg,#7733cc,#aa55ff)' : 'transparent',
                    }}
                  >
                    {option === 'direct' ? 'Direct mode' : 'Tutor mode'}
                  </button>
                )
              })}
            </div>
          )}

          {usage && (
            <div
              style={{
                fontSize: '12px',
                color: '#9A9ABE',
                border: '1px solid rgba(170,85,255,0.16)',
                padding: '8px 12px',
                borderRadius: '999px',
                background: 'rgba(255,255,255,0.03)',
              }}
            >
              {usage.tier} | {usage.remainingCredits}/{usage.dailyLimitCredits} credits left
            </div>
          )}

          <SessionBadge compact />

          <Link
            href="/chat"
            style={{
              fontSize: '12px',
              color: '#AA66FF',
              textDecoration: 'none',
              border: '1px solid rgba(170,85,255,0.2)',
              padding: '8px 14px',
              borderRadius: '999px',
            }}
          >
            Switch workspace
          </Link>
        </div>
      </nav>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '108px 20px 190px',
          maxWidth: '860px',
          width: '100%',
          margin: '0 auto',
          zIndex: 10,
          position: 'relative',
        }}
      >
        <header style={{ marginBottom: '28px' }}>
          <p
            style={{
              fontSize: '12px',
              letterSpacing: '3px',
              textTransform: 'uppercase',
              color: '#9A6CFF',
              marginBottom: '10px',
            }}
          >
            {config.title}
          </p>
          <h1
            style={{
              fontSize: 'clamp(28px, 4vw, 46px)',
              lineHeight: 1.05,
              fontWeight: 500,
              marginBottom: '12px',
            }}
          >
            {product === 'abroad' ? 'Scholarship consultant workspace' : 'Past-paper tutor workspace'}
          </h1>
          <p
            style={{
              color: '#77779A',
              lineHeight: 1.8,
              maxWidth: '680px',
              fontSize: '14px',
            }}
          >
            {config.subtitle}
          </p>

          {product === 'qbank' && (
            <div
              style={{
                marginTop: '16px',
                display: 'flex',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <Link
                href="/qbank/search"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  borderRadius: '999px',
                  textDecoration: 'none',
                  color: '#04101b',
                  background: 'linear-gradient(120deg,#7ce7ff,#46c9ff)',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                Search year-wise papers
              </Link>
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '999px',
                  border: '1px solid rgba(107,228,255,0.18)',
                  color: '#9fdfff',
                  background: 'rgba(107,228,255,0.05)',
                  fontSize: '12px',
                }}
              >
                Best for prompts like `2021 physics edexl` or `important vector questions`
              </div>
            </div>
          )}
        </header>

        <div
          style={{
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap',
            marginBottom: '24px',
          }}
        >
          {usage && (
            <div
              style={{
                width: '100%',
                borderRadius: '18px',
                padding: '12px 14px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(170,85,255,0.12)',
                color: '#A7A7CB',
                fontSize: '12px',
                lineHeight: 1.6,
              }}
            >
              {usage.enabled
                ? `${usage.tier} plan | ${usage.remainingCredits}/${usage.dailyLimitCredits} credits left today | last action cost ${usage.actionCost} | resets ${usage.nextResetIn} at ${usage.nextResetLabel}`
                : usage.message}
            </div>
          )}

          {sessions.length > 0 && (
            <div
              style={{
                width: '100%',
                display: 'grid',
                gap: '8px',
                marginBottom: '4px',
              }}
            >
              <p
                style={{
                  fontSize: '11px',
                  letterSpacing: '2px',
                  textTransform: 'uppercase',
                  color: '#6E6E98',
                }}
              >
                Recent chats
              </p>
              <div
                style={{
                  display: 'grid',
                  gap: '8px',
                }}
              >
                {sessions.slice(0, 6).map((session) => {
                  const active = session.id === sessionId
                  return (
                    <button
                      key={session.id}
                      onClick={() => loadSession(session.id)}
                      style={{
                        textAlign: 'left',
                        borderRadius: '16px',
                        border: active
                          ? '1px solid rgba(170,85,255,0.34)'
                          : '1px solid rgba(170,85,255,0.12)',
                        background: active
                          ? 'rgba(130,70,220,0.14)'
                          : 'rgba(255,255,255,0.025)',
                        color: '#D4D4F4',
                        padding: '12px 14px',
                        cursor: 'pointer',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: '10px',
                          marginBottom: '6px',
                          alignItems: 'center',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '13px',
                            fontWeight: 500,
                            color: '#F1E8FF',
                          }}
                        >
                          {session.title}
                        </span>
                        <span
                          style={{
                            fontSize: '10px',
                            color: '#8F8FB5',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {formatRelativeDate(session.updatedAt)}
                        </span>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: '10px',
                          alignItems: 'center',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '12px',
                            lineHeight: 1.5,
                            color: '#9A9ABE',
                          }}
                        >
                          {session.lastMessagePreview || 'Open this chat'}
                        </span>
                        {product === 'qbank' && (
                          <span
                            style={{
                              fontSize: '10px',
                              textTransform: 'uppercase',
                              letterSpacing: '1px',
                              color: '#9A9ABE',
                            }}
                          >
                            {session.mode}
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {config.quickPrompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => sendMessage(prompt)}
              style={{
                borderRadius: '999px',
                border: '1px solid rgba(170,85,255,0.18)',
                background: 'rgba(255,255,255,0.03)',
                color: '#B7B7D7',
                fontSize: '12px',
                lineHeight: 1.4,
                padding: '10px 14px',
                cursor: 'pointer',
              }}
            >
              {prompt}
            </button>
          ))}
        </div>

        {messages.map((message, index) => (
          <div
            key={message.id ?? `${message.role}-${index}`}
            style={{
              display: 'flex',
              justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: '16px',
            }}
          >
            <div style={{ maxWidth: '78%' }}>
              <div
                style={{
                  padding: '14px 18px',
                  borderRadius:
                    message.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background:
                    message.role === 'user'
                      ? 'linear-gradient(130deg,#7733cc,#aa55ff)'
                      : 'rgba(255,255,255,0.04)',
                  border:
                    message.role === 'assistant'
                      ? '1px solid rgba(170,85,255,0.1)'
                      : 'none',
                  color: message.role === 'user' ? '#fff' : '#D3D3F2',
                  fontSize: '14px',
                  lineHeight: 1.75,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {message.content}
              </div>

              {message.role === 'assistant' && message.sources && message.sources.length > 0 && (
                <div
                  style={{
                    marginTop: '8px',
                    borderRadius: '14px',
                    border: '1px solid rgba(170,85,255,0.12)',
                    background: 'rgba(255,255,255,0.025)',
                    padding: '10px 12px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '10px',
                      letterSpacing: '2px',
                      textTransform: 'uppercase',
                      color: '#7B7BA4',
                      marginBottom: '8px',
                    }}
                  >
                    Sources
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gap: '8px',
                    }}
                  >
                    {message.sources.slice(0, 3).map((source, sourceIndex) => (
                      <div key={`${source.title}-${sourceIndex}`}>
                        {source.url ? (
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              fontSize: '12px',
                              color: '#CBA8FF',
                              textDecoration: 'none',
                            }}
                          >
                            {source.title}
                          </a>
                        ) : (
                          <div
                            style={{
                              fontSize: '12px',
                              color: '#CBA8FF',
                            }}
                          >
                            {source.title}
                          </div>
                        )}
                        <div
                          style={{
                            marginTop: '3px',
                            fontSize: '11px',
                            color: '#8B8BAD',
                          }}
                        >
                          {[source.tier, formatLastChecked(source.lastChecked)].filter(Boolean).join(' | ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {loadingHistory && (
          <div
            style={{
              marginBottom: '16px',
              color: '#9A9ABE',
              fontSize: '12px',
            }}
          >
            Loading chat history...
          </div>
        )}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '16px' }}>
            <div
              style={{
                padding: '14px 18px',
                borderRadius: '18px 18px 18px 4px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(170,85,255,0.1)',
                color: '#B57BFF',
                fontSize: '20px',
              }}
            >
              ...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '16px 20px 24px',
          background: 'linear-gradient(to top, #00000d 60%, transparent)',
          zIndex: 20,
        }}
      >
        <div
          style={{
            maxWidth: '860px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'flex-end',
            gap: '10px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(170,85,255,0.15)',
            borderRadius: '20px',
            padding: '10px 12px',
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void sendMessage()
              }
            }}
            placeholder={config.placeholder}
            rows={1}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: '#E8E8FF',
              fontSize: '14px',
              outline: 'none',
              resize: 'none',
              lineHeight: 1.6,
              padding: '6px 4px',
              fontFamily: 'inherit',
            }}
          />

          <button
            onClick={() => void sendMessage()}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              border: 'none',
              cursor: 'pointer',
              flexShrink: 0,
              background: 'linear-gradient(130deg,#7733cc,#aa55ff)',
              boxShadow: '0 0 16px 4px #7733cc88',
              animation: 'pulseGlow 2.8s ease-in-out infinite',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '16px',
            }}
          >
            &gt;
          </button>
        </div>

        <p
          style={{
            textAlign: 'center',
            fontSize: '11px',
            color: '#31314A',
            marginTop: '10px',
          }}
        >
          ScholarHAAB - built for BD students
        </p>
      </div>
    </div>
  )
}
