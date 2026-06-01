import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import Logo from '@/components/Logo'
import StarBackground from '@/components/StarBackground'

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <main style={styles.shell}>
      <StarBackground variant="chat" />
      <nav style={styles.nav}>
        <Logo compact />
        <div style={styles.links}>
          <Link href="/solver" style={styles.link}>Solver</Link>
          <Link href="/dashboard" style={styles.link}>Dashboard</Link>
          <Link href="/exam-mode" style={styles.link}>Exam Mode</Link>
          <Link href="/ai-approach" style={styles.link}>AI Approach</Link>
        </div>
      </nav>
      <div style={styles.content}>{children}</div>
    </main>
  )
}

const styles = {
  shell: {
    background: '#00000d',
    color: '#e8e8ff',
    minHeight: '100vh',
    overflow: 'hidden',
    position: 'relative',
  } satisfies CSSProperties,
  nav: {
    alignItems: 'center',
    background: 'rgba(0,0,13,0.48)',
    borderBottom: '1px solid rgba(170,85,255,0.1)',
    display: 'flex',
    flexWrap: 'wrap',
    gap: 18,
    justifyContent: 'space-between',
    padding: '14px clamp(16px,4vw,40px)',
    position: 'relative',
    zIndex: 2,
  } satisfies CSSProperties,
  links: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 14,
  } satisfies CSSProperties,
  link: {
    color: '#aaa6ca',
    fontSize: 13,
    textDecoration: 'none',
  } satisfies CSSProperties,
  content: {
    position: 'relative',
    zIndex: 1,
  } satisfies CSSProperties,
}
