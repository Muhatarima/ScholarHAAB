'use client'

import type { CSSProperties } from 'react'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  buildLocalStudentProfile,
  LANGUAGE_OPTIONS,
  LEVEL_OPTIONS,
  QBANK_SUBJECT_OPTIONS,
  saveLocalStudentProfile,
  type StudentProfile,
} from '@/lib/user-profile'

type Props = {
  initialProfile: StudentProfile
  productHint?: 'qbank' | 'abroad' | null
  onSaved?: (profile: StudentProfile) => void
}

type BoardChoice = 'Cambridge' | 'Edexcel' | 'Both'

const BOARD_CARDS: Array<{ value: BoardChoice; title: string; description: string }> = [
  {
    value: 'Cambridge',
    title: 'Cambridge International',
    description: 'Best if you mostly study CAIE papers and syllabuses.',
  },
  {
    value: 'Edexcel',
    title: 'Edexcel',
    description: 'Best if your prep revolves around Pearson Edexcel papers.',
  },
  {
    value: 'Both',
    title: 'Both boards',
    description: 'Use this if you study across both and want wider retrieval by default.',
  },
]

const STEP_TITLES = [
  'Which exam board are you studying?',
  'What level are you at?',
  'Which subjects matter right now?',
]

function buttonStyle(active: boolean): CSSProperties {
  return {
    borderRadius: '999px',
    border: active ? '1px solid rgba(107,228,255,0.36)' : '1px solid rgba(170,85,255,0.18)',
    background: active ? 'rgba(107,228,255,0.12)' : 'rgba(255,255,255,0.03)',
    color: active ? '#bff0ff' : '#f5f3ff',
    padding: '10px 13px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 700,
  }
}

export default function OnboardingFlow({ initialProfile, onSaved }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [boardChoice, setBoardChoice] = useState<BoardChoice>(
    initialProfile.preferredBoard === 'Cambridge' || initialProfile.preferredBoard === 'Edexcel'
      ? initialProfile.preferredBoard
      : 'Cambridge'
  )
  const [preferredLevel, setPreferredLevel] = useState(initialProfile.preferredLevel ?? 'A Level')
  const [preferredSubjects, setPreferredSubjects] = useState<string[]>(
    initialProfile.preferredSubjects.length > 0 ? initialProfile.preferredSubjects : ['Chemistry']
  )
  const [preferredLanguage, setPreferredLanguage] = useState(initialProfile.preferredLanguage ?? 'en')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectableSubjects = useMemo(
    () => (preferredLevel === 'O Level' ? QBANK_SUBJECT_OPTIONS.slice(0, 8) : QBANK_SUBJECT_OPTIONS),
    [preferredLevel]
  )

  const progress = `${Math.round((step / STEP_TITLES.length) * 100)}%`

  const toggleSubject = (subject: string) => {
    setPreferredSubjects((current) => {
      if (current.includes(subject)) {
        return current.filter((entry) => entry !== subject)
      }

      if (current.length >= 8) {
        return current
      }

      return [...current, subject]
    })
  }

  const canContinue =
    (step === 1 && Boolean(boardChoice)) ||
    (step === 2 && Boolean(preferredLevel)) ||
    (step === 3 && preferredSubjects.length > 0)

  const saveProfile = async () => {
    setSaving(true)
    setError(null)

    const nextProfilePatch: Partial<StudentProfile> = {
      defaultProduct: 'qbank',
      preferredBoard: boardChoice === 'Both' ? null : boardChoice,
      preferredLevel,
      preferredSubjects,
      preferredLanguage,
      targetCountry: null,
      targetDegree: null,
      targetField: null,
      fundingPreference: null,
      wantsDeadlineAlerts: false,
      onboardingCompleted: true,
    }

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify(nextProfilePatch),
      })

      const data = await res.json()
      if (!res.ok || !data.profile) {
        throw new Error(data.error || 'Could not save your setup right now.')
      }

      const nextProfile = data.profile as StudentProfile
      onSaved?.(nextProfile)
      router.push('/qbank')
      router.refresh()
    } catch {
      const localProfile = buildLocalStudentProfile(initialProfile, nextProfilePatch)
      saveLocalStudentProfile(localProfile)
      onSaved?.(localProfile)
      router.push('/qbank')
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: '20px', color: '#ebe9ff' }}>
      <div style={{ display: 'grid', gap: '10px' }}>
        <p style={{ margin: 0, fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase', color: '#9A6CFF' }}>
          Setup wizard
        </p>
        <h1 style={{ margin: 0, fontSize: 'clamp(28px, 4vw, 42px)', lineHeight: 1.08 }}>
          Let ScholarHAAB feel ready for QBank from message 1
        </h1>
        <p style={{ margin: 0, color: '#a8a6c8', lineHeight: 1.7, fontSize: '14px', maxWidth: '680px' }}>
          Give us your board, level, subjects, and language once so the past-paper solver stays exam-aware from the very first message.
        </p>
      </div>

      <div style={{ display: 'grid', gap: '10px' }}>
        <label style={{ fontSize: '12px', color: '#b8b4da' }}>Preferred language</label>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {LANGUAGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setPreferredLanguage(option.value)}
              style={{
                borderRadius: '999px',
                border: '1px solid rgba(170,85,255,0.24)',
                background:
                  preferredLanguage === option.value
                    ? 'linear-gradient(130deg,#7733cc,#aa55ff)'
                    : 'rgba(255,255,255,0.03)',
                color: '#fff',
                padding: '10px 14px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b9b4df', fontSize: '12px' }}>
          <span>
            Step {step} of {STEP_TITLES.length}
          </span>
          <span>{progress}</span>
        </div>
        <div
          style={{
            height: '10px',
            borderRadius: '999px',
            background: 'rgba(255,255,255,0.05)',
            overflow: 'hidden',
            border: '1px solid rgba(170,85,255,0.12)',
          }}
        >
          <div
            style={{
              width: progress,
              height: '100%',
              background: 'linear-gradient(130deg,#7733cc,#aa55ff)',
            }}
          />
        </div>
      </div>

      <section
        style={{
          borderRadius: '28px',
          border: '1px solid rgba(170,85,255,0.16)',
          background: 'rgba(255,255,255,0.04)',
          padding: '24px',
          display: 'grid',
          gap: '18px',
        }}
      >
        <div>
          <p style={{ margin: '0 0 8px', fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase', color: '#9A6CFF' }}>
            {STEP_TITLES[step - 1]}
          </p>
          <p style={{ margin: 0, color: '#a8a6c8', lineHeight: 1.7, fontSize: '14px' }}>
            {step === 1
              ? 'This helps QBank filter the right paper family immediately.'
              : step === 2
                ? 'We use this to keep difficulty and syllabus assumptions realistic.'
                : 'Pick the subjects you want instantly available in session memory.'}
          </p>
        </div>

        {step === 1 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            {BOARD_CARDS.map((card) => {
              const active = boardChoice === card.value
              return (
                <button
                  key={card.value}
                  onClick={() => setBoardChoice(card.value)}
                  style={{
                    textAlign: 'left',
                    borderRadius: '22px',
                    border: active ? '1px solid rgba(107,228,255,0.34)' : '1px solid rgba(170,85,255,0.16)',
                    background: active ? 'rgba(107,228,255,0.08)' : 'rgba(255,255,255,0.03)',
                    color: '#fff',
                    padding: '18px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase', color: active ? '#9fdfff' : '#9A6CFF' }}>
                    {card.value}
                  </div>
                  <div style={{ marginTop: '10px', fontSize: '22px', fontWeight: 600 }}>{card.title}</div>
                  <div style={{ marginTop: '8px', color: '#bfb8e4', fontSize: '13px', lineHeight: 1.6 }}>{card.description}</div>
                </button>
              )
            })}
          </div>
        ) : null}

        {step === 2 ? (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {LEVEL_OPTIONS.map((option) => (
              <button
                key={option}
                onClick={() => setPreferredLevel(option)}
                style={buttonStyle(preferredLevel === option)}
              >
                {option}
              </button>
            ))}
          </div>
        ) : null}

        {step === 3 ? (
          <div style={{ display: 'grid', gap: '10px' }}>
            <p style={{ margin: 0, color: '#b8b4da', fontSize: '12px' }}>
              Choose up to 8 subjects. We will keep them ready from your first chat.
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {selectableSubjects.map((subject) => {
                const active = preferredSubjects.includes(subject)
                return (
                  <button
                    key={subject}
                    onClick={() => toggleSubject(subject)}
                    style={{
                      borderRadius: '999px',
                      border: active ? '1px solid rgba(107,228,255,0.36)' : '1px solid rgba(170,85,255,0.18)',
                      background: active ? 'rgba(107,228,255,0.12)' : 'rgba(255,255,255,0.03)',
                      color: active ? '#bff0ff' : '#f5f3ff',
                      padding: '10px 13px',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    {subject}
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        {error ? (
          <div
            style={{
              borderRadius: '14px',
              border: '1px solid rgba(251,113,133,0.3)',
              background: 'rgba(127,29,29,0.25)',
              color: '#fecdd3',
              padding: '12px 14px',
              fontSize: '13px',
            }}
          >
            {error}
          </div>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setStep((current) => Math.max(1, current - 1))}
            disabled={step === 1 || saving}
            style={{
              borderRadius: '16px',
              border: '1px solid rgba(170,85,255,0.16)',
              background: 'rgba(255,255,255,0.03)',
              color: '#d9d4f5',
              padding: '12px 16px',
              cursor: step === 1 || saving ? 'default' : 'pointer',
            }}
          >
            Back
          </button>

          {step < STEP_TITLES.length ? (
            <button
              type="button"
              onClick={() => {
                if (!canContinue) {
                  setError('Complete this step first so QBank can stay accurate from message one.')
                  return
                }
                setError(null)
                setStep((current) => Math.min(STEP_TITLES.length, current + 1))
              }}
              style={{
                borderRadius: '16px',
                border: 'none',
                background: 'linear-gradient(130deg,#7733cc,#aa55ff)',
                color: '#fff',
                padding: '12px 16px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void saveProfile()}
              disabled={saving}
              style={{
                borderRadius: '16px',
                border: 'none',
                background: 'linear-gradient(130deg,#7733cc,#aa55ff)',
                color: '#fff',
                padding: '12px 16px',
                cursor: saving ? 'default' : 'pointer',
                fontWeight: 600,
              }}
            >
              {saving ? 'Saving your setup...' : 'Save setup and open QBank'}
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
