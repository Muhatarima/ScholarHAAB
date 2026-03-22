'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Stars from '@/components/Stars'
import { getBrowserSupabase } from '@/lib/browser-supabase'

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async () => {
    if (loading) {
      return
    }

    setError(null)
    setNotice(null)
    setLoading(true)

    try {
      const supabase = getBrowserSupabase()

      if (isLogin) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (signInError) {
          throw signInError
        }

        router.push('/chat')
        router.refresh()
        return
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name.trim(),
          },
        },
      })

      if (signUpError) {
        throw signUpError
      }

      if (data.session) {
        router.push('/chat')
        router.refresh()
        return
      }

      setNotice('Check your email to confirm the account, then sign in.')
      setIsLogin(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#00000d',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'var(--font-sans), sans-serif',
      }}
    >
      <Stars />

      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, #2d0a5e22 0%, #4a109011 40%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0,
          animation: 'haloPulse 4s ease-in-out infinite',
        }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: '420px',
          margin: '0 20px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(170,85,255,0.15)',
          borderRadius: '20px',
          padding: '40px',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: '2px' }}>
            <span
              style={{
                fontSize: '11px',
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
                fontSize: '24px',
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
          </div>
          <p style={{ fontSize: '13px', color: '#5D5D7E', marginTop: '8px' }}>
            {isLogin ? 'Sign in to keep your chats and plan tier.' : 'Create your account and start building momentum.'}
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            background: 'rgba(255,255,255,0.04)',
            borderRadius: '12px',
            padding: '4px',
            marginBottom: '28px',
          }}
        >
          {(['Login', 'Sign up'] as const).map((tab, index) => {
            const active = (isLogin && index === 0) || (!isLogin && index === 1)
            return (
              <button
                key={tab}
                onClick={() => {
                  setIsLogin(index === 0)
                  setError(null)
                  setNotice(null)
                }}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                  background: active ? 'linear-gradient(130deg,#7733cc,#aa55ff)' : 'transparent',
                  color: active ? '#fff' : '#676790',
                }}
              >
                {tab}
              </button>
            )
          })}
        </div>

        {!isLogin && (
          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                fontSize: '11px',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                color: '#7744aa',
                display: 'block',
                marginBottom: '8px',
              }}
            >
              Full name
            </label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(170,85,255,0.15)',
                borderRadius: '12px',
                color: '#E8E8FF',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <label
            style={{
              fontSize: '11px',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              color: '#7744aa',
              display: 'block',
              marginBottom: '8px',
            }}
          >
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(170,85,255,0.15)',
              borderRadius: '12px',
              color: '#E8E8FF',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label
            style={{
              fontSize: '11px',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              color: '#7744aa',
              display: 'block',
              marginBottom: '8px',
            }}
          >
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="********"
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(170,85,255,0.15)',
              borderRadius: '12px',
              color: '#E8E8FF',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {error && (
          <div
            style={{
              marginBottom: '16px',
              borderRadius: '12px',
              padding: '10px 12px',
              background: 'rgba(255,90,120,0.08)',
              border: '1px solid rgba(255,90,120,0.18)',
              color: '#FFB0C0',
              fontSize: '12px',
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        )}

        {notice && (
          <div
            style={{
              marginBottom: '16px',
              borderRadius: '12px',
              padding: '10px 12px',
              background: 'rgba(130,190,255,0.08)',
              border: '1px solid rgba(130,190,255,0.18)',
              color: '#BBD8FF',
              fontSize: '12px',
              lineHeight: 1.5,
            }}
          >
            {notice}
          </div>
        )}

        <button
          onClick={() => void handleSubmit()}
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '30px',
            border: 'none',
            background: 'linear-gradient(130deg,#7733cc,#aa55ff)',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 500,
            cursor: loading ? 'default' : 'pointer',
            letterSpacing: '0.5px',
            opacity: loading ? 0.72 : 1,
          }}
        >
          {loading ? 'Working...' : isLogin ? 'Enter the workspace' : 'Create account'}
        </button>
      </div>
    </div>
  )
}
