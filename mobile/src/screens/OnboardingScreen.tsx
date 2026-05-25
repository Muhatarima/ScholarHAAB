import React, { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useAuth } from '../context/AuthContext'
import { Card, InlineError, PrimaryButton, Screen, SecondaryButton } from '../components/UI'
import {
  ABROAD_COUNTRY_OPTIONS,
  ABROAD_DEGREE_OPTIONS,
  BOARD_OPTIONS,
  LANGUAGE_OPTIONS,
  LEVEL_OPTIONS,
  QBANK_SUBJECT_OPTIONS,
} from '../types'
import { colors } from '../theme'

export function OnboardingScreen() {
  const { profile, updateProfile } = useAuth()
  const [step, setStep] = useState(0)
  const [board, setBoard] = useState(profile?.preferredBoard ?? 'Cambridge')
  const [level, setLevel] = useState(profile?.preferredLevel ?? 'A Level')
  const [subjects, setSubjects] = useState<string[]>(profile?.preferredSubjects?.length ? profile.preferredSubjects : ['Chemistry'])
  const [wantsAbroad, setWantsAbroad] = useState(Boolean(profile?.targetCountry || profile?.targetDegree))
  const [country, setCountry] = useState(profile?.targetCountry ?? 'Australia')
  const [degree, setDegree] = useState(profile?.targetDegree ?? 'Masters')
  const [language, setLanguage] = useState(profile?.preferredLanguage ?? 'en')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const subjectChoices = useMemo(
    () => (level === 'O Level' ? QBANK_SUBJECT_OPTIONS.slice(0, 8) : QBANK_SUBJECT_OPTIONS),
    [level]
  )

  const toggleSubject = (subject: string) => {
    setSubjects((current) => {
      if (current.includes(subject)) {
        return current.filter((entry) => entry !== subject)
      }
      return current.length >= 8 ? current : [...current, subject]
    })
  }

  const finish = async () => {
    setSaving(true)
    setError(null)
    try {
      await updateProfile({
        defaultProduct: wantsAbroad ? 'abroad' : 'qbank',
        preferredBoard: board,
        preferredLevel: level,
        preferredSubjects: subjects,
        preferredLanguage: language,
        targetCountry: wantsAbroad ? country : null,
        targetDegree: wantsAbroad ? degree : null,
        targetField: wantsAbroad ? subjects[0] ?? 'Computer Science' : null,
        fundingPreference: wantsAbroad ? 'Fully Funded' : null,
        wantsDeadlineAlerts: true,
        onboardingCompleted: true,
      })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save onboarding.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Screen title="Set up your profile" subtitle="This keeps mobile answers aligned from the first message.">
      <Card>
        <Text style={styles.stepLabel}>Step {step + 1} of 4</Text>
        {step === 0 ? (
          <>
            <Text style={styles.heading}>Which board do you study most?</Text>
            <ChipRow options={BOARD_OPTIONS as unknown as string[]} value={board} onSelect={setBoard} />
          </>
        ) : null}
        {step === 1 ? (
          <>
            <Text style={styles.heading}>What level are you at?</Text>
            <ChipRow options={LEVEL_OPTIONS as unknown as string[]} value={level} onSelect={setLevel} />
          </>
        ) : null}
        {step === 2 ? (
          <>
            <Text style={styles.heading}>Which subjects matter right now?</Text>
            <View style={styles.wrapRow}>
              {subjectChoices.map((subject) => {
                const active = subjects.includes(subject)
                return (
                  <Pressable key={subject} onPress={() => toggleSubject(subject)} style={[styles.chip, active && styles.activeChip]}>
                    <Text style={[styles.chipText, active && styles.activeChipText]}>{subject}</Text>
                  </Pressable>
                )
              })}
            </View>
          </>
        ) : null}
        {step === 3 ? (
          <>
            <Text style={styles.heading}>Do you want Abroad support ready too?</Text>
            <ChipRow
              options={['QBank only', 'Yes, keep Abroad ready']}
              value={wantsAbroad ? 'Yes, keep Abroad ready' : 'QBank only'}
              onSelect={(value) => setWantsAbroad(value === 'Yes, keep Abroad ready')}
            />
            {wantsAbroad ? (
              <>
                <Text style={styles.subHeading}>Target country</Text>
                <ChipRow options={ABROAD_COUNTRY_OPTIONS} value={country} onSelect={setCountry} />
                <Text style={styles.subHeading}>Target degree</Text>
                <ChipRow options={ABROAD_DEGREE_OPTIONS as unknown as string[]} value={degree} onSelect={setDegree} />
              </>
            ) : null}
            <Text style={styles.subHeading}>App language</Text>
            <ChipRow
              options={LANGUAGE_OPTIONS.map((option) => option.label)}
              value={language === 'bn' ? 'Bangla' : 'English'}
              onSelect={(value) => setLanguage(value === 'Bangla' ? 'bn' : 'en')}
            />
          </>
        ) : null}
        <InlineError message={error} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <SecondaryButton label="Back" onPress={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0 || saving} />
          {step < 3 ? (
            <PrimaryButton label="Next" onPress={() => setStep((current) => Math.min(3, current + 1))} disabled={saving || (step === 2 && subjects.length === 0)} />
          ) : (
            <PrimaryButton label={saving ? 'Saving...' : 'Finish'} onPress={finish} disabled={saving} />
          )}
        </View>
      </Card>
    </Screen>
  )
}

function ChipRow({
  options,
  value,
  onSelect,
}: {
  options: string[]
  value: string
  onSelect: (value: string) => void
}) {
  return (
    <View style={styles.wrapRow}>
      {options.map((option) => {
        const active = option === value
        return (
          <Pressable key={option} onPress={() => onSelect(option)} style={[styles.chip, active && styles.activeChip]}>
            <Text style={[styles.chipText, active && styles.activeChipText]}>{option}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  stepLabel: {
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
  },
  heading: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  subHeading: {
    color: colors.mutedText,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panelSoft,
  },
  activeChip: {
    backgroundColor: 'rgba(107,228,255,0.15)',
    borderColor: 'rgba(107,228,255,0.32)',
  },
  chipText: {
    color: colors.mutedText,
  },
  activeChipText: {
    color: colors.text,
    fontWeight: '700',
  },
})
