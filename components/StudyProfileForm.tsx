'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { BOARDS, EXPLANATION_STYLES, LANGUAGES, LEVELS, STAGES, SUBJECTS } from '@/lib/profile/setupOptions'

type Props = {
  title?: string
  subtitle?: string
  redirectTo?: string
}

type ProfileResponse = {
  profile?: {
    preferredBoard?: string | null
    preferredLevel?: string | null
    preferredSubjects?: string[]
    preferredLanguage?: string | null
  }
}

function Pill({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} style={active ? styles.pillActive : styles.pill}>
      {children}
    </button>
  )
}

export default function StudyProfileForm({
  title = 'Set up your study profile',
  subtitle = 'Only stable study identity. Weak topics and skipped chapters are detected automatically.',
  redirectTo = '/solver',
}: Props) {
  const router = useRouter()
  const [level, setLevel] = useState<'O Level' | 'A Level'>('O Level')
  const [board, setBoard] = useState<'Cambridge' | 'Edexcel'>('Cambridge')
  const [stage, setStage] = useState('')
  const [subjects, setSubjects] = useState<string[]>(['Physics'])
  const [languagePreference, setLanguagePreference] = useState('Banglish')
  const [explanationStyle, setExplanationStyle] = useState('Step-by-step teacher style')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const res = await fetch('/api/profile', { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as ProfileResponse
        if (!active || !data.profile) return
        if (data.profile.preferredLevel === 'A Level' || data.profile.preferredLevel === 'O Level') {
          setLevel(data.profile.preferredLevel)
        }
        if (data.profile.preferredBoard === 'Cambridge' || data.profile.preferredBoard === 'Edexcel') {
          setBoard(data.profile.preferredBoard)
        }
        if (Array.isArray(data.profile.preferredSubjects) && data.profile.preferredSubjects.length) {
          setSubjects(data.profile.preferredSubjects)
        }
        if (data.profile.preferredLanguage === 'bn') {
          setLanguagePreference('Banglish')
        }
      } catch {
        // The form can still be completed from defaults.
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const availableSubjects = useMemo(() => SUBJECTS[level], [level])
  const availableStages = useMemo(() => STAGES[level], [level])

  function toggleSubject(subject: string) {
    setSubjects((current) =>
      current.includes(subject)
        ? current.filter((entry) => entry !== subject)
        : [...current, subject]
    )
  }

  async function save() {
    if (subjects.length === 0) {
      setError('Pick at least one subject.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          level,
          board,
          stage,
          subjects,
          languagePreference,
          explanationStyle,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not save setup.')
      router.push(redirectTo)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save setup.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section style={styles.card}>
      <div style={styles.headingBlock}>
        <h1 style={styles.title}>{title}</h1>
        <p style={styles.subtitle}>{subtitle}</p>
      </div>

      <div style={styles.group}>
        <span style={styles.label}>Level</span>
        <div style={styles.wrap}>
          {LEVELS.map((item) => (
            <Pill key={item} active={level === item} onClick={() => setLevel(item)}>
              {item}
            </Pill>
          ))}
        </div>
      </div>

      <div style={styles.group}>
        <span style={styles.label}>Board</span>
        <div style={styles.wrap}>
          {BOARDS.map((item) => (
            <Pill key={item} active={board === item} onClick={() => setBoard(item)}>
              {item}
            </Pill>
          ))}
        </div>
      </div>

      <div style={styles.group}>
        <span style={styles.label}>Stage/Class</span>
        <div style={styles.wrap}>
          {availableStages.map((item) => (
            <Pill key={item} active={stage === item} onClick={() => setStage(item)}>
              {item}
            </Pill>
          ))}
        </div>
      </div>

      <div style={styles.group}>
        <span style={styles.label}>Subjects</span>
        <div style={styles.wrap}>
          {availableSubjects.map((subject) => (
            <Pill key={subject} active={subjects.includes(subject)} onClick={() => toggleSubject(subject)}>
              {subject}
            </Pill>
          ))}
        </div>
      </div>

      <div style={styles.group}>
        <span style={styles.label}>Language preference</span>
        <div style={styles.wrap}>
          {LANGUAGES.map((item) => (
            <Pill key={item} active={languagePreference === item} onClick={() => setLanguagePreference(item)}>
              {item}
            </Pill>
          ))}
        </div>
      </div>

      <div style={styles.group}>
        <span style={styles.label}>Explanation style</span>
        <div style={styles.wrap}>
          {EXPLANATION_STYLES.map((item) => (
            <Pill key={item} active={explanationStyle === item} onClick={() => setExplanationStyle(item)}>
              {item}
            </Pill>
          ))}
        </div>
      </div>

      {error ? <div style={styles.error}>{error}</div> : null}

      <button type="button" disabled={saving} onClick={() => void save()} style={styles.button}>
        {saving ? 'Saving...' : 'Save & Start Learning ->'}
      </button>
    </section>
  )
}

const styles = {
  card: {
    background: 'rgba(16,11,36,0.76)',
    border: '1px solid rgba(192,132,252,0.2)',
    borderRadius: 28,
    boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
    display: 'grid',
    gap: 18,
    padding: 'clamp(18px,4vw,34px)',
    width: 'min(840px, 100%)',
  } satisfies CSSProperties,
  headingBlock: {
    display: 'grid',
    gap: 8,
  } satisfies CSSProperties,
  title: {
    color: '#f4eeff',
    fontSize: 'clamp(30px,5vw,52px)',
    letterSpacing: '-0.05em',
    lineHeight: 1,
    margin: 0,
  } satisfies CSSProperties,
  subtitle: {
    color: '#aaa6ca',
    fontSize: 14,
    lineHeight: 1.7,
    margin: 0,
  } satisfies CSSProperties,
  group: {
    display: 'grid',
    gap: 10,
  } satisfies CSSProperties,
  label: {
    color: '#c8bfff',
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  } satisfies CSSProperties,
  wrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 9,
  } satisfies CSSProperties,
  pill: {
    background: 'rgba(255,255,255,0.035)',
    border: '1px solid rgba(192,132,252,0.16)',
    borderRadius: 999,
    color: '#d8d2f4',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 700,
    padding: '10px 13px',
  } satisfies CSSProperties,
  pillActive: {
    background: 'linear-gradient(130deg,#7733cc,#aa55ff)',
    border: '1px solid rgba(192,132,252,0.42)',
    borderRadius: 999,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 800,
    padding: '10px 13px',
  } satisfies CSSProperties,
  error: {
    background: 'rgba(127,29,29,0.28)',
    border: '1px solid rgba(248,113,113,0.35)',
    borderRadius: 16,
    color: '#fecaca',
    fontSize: 13,
    padding: 12,
  } satisfies CSSProperties,
  button: {
    background: 'linear-gradient(130deg,#7733cc,#aa55ff)',
    border: 0,
    borderRadius: 999,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 15,
    fontWeight: 900,
    padding: '15px 22px',
  } satisfies CSSProperties,
}
