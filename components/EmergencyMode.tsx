'use client'

import { useEffect, useMemo, useState } from 'react'

type EmergencyModeProps = {
  subject: string
  paper?: string
  examAt?: string
  briefing?: string
  onExit?: () => void
}

function getHoursUntil(examAt?: string) {
  if (!examAt) {
    return 3
  }

  const target = new Date(examAt).getTime()
  if (Number.isNaN(target)) {
    return 3
  }

  return Math.max(0, Math.ceil((target - Date.now()) / (1000 * 60 * 60)))
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export default function EmergencyMode({
  subject,
  paper = 'Paper 1',
  examAt,
  briefing,
  onExit,
}: EmergencyModeProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const hoursUntil = getHoursUntil(examAt)
  const nightBefore = hoursUntil > 3
  const phase = Math.min(2, Math.floor(elapsedSeconds / 3600))
  const secondsLeftInPhase = 3600 - (elapsedSeconds % 3600)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsedSeconds((current) => Math.min(3 * 3600, current + 1))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

  const phases = useMemo(
    () =>
      nightBefore
        ? [
            {
              title: 'Night-before mode',
              actions: [
                'No new topics. Revise only what you have already practiced.',
                'Do memory consolidation questions from your strong and medium topics.',
                'Read common mistake warnings for your weak topics.',
                'Pack calculator, pens, ID, water, and admit card before 10 PM.',
              ],
            },
          ]
        : [
            {
              title: 'Hour 1: guaranteed-topic sprint',
              actions: [
                'Read the top prediction list.',
                'Do 3 quick questions per guaranteed topic.',
                'Use quick mark scheme checks only.',
              ],
            },
            {
              title: 'Hour 2: weak-topic rapid revision',
              actions: [
                'Revise weak topics using formulas and definitions.',
                'Make flashcards for keywords.',
                'Review common mistake warnings.',
              ],
            },
            {
              title: 'Hour 3: mini mock and final control',
              actions: [
                'Attempt a 30-minute mini mock.',
                'Mark instantly against the scheme.',
                'Write the final 3 things to remember before entering the exam.',
              ],
            },
          ],
    [nightBefore]
  )
  const activePhase = phases[nightBefore ? 0 : phase]

  return (
    <section
      style={{
        border: '1px solid rgba(248,113,113,0.38)',
        borderRadius: '26px',
        background: 'linear-gradient(145deg, rgba(127,29,29,0.42), rgba(15,23,42,0.92))',
        color: '#fee2e2',
        padding: '22px',
        display: 'grid',
        gap: '18px',
        boxShadow: '0 24px 80px rgba(127,29,29,0.22)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase', color: '#fecaca' }}>
            Emergency prep activated
          </div>
          <h2 style={{ margin: '8px 0 0', fontSize: 'clamp(26px, 4vw, 42px)' }}>
            {subject} {paper}
          </h2>
          <p style={{ margin: '8px 0 0', color: '#fecaca', lineHeight: 1.6 }}>
            {hoursUntil} hour{hoursUntil === 1 ? '' : 's'} until your exam. We protect marks first.
          </p>
        </div>

        <div
          style={{
            minWidth: '150px',
            borderRadius: '18px',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            padding: '14px',
            textAlign: 'center',
          }}
        >
          <div style={{ color: '#fecaca', fontSize: '12px' }}>{nightBefore ? 'Checklist mode' : 'Phase timer'}</div>
          <strong style={{ fontSize: '30px', display: 'block', marginTop: '4px' }}>
            {nightBefore ? 'Night' : formatTime(secondsLeftInPhase)}
          </strong>
        </div>
      </div>

      <article style={{ borderRadius: '20px', background: 'rgba(255,255,255,0.07)', padding: '18px' }}>
        <h3 style={{ margin: '0 0 12px', color: '#fff' }}>{activePhase.title}</h3>
        <ol style={{ margin: 0, paddingLeft: '20px', display: 'grid', gap: '8px', lineHeight: 1.6 }}>
          {activePhase.actions.map((action) => (
            <li key={action}>{action}</li>
          ))}
        </ol>
      </article>

      {briefing ? (
        <pre
          style={{
            whiteSpace: 'pre-wrap',
            margin: 0,
            color: '#fff7ed',
            background: 'rgba(0,0,0,0.22)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '18px',
            padding: '16px',
            lineHeight: 1.7,
            fontFamily: 'inherit',
          }}
        >
          {briefing}
        </pre>
      ) : null}

      {onExit ? (
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Exit emergency mode? Only do this if you are safe to stop the sprint.')) {
              onExit()
            }
          }}
          style={{
            justifySelf: 'start',
            border: '1px solid rgba(255,255,255,0.24)',
            background: 'transparent',
            color: '#fee2e2',
            borderRadius: '999px',
            padding: '10px 14px',
            cursor: 'pointer',
            fontWeight: 800,
          }}
        >
          Exit emergency mode
        </button>
      ) : null}
    </section>
  )
}
