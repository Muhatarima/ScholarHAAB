import type { Product } from '@/lib/products'
import { createEmptyStudyProgress, type StudyProgressSnapshot } from '@/lib/study-progress'

export type SupportedLanguage = 'en' | 'bn'

export type StudentProfile = {
  id: string
  email: string | null
  fullName: string | null
  dateOfBirth: string | null
  defaultProduct: Product | null
  preferredBoard: string | null
  preferredLevel: string | null
  preferredSubjects: string[]
  preferredLanguage: SupportedLanguage
  targetCountry: string | null
  targetDegree: string | null
  targetField: string | null
  fundingPreference: string | null
  nationality: string
  onboardingCompleted: boolean
  wantsDeadlineAlerts: boolean
  createdAt: string | null
  updatedAt: string | null
  activeTier: string | null
  activeSubscriptionStatus: string | null
  studyProgress: StudyProgressSnapshot
}

export const BOARD_OPTIONS = ['Cambridge', 'Edexcel'] as const
export const LEVEL_OPTIONS = ['O Level', 'A Level'] as const
export const LANGUAGE_OPTIONS: Array<{ value: SupportedLanguage; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'bn', label: 'Bangla' },
]

export const QBANK_SUBJECT_OPTIONS = [
  'Chemistry',
  'Physics',
  'Mathematics',
  'Biology',
  'Economics',
  'Accounting',
  'English',
  'ICT',
  'Computer Science',
  'Finance',
  'Geography',
]

export const ABROAD_FIELD_OPTIONS = [
  'Computer Science',
  'Engineering',
  'Economics',
  'Business',
  'Chemistry',
  'Physics',
  'Biology',
  'Mathematics',
  'Medicine',
]

export const ABROAD_COUNTRY_OPTIONS = [
  'Australia',
  'Canada',
  'Germany',
  'Japan',
  'United Kingdom',
  'United States',
  'Europe',
]

export const ABROAD_DEGREE_OPTIONS = ['Bachelors', 'Masters', 'PhD', 'Research'] as const
export const FUNDING_OPTIONS = ['Fully Funded', 'Partial', 'Any'] as const
export const LOCAL_PROFILE_STORAGE_KEY = 'scholarhaab.localProfile.v1'

export function createEmptyStudentProfile(id = ''): StudentProfile {
  return {
    id,
    email: null,
    fullName: null,
    dateOfBirth: null,
    defaultProduct: 'qbank',
    preferredBoard: null,
    preferredLevel: null,
    preferredSubjects: [],
    preferredLanguage: 'en',
    targetCountry: null,
    targetDegree: null,
    targetField: null,
    fundingPreference: null,
    nationality: 'Bangladesh',
    onboardingCompleted: false,
    wantsDeadlineAlerts: true,
    createdAt: null,
    updatedAt: null,
    activeTier: null,
    activeSubscriptionStatus: null,
    studyProgress: createEmptyStudyProgress(),
  }
}

export function buildLocalStudentProfile(
  initialProfile: StudentProfile,
  patch: Partial<StudentProfile>
): StudentProfile {
  return {
    ...initialProfile,
    ...patch,
    id: initialProfile.id || 'local-profile',
    email: initialProfile.email,
    fullName: initialProfile.fullName,
    dateOfBirth: initialProfile.dateOfBirth,
    activeTier: initialProfile.activeTier,
    activeSubscriptionStatus: initialProfile.activeSubscriptionStatus,
    studyProgress: initialProfile.studyProgress,
    createdAt: initialProfile.createdAt,
    updatedAt: new Date().toISOString(),
  }
}

export function readLocalStudentProfile(): StudentProfile | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const rawProfile = window.localStorage.getItem(LOCAL_PROFILE_STORAGE_KEY)
    if (!rawProfile) {
      return null
    }

    const profile = JSON.parse(rawProfile) as StudentProfile
    return profile && typeof profile === 'object' ? profile : null
  } catch {
    return null
  }
}

export function saveLocalStudentProfile(profile: StudentProfile): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    window.localStorage.setItem(LOCAL_PROFILE_STORAGE_KEY, JSON.stringify(profile))
    return true
  } catch {
    return false
  }
}

export function sanitizeSupportedLanguage(value: unknown): SupportedLanguage {
  return value === 'bn' ? 'bn' : 'en'
}
