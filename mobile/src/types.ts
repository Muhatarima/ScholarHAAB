export type Product = 'qbank' | 'abroad'
export type PromptMode = 'direct' | 'tutor'

export type SupportedLanguage = 'en' | 'bn'

export type StudyProgressSnapshot = {
  dailyGoalMinutes: number
  currentStreak: number
  totalStudyMinutes: number
  completedSessions: number
  strongestSubject: string | null
  weakestSubject: string | null
  updatedAt: string | null
}

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

export type SessionContext = {
  subject: string | null
  board: string | null
  level: string | null
  year: string | null
  topic_history: string[]
  weak_areas: string[]
  target_country: string | null
  degree: string | null
  field: string | null
  funding_preference: string | null
  nationality: string | null
  language: SupportedLanguage | null
  message_count: number
  last_intent: string | null
  frustration_level: number
}

export type SourceCitation = {
  title: string
  url?: string | null
  label: string
  verified: boolean
  lastChecked?: string | null
  score?: number | null
}

export type UsageState = {
  allowed: boolean
  remaining: number
  limit: number
  usageDate: string
  message?: string | null
}

export type MeResponse = {
  authenticated: boolean
  userId: string | null
  viewerKey: string
  tier: string
  onboardingCompleted: boolean
  preferredLanguage: SupportedLanguage
  defaultProduct: Product | null
  studyProgress: StudyProgressSnapshot
  isAdmin: boolean
}

export type ChatMessage = {
  id?: string
  role: 'user' | 'assistant'
  content: string
  sources?: SourceCitation[]
}

export type ChatSessionSummary = {
  id: string
  product: Product
  mode: PromptMode
  title: string
  lastMessagePreview: string
  updatedAt: string
}

export type ChatSessionDetail = {
  enabled: boolean
  session: ChatSessionSummary | null
  messages: ChatMessage[]
}

export type ChatResponse = {
  answer?: string
  response?: string
  error?: string
  cached?: boolean
  fromCache?: boolean
  confidence?: number
  sessionId?: string | null
  usage?: UsageState
  studyProgress?: StudyProgressSnapshot
  history?: {
    enabled: boolean
  }
  sources?: SourceCitation[]
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

export function createEmptyStudyProgress(): StudyProgressSnapshot {
  return {
    dailyGoalMinutes: 45,
    currentStreak: 0,
    totalStudyMinutes: 0,
    completedSessions: 0,
    strongestSubject: null,
    weakestSubject: null,
    updatedAt: null,
  }
}

export function createEmptyProfile(): StudentProfile {
  return {
    id: '',
    email: null,
    fullName: null,
    dateOfBirth: null,
    defaultProduct: null,
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

export function createEmptySessionContext(): SessionContext {
  return {
    subject: null,
    board: null,
    level: null,
    year: null,
    topic_history: [],
    weak_areas: [],
    target_country: null,
    degree: null,
    field: null,
    funding_preference: null,
    nationality: 'Bangladesh',
    language: 'en',
    message_count: 0,
    last_intent: null,
    frustration_level: 0,
  }
}
