'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import AIReasoningBadge from '@/components/AIReasoningBadge'
import AppShell from '@/components/AppShell'
import Badge from '@/components/Badge'
import FeatureCard from '@/components/FeatureCard'
import VerifiedBadge from '@/components/VerifiedBadge'

const scenes = [
  {
    eyebrow: 'Problem',
    title: 'Manual search is broken for students.',
    copy: 'Past papers are scattered, mark schemes are hard to find, and one typo can waste the whole study session.',
  },
  {
    eyebrow: 'Solution',
    title: 'ScholarHAAB searches like a tutor.',
    copy: 'Banglish, typos, board, year, subject, and topic all become one clean past-paper query.',
  },
  {
    eyebrow: 'Manual Search Demo',
    title: '“waev motion phsyics 2021” still works.',
    copy: 'The system normalizes the request, searches verified paper data, and returns the closest source metadata.',
  },
  {
    eyebrow: 'Verified Solving',
    title: 'Verified means sourced.',
    copy: 'Green badges only appear when retrieved past-paper or mark-scheme data exists.',
    badge: 'verified',
  },
  {
    eyebrow: 'Hallucination Control',
    title: 'No source? No fake confidence.',
    copy: 'Unseen questions are clearly marked as AI reasoning with a verify-before-exam warning.',
    badge: 'reasoning',
  },
  {
    eyebrow: 'Exam Night Mode',
    title: 'One night, one focused plan.',
    copy: 'Important topics, formulas, 15-minute revision, 30-minute practice, and skip-for-now priorities.',
  },
  {
    eyebrow: 'AI Approach',
    title: 'RAG + pattern intelligence + intent understanding.',
    copy: 'The answer pipeline is explainable, testable, and built for Bangladesh students.',
  },
  {
    eyebrow: 'Impact',
    title: 'AI you can actually trust.',
    copy: 'Built for Bangladesh — ready for the world.',
  },
]

export default function Demo3Page() {
  const [active, setActive] = useState(0)
  const scene = scenes[active]

  useEffect(() => {
    const timer = setInterval(() => {
      setActive((current) => (current + 1) % scenes.length)
    }, 4200)
    return () => clearInterval(timer)
  }, [])

  return (
    <AppShell>
      <section style={styles.wrap}>
        <div style={styles.stage}>
          <Badge tone="violet">{scene.eyebrow}</Badge>
          <h1 style={styles.title}>{scene.title}</h1>
          <p style={styles.copy}>{scene.copy}</p>
          <div style={styles.badgeRow}>
            {scene.badge === 'verified' ? <VerifiedBadge /> : null}
            {scene.badge === 'reasoning' ? <AIReasoningBadge /> : null}
          </div>
          <div style={styles.dots}>
            {scenes.map((item, index) => (
              <button
                key={item.eyebrow}
                type="button"
                onClick={() => setActive(index)}
                style={styles.dot(index === active)}
                aria-label={`Show ${item.eyebrow}`}
              />
            ))}
          </div>
        </div>

        <div style={styles.grid}>
          <FeatureCard badge="Pitch Promise" title="Trust layer">
            Verified answers are separated from AI reasoning so the student knows what is safe to use in the exam.
          </FeatureCard>
          <FeatureCard badge="Demo Flow" title="60 seconds">
            Search, solve, hallucination control, skip-chapter adaptation, then dashboard proof.
          </FeatureCard>
        </div>
      </section>
    </AppShell>
  )
}

const styles = {
  wrap: {
    display: 'grid',
    gap: 22,
    margin: '0 auto',
    padding: '80px clamp(16px,5vw,72px)',
    width: 'min(1180px, 100%)',
  } satisfies CSSProperties,
  stage: {
    alignContent: 'center',
    background: 'linear-gradient(145deg, rgba(18,16,37,0.88), rgba(16,11,36,0.62))',
    border: '1px solid rgba(170,85,255,0.16)',
    borderRadius: 32,
    display: 'grid',
    gap: 18,
    minHeight: 430,
    padding: 'clamp(24px,5vw,54px)',
    textAlign: 'center',
  } satisfies CSSProperties,
  title: {
    color: '#f4eeff',
    fontSize: 'clamp(42px,7vw,86px)',
    fontWeight: 500,
    letterSpacing: '-0.065em',
    lineHeight: 0.95,
    margin: 0,
  } satisfies CSSProperties,
  copy: {
    color: '#aaa6ca',
    fontSize: 17,
    lineHeight: 1.7,
    margin: '0 auto',
    maxWidth: 720,
  } satisfies CSSProperties,
  badgeRow: {
    display: 'flex',
    justifyContent: 'center',
    minHeight: 34,
  } satisfies CSSProperties,
  dots: {
    display: 'flex',
    gap: 8,
    justifyContent: 'center',
  } satisfies CSSProperties,
  dot: (active: boolean) =>
    ({
      background: active ? '#c084fc' : 'rgba(255,255,255,0.16)',
      border: 'none',
      borderRadius: 999,
      cursor: 'pointer',
      height: 9,
      width: active ? 28 : 9,
    }) satisfies CSSProperties,
  grid: {
    display: 'grid',
    gap: 16,
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  } satisfies CSSProperties,
}
