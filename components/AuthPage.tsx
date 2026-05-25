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
    <Link href="/" style={{ display: 'inline-flex', alignItems: 'baseline', gap: 2, textDecoration: 'none' }}>
      <span
        style={{
          color: '#7744aa',
          fontFamily: 'Georgia, serif',
          fontSize: 11,
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
          fontSize: 24,
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
  name,
  placeholder,
  type = 'text',
}: {
  autoComplete?: string
  name: string
  placeholder: string
  type?: string
}) {
  return (
    <input
      autoComplete={autoComplete}
      name={name}
      placeholder={placeholder}
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

export default function AuthPage({ action, mode, nextPath }: AuthPageProps) {
  const [state, formAction] = useActionState(action, {
    error: null,
    message: null,
  })
  const next = nextPath ?? '/qbank'
  const linkHref = mode === 'signup' ? `/login?next=${encodeURIComponent(next)}` : `/signup?next=${encodeURIComponent(next)}`

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
      <StarBackdrop variant="auth" />
      <section style={{ position: 'relative', zIndex: 2, width: 'min(100%, 360px)', display: 'grid', gap: 22 }}>
        <div style={{ textAlign: 'center' }}>
          <Logo />
        </div>

        <form action={formAction} style={{ display: 'grid', gap: 12 }}>
          <input type="hidden" name="next" value={next} />
          {mode === 'signup' ? <Field autoComplete="name" name="name" placeholder="Name" /> : null}
          <Field autoComplete="email" name="email" placeholder="Email" type="email" />
          <Field
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            name="password"
            placeholder="Password"
            type="password"
          />

          {state.error ? <p style={{ color: '#fecaca', fontSize: 13, margin: 0 }}>{state.error}</p> : null}
          {state.message ? <p style={{ color: '#cffafe', fontSize: 13, margin: 0 }}>{state.message}</p> : null}

          <SubmitButton />
        </form>

        <Link href={linkHref} style={{ color: '#9F9FC4', fontSize: 14, textAlign: 'center', textDecoration: 'none' }}>
          {mode === 'signup' ? 'Sign in' : 'New? Create account'}
        </Link>
      </section>
    </main>
  )
}
