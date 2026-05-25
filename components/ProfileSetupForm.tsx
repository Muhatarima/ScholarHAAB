'use client'

import type { CSSProperties } from 'react'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BOARD_OPTIONS,
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
  title?: string
  subtitle?: string
  redirectHref?: string
  onSaved?: (profile: StudentProfile) => void
}

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

function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly T[]
  value: T | string
  onChange: (value: T) => void
}) {
  return (
    <div style={{ display: 'grid', gap: '8px' }}>
      <label style={{ fontSize: '12px', color: '#b8b4da' }}>{label}</label>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            style={buttonStyle(value === option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function ProfileSetupForm({
  initialProfile,
  title = 'Set up your study profile',
  subtitle = 'This helps ScholarHAAB answer correctly from your very first message.',
  redirectHref,
  onSaved,
}: Props) {
  const router = useRouter()
  const [preferredBoard, setPreferredBoard] = useState(initialProfile.preferredBoard ?? 'Cambridge')
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

  const toggleSubject = (subject: string) => {
    setPreferredSubjects((current) =>
      current.includes(subject) ? current.filter((entry) => entry !== subject) : [...current, subject]
    )
  }

  const handleSave = async () => {
    if (preferredSubjects.length === 0) {
      setError('Pick at least one subject so QBank can guide you properly.')
      return
    }

    setSaving(true)
    setError(null)

    const nextProfilePatch: Partial<StudentProfile> = {
      defaultProduct: 'qbank',
      preferredBoard,
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
        throw new Error(data.error || 'Could not save your profile right now.')
      }

      const nextProfile = data.profile as StudentProfile
      onSaved?.(nextProfile)
      if (redirectHref) {
        router.push(redirectHref)
        router.refresh()
      }
    } catch {
      const localProfile = buildLocalStudentProfile(initialProfile, nextProfilePatch)
      saveLocalStudentProfile(localProfile)
      onSaved?.(localProfile)
      setError(null)
      if (redirectHref) {
        router.push(redirectHref)
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        display: 'grid',
        gap: '16px',
        color: '#ebe9ff',
      }}
    >
      <div>
        <h2 style={{ fontSize: '24px', margin: '0 0 8px' }}>{title}</h2>
        <p style={{ margin: 0, color: '#a8a6c8', lineHeight: 1.7, fontSize: '14px' }}>{subtitle}</p>
      </div>

      <div
        style={{
          borderRadius: '16px',
          border: '1px solid rgba(170,85,255,0.16)',
          background: 'rgba(255,255,255,0.03)',
          color: '#d6d2f1',
          padding: '12px 14px',
          fontSize: '13px',
          lineHeight: 1.6,
        }}
      >
        QBank setup only: board, level, language, and subjects stay ready from message 1.
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

      <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <ChoiceGroup label="Board" options={BOARD_OPTIONS} value={preferredBoard} onChange={setPreferredBoard} />
        <ChoiceGroup label="Level" options={LEVEL_OPTIONS} value={preferredLevel} onChange={setPreferredLevel} />
      </div>

      <div style={{ display: 'grid', gap: '10px' }}>
        <label style={{ fontSize: '12px', color: '#b8b4da' }}>Subjects you want ready from message 1</label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {selectableSubjects.map((subject) => {
            const active = preferredSubjects.includes(subject)
            return (
              <button
                key={subject}
                onClick={() => toggleSubject(subject)}
                style={{
                  borderRadius: '999px',
                  border: active ? '1px solid rgba(107,228,255,0.36)' : '1px solid rgba(170,85,255,0.16)',
                  background: active ? 'rgba(107,228,255,0.12)' : 'rgba(255,255,255,0.03)',
                  color: active ? '#bff0ff' : '#d6d2f1',
                  padding: '9px 12px',
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

      <button
        onClick={() => void handleSave()}
        disabled={saving}
        style={{
          borderRadius: '16px',
          border: 'none',
          background: 'linear-gradient(130deg,#7733cc,#aa55ff)',
          color: '#fff',
          padding: '14px 18px',
          cursor: saving ? 'default' : 'pointer',
          fontSize: '14px',
          fontWeight: 600,
        }}
      >
        {saving ? 'Saving your setup...' : 'Save setup and continue'}
      </button>
    </div>
  )
}
