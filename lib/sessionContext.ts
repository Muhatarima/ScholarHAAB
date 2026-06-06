import type { Product } from '@/lib/products'
import type { StudentProfile, SupportedLanguage } from '@/lib/user-profile'

export interface SessionContext {
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

type SessionMessage = {
  role: 'user' | 'assistant'
  content: string
}

const SUBJECT_MAP: Record<string, string> = {
  chemistry: 'Chemistry',
  physics: 'Physics',
  math: 'Mathematics',
  maths: 'Mathematics',
  mathematics: 'Mathematics',
  biology: 'Biology',
  economics: 'Economics',
  accounting: 'Accounting',
  accounts: 'Accounting',
  english: 'English',
  ict: 'ICT',
  'computer science': 'Computer Science',
  cse: 'Computer Science',
  finance: 'Finance',
  geography: 'Geography',
}

const COUNTRY_PATTERNS: Array<{ pattern: RegExp; value: string }> = [
  { pattern: /\b(australia|australian)\b/i, value: 'Australia' },
  { pattern: /\b(uk|united kingdom|britain|england)\b/i, value: 'United Kingdom' },
  { pattern: /\b(usa|united states|america|american)\b/i, value: 'United States' },
  { pattern: /\b(japan|japanese)\b/i, value: 'Japan' },
  { pattern: /\b(germany|german|deutschland)\b/i, value: 'Germany' },
  { pattern: /\b(canada|canadian)\b/i, value: 'Canada' },
  { pattern: /\b(europe|european)\b/i, value: 'Europe' },
  { pattern: /\b(hungary)\b/i, value: 'Hungary' },
  { pattern: /\b(turkey|turkiye)\b/i, value: 'Turkey' },
]

const DEGREE_PATTERNS: Array<{ pattern: RegExp; value: string }> = [
  { pattern: /\b(masters?|master'?s|ms|m\.s|msc|postgrad)\b/i, value: 'Masters' },
  { pattern: /\b(phd|ph\.d|doctorate|doctoral)\b/i, value: 'PhD' },
  { pattern: /\b(bachelors?|bsc|b\.sc|undergrad|undergraduate)\b/i, value: 'Bachelors' },
  { pattern: /\b(research|mphil|m\.phil)\b/i, value: 'Research' },
]

const FIELD_PATTERNS: Array<{ pattern: RegExp; value: string }> = [
  { pattern: /\b(cse|computer science|software|programming|cs)\b/i, value: 'Computer Science' },
  { pattern: /\b(engineering|mechanical|electrical|civil|eee)\b/i, value: 'Engineering' },
  { pattern: /\b(economics|development|finance|business)\b/i, value: 'Economics' },
  { pattern: /\b(medicine|medical|mbbs|health)\b/i, value: 'Medicine' },
  { pattern: /\b(chemistry|chem)\b/i, value: 'Chemistry' },
  { pattern: /\b(physics)\b/i, value: 'Physics' },
  { pattern: /\b(biology|bio|biotech)\b/i, value: 'Biology' },
  { pattern: /\b(math|maths|mathematics|statistics)\b/i, value: 'Mathematics' },
]

const TOPIC_PATTERNS: Array<{ pattern: RegExp; value: string }> = [
  { pattern: /\bintegration by parts\b/i, value: 'Integration by Parts' },
  { pattern: /\bintegration\b/i, value: 'Integration' },
  { pattern: /\bdifferentiation|differentiate|derivative\b/i, value: 'Differentiation' },
  { pattern: /\bvectors?\b/i, value: 'Vectors' },
  { pattern: /\borganic chemistry\b/i, value: 'Organic Chemistry' },
  { pattern: /\bwave motion\b/i, value: 'Wave Motion' },
  { pattern: /\bthermodynamics?\b/i, value: 'Thermodynamics' },
  { pattern: /\bideal gas\b/i, value: 'Ideal Gas' },
  { pattern: /\bperiodic (table|trend|trends)\b/i, value: 'Periodic Trends' },
  { pattern: /\bequilibrium\b/i, value: 'Equilibrium' },
  { pattern: /\belectrolysis\b/i, value: 'Electrolysis' },
  { pattern: /\bbonding\b/i, value: 'Bonding' },
  { pattern: /\bmechanics?\b/i, value: 'Mechanics' },
  { pattern: /\bkinematics?\b/i, value: 'Kinematics' },
  { pattern: /\bseries and parallel circuits?\b/i, value: 'Series and Parallel Circuits' },
  { pattern: /\bscholarships?\b/i, value: 'Scholarship Search' },
  { pattern: /\bsop\b/i, value: 'SOP Review' },
  { pattern: /\blor\b/i, value: 'LOR Review' },
  { pattern: /\bcv|resume\b/i, value: 'CV Review' },
  { pattern: /\bvisa|proof of funds|maintenance funds|budget\b/i, value: 'Visa and Budget' },
]

const FRUSTRATION_PATTERNS = [
  /don'?t understand/i,
  /confused/i,
  /i give up/i,
  /still wrong/i,
  /not helping/i,
  /useless/i,
  /what.*even.*mean/i,
]

const QBANK_BOARD_PATTERN = /\b(cambridge|cie|edexcel|pearson|aqa|ocr)\b/i
const QBANK_LEVEL_PATTERN = /\b(o.?level|igcse|a.?level|alevel|international advanced level)\b/i
const QBANK_SUBJECT_PATTERN =
  /\b(physics|chemistry|math(?:ematics|s)?|biology|economics|accounting|english|ict|computer science|finance|geography)\b/i
const YEAR_PATTERN = /\b(20\d{2})\b/

function dedupe(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function countBy(values: string[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1
    return acc
  }, {})
}

function detectIntent(message: string, product?: Product) {
  const normalized = normalizeWhitespace(message).toLowerCase()

  if (product === 'abroad' || /\b(scholarship|funded|visa|sop|lor|cv|budget|country)\b/.test(normalized)) {
    if (/\b(anything else|more options|shortlist|narrow it down|continue)\b/.test(normalized)) {
      return 'SCHOLARSHIP_FOLLOW_UP'
    }
    if (/\b(scholarship|funded|masters|phd|bachelor|study abroad)\b/.test(normalized)) {
      return 'SCHOLARSHIP_SEARCH'
    }
  }

  if (/\b(20\d{2}|paper|mark scheme|qp|ms)\b/.test(normalized)) {
    return 'PAPER_SEARCH'
  }

  if (/\b(repeat|important topic|important topics|most repeated|predict|appear most)\b/.test(normalized)) {
    return 'TOPIC_SEARCH'
  }

  if (/\b(differentiate|derivative|integrate|formula|define|explain|what is)\b/.test(normalized)) {
    return 'GENERAL_KNOWLEDGE'
  }

  if (/\b(help|teach|i don't understand|confused)\b/.test(normalized)) {
    return 'CONVERSATIONAL'
  }

  return product === 'abroad' ? 'ABROAD_CHAT' : 'QBANK_CHAT'
}

function matchFirst(text: string, patterns: Array<{ pattern: RegExp; value: string }>) {
  return patterns.find((entry) => entry.pattern.test(text))?.value ?? null
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

export function sanitizeSessionContext(value: unknown): SessionContext {
  const fallback = createEmptySessionContext()
  if (!value || typeof value !== 'object') {
    return fallback
  }

  const record = value as Record<string, unknown>

  return {
    subject: typeof record.subject === 'string' ? record.subject : null,
    board: typeof record.board === 'string' ? record.board : null,
    level: typeof record.level === 'string' ? record.level : null,
    year: typeof record.year === 'string' ? record.year : null,
    topic_history: Array.isArray(record.topic_history)
      ? dedupe(record.topic_history.filter((entry): entry is string => typeof entry === 'string')).slice(-30)
      : [],
    weak_areas: Array.isArray(record.weak_areas)
      ? dedupe(record.weak_areas.filter((entry): entry is string => typeof entry === 'string')).slice(-10)
      : [],
    target_country: typeof record.target_country === 'string' ? record.target_country : null,
    degree: typeof record.degree === 'string' ? record.degree : null,
    field: typeof record.field === 'string' ? record.field : null,
    funding_preference:
      typeof record.funding_preference === 'string' ? record.funding_preference : null,
    nationality: typeof record.nationality === 'string' ? record.nationality : 'Bangladesh',
    language: record.language === 'bn' ? 'bn' : 'en',
    message_count: typeof record.message_count === 'number' ? record.message_count : 0,
    last_intent: typeof record.last_intent === 'string' ? record.last_intent : null,
    frustration_level:
      typeof record.frustration_level === 'number'
        ? Math.max(0, Math.min(3, Math.round(record.frustration_level)))
        : 0,
  }
}

export function extractTopics(message: string) {
  const topics = TOPIC_PATTERNS.filter((entry) => entry.pattern.test(message)).map(
    (entry) => entry.value
  )
  return dedupe(topics).slice(0, 6)
}

export function updateSessionContext(
  currentContext: SessionContext | null | undefined,
  userMessage: string,
  aiResponse = '',
  product?: Product
) {
  const next = {
    ...sanitizeSessionContext(currentContext),
    message_count: sanitizeSessionContext(currentContext).message_count + 1,
  }
  const normalized = normalizeWhitespace(userMessage)
  const lower = normalized.toLowerCase()

  for (const [keyword, subject] of Object.entries(SUBJECT_MAP)) {
    if (lower.includes(keyword)) {
      next.subject = subject
    }
  }

  if (/cambridge|cie/i.test(normalized)) {
    next.board = 'Cambridge'
  }
  if (/edexcel|pearson/i.test(normalized)) {
    next.board = 'Edexcel'
  }

  if (/o.?level|igcse/i.test(normalized)) {
    next.level = 'O Level'
  }
  if (/a.?level|alevel|as level/i.test(normalized)) {
    next.level = 'A Level'
  }

  const yearMatch = normalized.match(YEAR_PATTERN)
  if (yearMatch?.[1]) {
    next.year = yearMatch[1]
  }

  const detectedTopics = extractTopics(normalized)
  if (detectedTopics.length > 0) {
    next.topic_history = dedupe([...next.topic_history, ...detectedTopics]).slice(-30)
  }

  const country = matchFirst(normalized, COUNTRY_PATTERNS)
  if (country) {
    next.target_country = country
  }

  const degree = matchFirst(normalized, DEGREE_PATTERNS)
  if (degree) {
    next.degree = degree
  }

  const field = matchFirst(normalized, FIELD_PATTERNS)
  if (field) {
    next.field = field
  }

  if (/\b(fully.?funded|full scholarship|full ride)\b/i.test(normalized)) {
    next.funding_preference = 'Fully Funded'
  } else if (/\b(partial|partially funded|low budget|affordable|cheap)\b/i.test(normalized)) {
    next.funding_preference = 'Partial'
  }

  if (/\b(bangladesh|bangladeshi)\b/i.test(normalized)) {
    next.nationality = 'Bangladesh'
  }

  const topicCounts = countBy(next.topic_history)
  next.weak_areas = Object.entries(topicCounts)
    .filter(([, count]) => count >= 2)
    .map(([topic]) => topic)
    .slice(0, 8)

  if (FRUSTRATION_PATTERNS.some((pattern) => pattern.test(normalized))) {
    next.frustration_level = Math.min(3, next.frustration_level + 1)
  } else if (aiResponse && next.frustration_level > 0 && /\b(got it|understand|clear)\b/i.test(aiResponse)) {
    next.frustration_level = Math.max(0, next.frustration_level - 1)
  }

  next.last_intent = detectIntent(normalized, product)

  return next
}

export function rebuildSessionContextFromMessages(
  messages: SessionMessage[],
  product?: Product
) {
  return messages.reduce((context, message, index) => {
    if (message.role !== 'user') {
      return context
    }

    const nextAssistant =
      messages.slice(index + 1).find((entry) => entry.role === 'assistant')?.content ?? ''

    return updateSessionContext(context, message.content, nextAssistant, product)
  }, createEmptySessionContext())
}

export function buildContextPrompt(
  ctx: SessionContext | null | undefined,
  product?: Product | null
) {
  const session = sanitizeSessionContext(ctx)
  const parts: string[] = []
  const includeAcademic = product !== 'abroad'
  const includeAbroad = product !== 'qbank'

  if (includeAcademic && session.subject) {
    parts.push(`Student is studying: ${session.subject}`)
  }
  if (includeAcademic && session.board) {
    parts.push(`Exam board: ${session.board}`)
  }
  if (includeAcademic && session.level) {
    parts.push(`Level: ${session.level}`)
  }
  if (includeAcademic && session.year) {
    parts.push(`Working year context: ${session.year}`)
  }
  if (includeAcademic && session.topic_history.length > 0) {
    parts.push(
      `Topics discussed this session: ${dedupe(session.topic_history).slice(-8).join(', ')}`
    )
  }
  if (includeAcademic && session.weak_areas.length > 0) {
    parts.push(`Struggling with: ${session.weak_areas.join(', ')} - be extra patient here`)
  }
  if (includeAcademic && session.frustration_level >= 2) {
    parts.push('IMPORTANT: Student seems frustrated. Be extra warm, encouraging, and simple.')
  }
  if (includeAbroad && session.target_country) {
    parts.push(`Target country: ${session.target_country}`)
  }
  if (includeAbroad && session.degree) {
    parts.push(`Degree level: ${session.degree}`)
  }
  if (includeAbroad && session.field) {
    parts.push(`Field: ${session.field}`)
  }
  if (includeAbroad && session.funding_preference) {
    parts.push(`Funding preference: ${session.funding_preference}`)
  }
  if (includeAbroad && session.nationality) {
    parts.push(`Student nationality: ${session.nationality}`)
  }
  if (session.language === 'bn') {
    parts.push('Preferred response language: Bengali with natural English technical terms where helpful.')
  } else {
    parts.push('Preferred response language: English.')
  }
  if (!product && session.last_intent) {
    parts.push(`Last detected intent: ${session.last_intent}`)
  }

  return parts.length > 0
    ? `## STUDENT SESSION CONTEXT\n${parts.join('\n')}\n\n`
    : ''
}

export function applySessionContextToMessage(
  product: Product,
  message: string,
  context: SessionContext | null | undefined
) {
  const session = sanitizeSessionContext(context)
  const normalized = normalizeWhitespace(message)

  if (!normalized) {
    return normalized
  }

  if (product === 'qbank') {
    const additions: string[] = []
    if (session.board && !QBANK_BOARD_PATTERN.test(normalized)) {
      additions.push(session.board)
    }
    if (session.level && !QBANK_LEVEL_PATTERN.test(normalized)) {
      additions.push(session.level)
    }
    if (session.subject && !QBANK_SUBJECT_PATTERN.test(normalized)) {
      additions.push(session.subject)
    }
    if (
      session.year &&
      !YEAR_PATTERN.test(normalized) &&
      /\b(last year|same year|that year|that paper)\b/i.test(normalized)
    ) {
      additions.push(session.year)
    }

    return additions.length > 0 ? `${normalized} ${additions.join(' ')}`.trim() : normalized
  }

  const abroadFollowUp =
    /\b(anything else|more options|more scholarships|shortlist more|narrow it down|narrow|continue|same requirements|same profile|anything more)\b/i

  const additions: string[] = []
  if (session.target_country && !COUNTRY_PATTERNS.some((entry) => entry.pattern.test(normalized))) {
    additions.push(session.target_country)
  }
  if (session.degree && !DEGREE_PATTERNS.some((entry) => entry.pattern.test(normalized))) {
    additions.push(session.degree)
  }
  if (session.field && !FIELD_PATTERNS.some((entry) => entry.pattern.test(normalized))) {
    additions.push(session.field)
  }
  if (
    session.funding_preference === 'Fully Funded' &&
    !/\b(fully.?funded|full scholarship|full ride)\b/i.test(normalized)
  ) {
    additions.push('fully funded')
  }
  if (
    session.funding_preference === 'Partial' &&
    !/\b(partial|partially funded|low budget|affordable|cheap)\b/i.test(normalized)
  ) {
    additions.push('partial')
  }
  if (session.nationality && !/\b(bangladesh|bangladeshi)\b/i.test(normalized)) {
    additions.push(session.nationality)
  }

  if (abroadFollowUp.test(normalized) || additions.length >= 2) {
    return additions.length > 0 ? `${normalized} ${additions.join(' ')}`.trim() : normalized
  }

  return normalized
}

export function mergeProfileIntoSessionContext(
  product: Product,
  profile: StudentProfile,
  currentContext?: SessionContext | null
) {
  const session = sanitizeSessionContext(currentContext)

  return sanitizeSessionContext({
    ...session,
    board: product === 'qbank' ? session.board ?? profile.preferredBoard : session.board,
    level: product === 'qbank' ? session.level ?? profile.preferredLevel : session.level,
    subject:
      product === 'qbank'
        ? session.subject ?? profile.preferredSubjects[0] ?? null
        : session.subject,
    target_country:
      product === 'abroad' ? session.target_country ?? profile.targetCountry : session.target_country,
    degree: product === 'abroad' ? session.degree ?? profile.targetDegree : session.degree,
    field: product === 'abroad' ? session.field ?? profile.targetField : session.field,
    funding_preference:
      product === 'abroad'
        ? session.funding_preference ?? profile.fundingPreference
        : session.funding_preference,
    nationality: session.nationality || profile.nationality || 'Bangladesh',
    language: profile.preferredLanguage ?? session.language ?? 'en',
  })
}
