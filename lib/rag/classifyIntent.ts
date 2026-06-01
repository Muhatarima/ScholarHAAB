import { normalizeQuery } from '@/lib/rag/normalizeQuery'

export type SolverIntent =
  | 'past_paper_search'
  | 'solve_question'
  | 'explain_topic'
  | 'exam_night_plan'
  | 'mock_request'
  | 'skipped_chapter'
  | 'emotional_panic'
  | 'dashboard_request'
  | 'unknown'

export type ClassifiedIntent = {
  intent: SolverIntent
  subject: string | null
  topic: string | null
  year: number | null
  board: string | null
  level: string | null
  skippedChapter: string | null
  emotionalState: 'stressed' | 'confused' | 'neutral'
  normalizedQuery: string
  language: 'english' | 'banglish' | 'mixed'
}

const SUBJECT_ALIASES: Array<[RegExp, string]> = [
  [/\bphysics\b/gi, 'Physics'],
  [/\bchemistry\b/gi, 'Chemistry'],
  [/\bbiology\b/gi, 'Biology'],
  [/\bmathematics\b|\bmath\b|\bmaths\b/gi, 'Mathematics'],
  [/\beconomics\b/gi, 'Economics'],
  [/\baccounting\b/gi, 'Accounting'],
  [/\bcomputer science\b|\bict\b/gi, 'Computer Science'],
  [/\bbusiness\b/gi, 'Business'],
  [/\benglish\b/gi, 'English Language'],
]

const TOPIC_ALIASES: Array<[RegExp, string]> = [
  [/\bwave(?:s)?\b|\bwave motion\b|\bwavelength\b|\bfrequency\b/gi, 'Wave Motion'],
  [/\borganic\b|\bhydrocarbon\b|\balkane\b|\balkene\b/gi, 'Organic Chemistry'],
  [/\bbonding\b|\bionic\b|\bcovalent\b/gi, 'Chemical Bonding'],
  [/\bdifferential equation\b|\bdifferential equations\b/gi, 'Differential Equations'],
  [/\bintegration\b|\bintegral\b/gi, 'Integration'],
  [/\bdifferentiation\b|\bderivative\b/gi, 'Differentiation'],
  [/\bforces?\b|\bnewton\b|\bmotion\b/gi, 'Forces and Motion'],
  [/\bphotosynthesis\b/gi, 'Photosynthesis'],
  [/\bwork done\b|\bwork\b/gi, 'Work, Energy and Power'],
  [/\breaction rate\b|\brates\b/gi, 'Rates of Reaction'],
]

function firstAlias(text: string, aliases: Array<[RegExp, string]>) {
  for (const [pattern, value] of aliases) {
    pattern.lastIndex = 0
    if (pattern.test(text)) return value
  }
  return null
}

function allAliases(text: string, aliases: Array<[RegExp, string]>) {
  const matches: string[] = []
  for (const [pattern, value] of aliases) {
    pattern.lastIndex = 0
    if (pattern.test(text) && !matches.includes(value)) {
      matches.push(value)
    }
  }
  return matches
}

function detectSkippedChapter(text: string, topic: string | null) {
  const patterns = [
    /\b([a-z][a-z\s]{2,40}?)\s+(?:cannot do|skipped|pari na|parina|skip)\b/i,
    /\b(?:i\s+)?skipped?\s+([a-z][a-z\s]{2,40}?)(?:,|\.|but|and|explain|bujhao|$)/i,
    /\bwithout\s+([a-z][a-z\s]{2,40}?)(?:,|\.|explain|bujhao|$)/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (!match?.[1]) continue
    const raw = match[1].replace(/\b(chemistry|chapter|topic|please)\b/gi, '').trim()
    if (!raw) continue
    return firstAlias(raw, TOPIC_ALIASES) ?? raw.replace(/\b\w/g, (char) => char.toUpperCase())
  }

  return /\bskipped|without|cannot do\b/i.test(text) ? topic : null
}

export function classifyIntent(input: string): ClassifiedIntent {
  const normalized = normalizeQuery(input)
  const text = normalized.normalizedQuery.toLowerCase()
  const subject = firstAlias(text, SUBJECT_ALIASES)
  let topic = firstAlias(text, TOPIC_ALIASES)
  const yearMatch = text.match(/\b(20(?:1[4-9]|2[0-6]))\b/)
  const board = /\bedexcel\b|\bpearson\b/.test(text)
    ? 'Edexcel'
    : /\bcambridge\b|\bcaie\b|\bcie\b/.test(text)
      ? 'Cambridge'
      : null
  const level = /\bo\s*level\b|\bigcse\b/.test(text)
    ? 'O Level'
    : /\ba\s*level\b|\bas\b|\ba2\b|\bial\b/.test(text)
      ? 'A Level'
      : null
  const skippedChapter = detectSkippedChapter(text, topic)
  if (skippedChapter) {
    const currentTopic = allAliases(text, TOPIC_ALIASES).find((candidate) => candidate !== skippedChapter)
    if (currentTopic) topic = currentTopic
  }
  const emotional = /\bpanic|fail|nervous|stressed|exam tomorrow|dar|scared|parbona|ami shesh\b/.test(text)
  const confused = /\bdo not understand|confus|bujh|help\b/.test(text)

  let intent: SolverIntent = 'unknown'
  if (emotional) intent = 'emotional_panic'
  else if (skippedChapter) intent = 'skipped_chapter'
  else if (/\bexam mode|exam plan|exam tomorrow|night before|prediction\b/.test(text)) intent = 'exam_night_plan'
  else if (/\bmock|test me|practice question\b/.test(text)) intent = 'mock_request'
  else if (/\bdashboard|progress|weak topic|streak\b/.test(text)) intent = 'dashboard_request'
  else if (/\b20(?:1[4-9]|2[0-6])\b|past paper|paper question|mark scheme|paper\s*\d/i.test(text)) intent = 'past_paper_search'
  else if (/\bcalculate|solve|find|determine|work out\b/.test(text)) intent = 'solve_question'
  else if (/\bexplain|define|what|why|how|do not understand|help\b/.test(text)) intent = 'explain_topic'

  return {
    intent,
    subject,
    topic,
    year: yearMatch ? Number(yearMatch[1]) : null,
    board,
    level,
    skippedChapter,
    emotionalState: emotional ? 'stressed' : confused ? 'confused' : 'neutral',
    normalizedQuery: normalized.normalizedQuery,
    language: normalized.language,
  }
}
