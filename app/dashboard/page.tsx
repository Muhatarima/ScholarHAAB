import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { CSSProperties } from 'react'
import Logo from '@/components/Logo'
import StarBackground from '@/components/StarBackground'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type ConversationRow = {
  assistant_message: string | null
  created_at: string | null
  id: string
  mode: string | null
  user_message: string | null
}

function short(value: string | null | undefined, length = 220) {
  const text = value?.replace(/\s+/g, ' ').trim() ?? ''
  return text.length > length ? `${text.slice(0, length)}...` : text
}

function formatDate(value: string | null) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
  }).format(parsed)
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/dashboard')
  }

  const [{ data: profile }, { data: conversations }] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, setup_completed, updated_at')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('conversations')
      .select('id, mode, user_message, assistant_message, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  const rows = ((conversations ?? []) as ConversationRow[]).filter(Boolean)
  const displayName =
    typeof profile?.full_name === 'string' && profile.full_name.trim()
      ? profile.full_name.trim()
      : user.email?.split('@')[0] ?? 'Student'
  const setupCompleted = Boolean(profile?.setup_completed)

  return (
    <main style={styles.page}>
      <StarBackground variant="chat" />
      <nav style={styles.nav}>
        <Logo compact />
        <div style={styles.links}>
          <Link href="/solver" style={styles.link}>Solver</Link>
          <Link href="/exam-mode" style={styles.link}>Exam Mode</Link>
          <Link href="/adaptive-mode" style={styles.link}>Adaptive</Link>
        </div>
      </nav>

      <section style={styles.wrap}>
        <div style={styles.header}>
          <div>
            <p style={styles.eyebrow}>Dashboard</p>
            <h1 style={styles.title}>Welcome back, {displayName}</h1>
            <p style={styles.subtitle}>{user.email ?? 'Signed in with Supabase'}</p>
          </div>
          <Link href="/settings/profile" style={styles.primaryAction}>Edit profile</Link>
        </div>

        <section style={styles.grid}>
          <article style={styles.panel}>
            <span style={styles.label}>Setup Status</span>
            <strong style={styles.metric}>{setupCompleted ? 'Complete' : 'Not complete'}</strong>
            <p style={styles.muted}>
              {setupCompleted
                ? 'One-time setup is saved. Protected routes should skip /setup.'
                : 'Finish setup so Solver, Exam Mode, and Adaptive Mode can use your profile.'}
            </p>
            {!setupCompleted ? <Link href="/setup" style={styles.secondaryAction}>Finish setup</Link> : null}
          </article>

          <article style={styles.panel}>
            <span style={styles.label}>Recent Activity</span>
            <strong style={styles.metric}>{rows.length}</strong>
            <p style={styles.muted}>Recent solver conversations saved from authenticated API calls.</p>
          </article>
        </section>

        <section style={styles.historyPanel}>
          <div style={styles.panelHeader}>
            <h2 style={styles.sectionTitle}>Recent questions</h2>
            <Link href="/solver" style={styles.secondaryAction}>Ask new</Link>
          </div>

          {rows.length ? (
            <div style={styles.historyList}>
              {rows.map((row) => (
                <article key={row.id} style={styles.historyItem}>
                  <div style={styles.historyMeta}>
                    <span>{row.mode || 'solver'}</span>
                    <span>{formatDate(row.created_at)}</span>
                  </div>
                  <p style={styles.question}>{short(row.user_message, 180)}</p>
                  <p style={styles.answer}>{short(row.assistant_message, 260)}</p>
                </article>
              ))}
            </div>
          ) : (
            <div style={styles.empty}>
              No saved questions yet. Ask something in Solver and it will appear here.
            </div>
          )}
        </section>
      </section>
    </main>
  )
}

const styles: Record<string, CSSProperties> = {
  answer: {
    color: '#c9c5e8',
    lineHeight: 1.65,
    margin: '8px 0 0',
  },
  empty: {
    color: '#8f89b3',
    display: 'grid',
    minHeight: 160,
    placeItems: 'center',
    textAlign: 'center',
  },
  eyebrow: {
    color: '#b975ff',
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '0.08em',
    margin: '0 0 10px',
    textTransform: 'uppercase',
  },
  grid: {
    display: 'grid',
    gap: 14,
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  },
  header: {
    alignItems: 'end',
    display: 'flex',
    flexWrap: 'wrap',
    gap: 20,
    justifyContent: 'space-between',
  },
  historyItem: {
    background: 'rgba(255,255,255,0.035)',
    border: '1px solid rgba(170,85,255,0.1)',
    borderRadius: 8,
    padding: 16,
  },
  historyList: {
    display: 'grid',
    gap: 12,
  },
  historyMeta: {
    color: '#8f89b3',
    display: 'flex',
    fontSize: 12,
    gap: 12,
    justifyContent: 'space-between',
    textTransform: 'capitalize',
  },
  historyPanel: {
    background: 'rgba(255,255,255,0.026)',
    border: '1px solid rgba(170,85,255,0.09)',
    borderRadius: 8,
    padding: 18,
  },
  label: {
    color: '#b9a7e8',
    fontSize: 13,
    fontWeight: 700,
  },
  link: {
    color: '#c9c5e8',
    fontSize: 13,
    textDecoration: 'none',
  },
  links: {
    display: 'flex',
    gap: 16,
  },
  metric: {
    color: '#f4eeff',
    display: 'block',
    fontSize: 28,
    marginTop: 8,
  },
  muted: {
    color: '#918aac',
    lineHeight: 1.55,
    margin: '10px 0 0',
  },
  nav: {
    alignItems: 'center',
    borderBottom: '1px solid rgba(170,85,255,0.1)',
    display: 'flex',
    justifyContent: 'space-between',
    padding: '14px clamp(16px,4vw,44px)',
    position: 'relative',
    zIndex: 2,
  },
  page: {
    background: '#00000d',
    color: '#E8E8FF',
    minHeight: '100vh',
    position: 'relative',
  },
  panel: {
    background: 'rgba(255,255,255,0.035)',
    border: '1px solid rgba(170,85,255,0.1)',
    borderRadius: 8,
    padding: 18,
  },
  panelHeader: {
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  primaryAction: {
    background: 'linear-gradient(130deg,#7733cc,#aa55ff)',
    borderRadius: 8,
    color: '#fff',
    fontWeight: 800,
    padding: '11px 14px',
    textDecoration: 'none',
  },
  question: {
    color: '#f4eeff',
    fontWeight: 800,
    lineHeight: 1.5,
    margin: '12px 0 0',
  },
  secondaryAction: {
    border: '1px solid rgba(170,85,255,0.18)',
    borderRadius: 8,
    color: '#d8b4fe',
    display: 'inline-flex',
    fontSize: 13,
    fontWeight: 800,
    marginTop: 14,
    padding: '9px 12px',
    textDecoration: 'none',
  },
  sectionTitle: {
    fontSize: 20,
    margin: 0,
  },
  subtitle: {
    color: '#aaa6ca',
    margin: 0,
  },
  title: {
    fontSize: 'clamp(34px,6vw,64px)',
    fontWeight: 500,
    letterSpacing: '-0.02em',
    lineHeight: 1,
    margin: 0,
  },
  wrap: {
    display: 'grid',
    gap: 18,
    margin: '0 auto',
    padding: '46px clamp(16px,5vw,60px) 70px',
    position: 'relative',
    width: 'min(1120px, 100%)',
    zIndex: 1,
  },
}
