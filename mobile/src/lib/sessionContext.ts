import type { Product, SessionContext, StudentProfile } from '../types'
import { createEmptySessionContext } from '../types'

const SUBJECT_MAP: Record<string, string> = {
  chemistry: 'Chemistry',
  physics: 'Physics',
  math: 'Mathematics',
  maths: 'Mathematics',
  mathematics: 'Mathematics',
  biology: 'Biology',
  economics: 'Economics',
  accounting: 'Accounting',
  english: 'English',
  ict: 'ICT',
  'computer science': 'Computer Science',
  cse: 'Computer Science',
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function detectSubject(message: string) {
  const normalized = normalizeText(message)
  return (
    Object.entries(SUBJECT_MAP).find(([key]) => normalized.includes(key))?.[1] ?? null
  )
}

function detectCountry(message: string) {
  const normalized = normalizeText(message)
  const options = ['Australia', 'Canada', 'Germany', 'Japan', 'United Kingdom', 'United States', 'Europe']
  return options.find((country) => normalized.includes(country.toLowerCase())) ?? null
}

function detectDegree(message: string) {
  const normalized = normalizeText(message)
  if (/\bphd|doctor/i.test(normalized)) return 'PhD'
  if (/\bmaster|msc|ms\b/i.test(normalized)) return 'Masters'
  if (/\bbachelor|undergrad/i.test(normalized)) return 'Bachelors'
  return null
}

export function mergeProfileIntoSessionContext(
  product: Product,
  profile: StudentProfile,
  current: SessionContext = createEmptySessionContext()
) {
  return {
    ...current,
    board: product === 'qbank' ? profile.preferredBoard : current.board,
    level: product === 'qbank' ? profile.preferredLevel : current.level,
    subject: product === 'qbank' ? profile.preferredSubjects[0] ?? current.subject : current.subject,
    target_country: product === 'abroad' ? profile.targetCountry : current.target_country,
    degree: product === 'abroad' ? profile.targetDegree : current.degree,
    field: product === 'abroad' ? profile.targetField : current.field,
    funding_preference: product === 'abroad' ? profile.fundingPreference : current.funding_preference,
    nationality: profile.nationality ?? current.nationality,
    language: profile.preferredLanguage ?? current.language,
  }
}

export function updateSessionContext(
  current: SessionContext,
  userMessage: string,
  assistantMessage: string,
  product: Product
): SessionContext {
  const next = { ...current }
  const subject = detectSubject(userMessage)
  const topicHint = userMessage.split(/[?.!]/)[0]?.trim()

  if (product === 'qbank' && subject) {
    next.subject = subject
  }

  if (product === 'abroad') {
    next.target_country = detectCountry(userMessage) ?? next.target_country
    next.degree = detectDegree(userMessage) ?? next.degree
    next.field = subject ?? next.field
  }

  if (topicHint && topicHint.length >= 4) {
    next.topic_history = [topicHint, ...next.topic_history.filter((entry) => entry !== topicHint)].slice(0, 6)
  }

  if (/\bconfused|don't understand|help\b/i.test(userMessage)) {
    next.frustration_level = Math.min(5, next.frustration_level + 1)
  } else if (assistantMessage) {
    next.frustration_level = Math.max(0, next.frustration_level - 1)
  }

  next.message_count += 1
  return next
}
