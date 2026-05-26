'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import type { AuthActionState } from '@/app/auth/actions'
import StarBackdrop from '@/components/StarBackdrop'

type AuthPageProps = {
  action: (state: AuthActionState, formData: FormData) => Promise<AuthActionState>
  mode: 'login' | 'signup'
  nextPath?: string | null
  oauthAction?: (formData: FormData) => Promise<void>
}

function Logo() {
  return (
    <Link href="/" aria-label="ScholarHAAB" style={{ display: 'inline-flex', textDecoration: 'none' }}>
      <svg width="164" height="62" viewBox="0 0 164 62" role="img" aria-label="ScholarHAAB">
        <defs>
          <linearGradient id="authHaabGradient" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#f7edff" />
            <stop offset="48%" stopColor="#c989ff" />
            <stop offset="100%" stopColor="#8b3ee6" />
          </linearGradient>
          <path id="authScholarCurve" d="M 24 25 Q 82 2 140 25" />
        </defs>
        <text
          fill="#9f5df7"
          fontFamily="Georgia, serif"
          fontSize="11"
          fontStyle="italic"
          letterSpacing="5"
          opacity="0.9"
        >
          <textPath href="#authScholarCurve" startOffset="50%" textAnchor="middle">
            SCHOLAR
          </textPath>
        </text>
        <text
          x="82"
          y="48"
          fill="url(#authHaabGradient)"
          fontFamily="var(--font-sans), sans-serif"
          fontSize="33"
          fontWeight="800"
          letterSpacing="3"
          textAnchor="middle"
        >
          HAAB
        </text>
      </svg>
    </Link>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        width: '100%',
        border: 'none',
        borderRadius: 999,
        background: 'linear-gradient(130deg,#7733cc,#aa55ff)',
        color: '#fff',
        cursor: pending ? 'default' : 'pointer',
        fontSize: 15,
        fontWeight: 800,
        opacity: pending ? 0.72 : 1,
        padding: '14px 18px',
      }}
    >
      Continue →
    </button>
  )
}

function Field({
  autoComplete,
  minLength,
  name,
  placeholder,
  required = true,
  type = 'text',
}: {
  autoComplete?: string
  minLength?: number
  name: string
  placeholder: string
  required?: boolean
  type?: string
}) {
  return (
    <input
      autoComplete={autoComplete}
      minLength={minLength}
      name={name}
      placeholder={placeholder}
      required={required}
      type={type}
      style={{
        width: '100%',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(170,85,255,0.16)',
        borderRadius: 16,
        boxSizing: 'border-box',
        color: '#E8E8FF',
        fontSize: 15,
        outline: 'none',
        padding: '14px 16px',
      }}
    />
  )
}

function GoogleButton({ oauthAction, next }: { oauthAction?: (formData: FormData) => Promise<void>; next: string }) {
  if (!oauthAction) {
    return null
  }

  return (
    <form action={oauthAction}>
      <input type="hidden" name="next" value={next} />
      <button
        type="submit"
        style={{
          width: '100%',
          alignItems: 'center',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: 999,
          color: '#F4EEFF',
          cursor: 'pointer',
          display: 'flex',
          fontSize: 14,
          fontWeight: 800,
          gap: 10,
          justifyContent: 'center',
          padding: '13px 18px',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            alignItems: 'center',
            background: '#fff',
            borderRadius: '50%',
            color: '#111',
            display: 'inline-flex',
            fontWeight: 900,
            height: 22,
            justifyContent: 'center',
            width: 22,
          }}
        >
          G
        </span>
        Continue with Google
      </button>
    </form>
  )
}

export default function AuthPage({ action, mode, nextPath, oauthAction }: AuthPageProps) {
  const [state, formAction] = useActionState(action, {
    error: null,
    message: null,
  })
  const next = nextPath ?? '/qbank'
  const linkHref = mode === 'signup' ? `/login?next=${encodeURIComponent(next)}` : `/signup?next=${encodeURIComponent(next)}`
  const title = mode === 'signup' ? 'ENTER THE VOID' : 'WELCOME BACK'

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#00000d',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        fontFamily: 'var(--font-sans), sans-serif',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <style>{`
        @media (max-width: 560px) {
          .auth-panel { width: min(100%, 390px) !important; gap: 18px !important; }
          .auth-panel input { border-radius: 20px !important; font-size: 16px !important; padding: 17px 18px !important; }
        }
      `}</style>
      <StarBackdrop variant="auth" />
      <section className="auth-panel" style={{ position: 'relative', zIndex: 2, width: 'min(100%, 450px)', display: 'grid', gap: 20 }}>
        <div style={{ textAlign: 'center', display: 'grid', gap: 8, justifyItems: 'center' }}>
          <Logo />
          <div
            style={{
              color: '#F8F4FF',
              fontSize: 17,
              fontWeight: 800,
              letterSpacing: 5,
              textTransform: 'uppercase',
            }}
          >
            {title}
          </div>
        </div>

        <form action={formAction} style={{ display: 'grid', gap: 12 }}>
          <input type="hidden" name="next" value={next} />
          {mode === 'signup' ? <Field autoComplete="name" name="name" placeholder="Name" /> : null}
          <Field autoComplete="email" name="email" placeholder="Email" type="email" />
          <Field
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            minLength={8}
            name="password"
            placeholder="Password"
            type="password"
          />

          {state.error ? <p style={{ color: '#fecaca', fontSize: 13, margin: 0 }}>{state.error}</p> : null}
          {state.message ? <p style={{ color: '#cffafe', fontSize: 13, margin: 0 }}>{state.message}</p> : null}

          <SubmitButton />
        </form>

        <div style={{ alignItems: 'center', color: '#6f6890', display: 'grid', fontSize: 11, gap: 10, gridTemplateColumns: '1fr auto 1fr', letterSpacing: 2, textTransform: 'uppercase' }}>
          <span style={{ height: 1, background: 'rgba(170,85,255,0.18)' }} />
          or
          <span style={{ height: 1, background: 'rgba(170,85,255,0.18)' }} />
        </div>

        <GoogleButton oauthAction={oauthAction} next={next} />

        <Link href={linkHref} style={{ color: '#9F9FC4', fontSize: 14, textAlign: 'center', textDecoration: 'none' }}>
          {mode === 'signup' ? 'Sign in' : 'New? Create account'}
        </Link>
      </section>
    </main>
  )
}
