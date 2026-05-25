export type Message = {
  role: 'user' | 'assistant'
  content: string
}

export type IntentType =
  | 'define'
  | 'formula'
  | 'solve'
  | 'explain'
  | 'example'
  | 'past_paper'
  | 'confused'
  | 'skip'
  | 'confirm'
  | 'topic_change'
  | 'follow_up'
  | 'test_me'
  | 'check_answer'

export type Intent = {
  type: IntentType
  subject: string | null
  topic: string | null
  language: 'english' | 'bangla' | 'mixed'
  confidence: number
  entities: string[]
}

const SUBJECT_KEYWORDS: Record<string, string[]> = {
  Physics: [
    'force',
    'forces',
    'energy',
    'work',
    'wave',
    'current',
    'voltage',
    'momentum',
    'acceleration',
    'velocity',
    'pressure',
    'density',
    'power',
    'circuit',
  ],
  Chemistry: [
    'mole',
    'bond',
    'reaction',
    'acid',
    'alkali',
    'ph',
    'element',
    'compound',
    'enthalpy',
    'organic',
    'electrolysis',
    'atom',
  ],
  Mathematics: [
    'equation',
    'differentiate',
    'integrate',
    'matrix',
    'vector',
    'quadratic',
    'trigonometry',
    'probability',
    'gradient',
    'graph',
  ],
  Biology: [
    'cell',
    'dna',
    'photosynthesis',
    'enzyme',
    'osmosis',
    'respiration',
    'diffusion',
    'genetic',
    'plant',
    'blood',
  ],
}

const TOPIC_ALIASES: Record<string, string[]> = {
  work: ['work', 'work done'],
  photosynthesis: ['photosynthesis'],
  forces: ['force', 'forces', 'resultant force', 'motion'],
  waves: ['wave', 'waves', 'wavelength', 'frequency'],
  electricity: ['current', 'voltage', 'resistance', 'circuit'],
  moles: ['mole', 'moles', 'amount of substance'],
  bonding: ['bond', 'bonding', 'ionic', 'covalent'],
  calculus: ['differentiate', 'integrate', 'derivative', 'integral'],
  cells: ['cell', 'cells', 'membrane', 'nucleus'],
}

const BANGLA_HINTS = [
  'ki',
  'keno',
  'kivabe',
  'dao',
  'bujhini',
  'bujhechi',
  'pore',
  'porer',
  'koro',
  'bolo',
  'ache',
  'accha',
  'thik',
]

function normalize(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}\s'=+-]/gu, ' ').replace(/\s+/g, ' ').trim()
}

function detectLanguage(message: string): Intent['language'] {
  const normalized = normalize(message)
  const hasBanglaScript = /[\u0980-\u09FF]/u.test(message)
  const hasBanglaRoman = BANGLA_HINTS.some((word) => new RegExp(`\\b${word}\\b`, 'i').test(normalized))
  const hasEnglish = /\b(what|why|how|define|explain|solve|formula|example|question|answer)\b/i.test(normalized)

  if ((hasBanglaScript || hasBanglaRoman) && hasEnglish) return 'mixed'
  if (hasBanglaScript || hasBanglaRoman) return 'bangla'
  return 'english'
}

function detectSubjectFromText(text: string) {
  const normalized = normalize(text)
  let best: { subject: string; score: number } | null = null
  for (const [subject, keywords] of Object.entries(SUBJECT_KEYWORDS)) {
    const score = keywords.reduce((total, keyword) => total + (normalized.includes(keyword) ? 1 : 0), 0)
    if (score > 0 && (!best || score > best.score)) {
      best = { subject, score }
    }
  }
  return best?.subject ?? null
}

function detectTopicFromText(text: string) {
  const normalized = normalize(text)
  for (const [topic, aliases] of Object.entries(TOPIC_ALIASES)) {
    if (aliases.some((alias) => normalized.includes(alias))) return topic
  }

  const candidate = normalized
    .split(' ')
    .filter((word) => word.length >= 4 && !/^(what|why|how|define|explain|formula|solve|answer|koro|dao|ki|keno)$/.test(word))
    .slice(0, 3)
    .join(' ')

  return candidate || null
}

function lastContext(history: Message[]) {
  const recent = history.slice(-3).map((entry) => entry.content).join(' ')
  return {
    subject: detectSubjectFromText(recent),
    topic: detectTopicFromText(recent),
  }
}

function extractEntities(message: string) {
  const normalized = normalize(message)
  const entities = new Set<string>()
  for (const keywords of Object.values(SUBJECT_KEYWORDS)) {
    for (const keyword of keywords) {
      if (normalized.includes(keyword)) entities.add(keyword)
    }
  }
  for (const [topic, aliases] of Object.entries(TOPIC_ALIASES)) {
    if (aliases.some((alias) => normalized.includes(alias))) entities.add(topic)
  }
  for (const match of message.matchAll(/\b(?:19|20)\d{2}\b/g)) {
    entities.add(match[0])
  }
  return Array.from(entities).slice(0, 10)
}

function classifyType(message: string, hasContext: boolean): { type: IntentType; confidence: number } {
  const q = normalize(message)

  if (/\b(skip|next|pore|porer|pore dekhi|bad dao)\b/.test(q)) return { type: 'skip', confidence: 0.95 }
  if (/(bujhini|bujhi nai|again|different way|arekbar|bojhai|confused|huh)/i.test(q)) {
    return { type: 'confused', confidence: 0.95 }
  }
  if (/(bujhechi|got it|understood|ok|okay|accha|thik ache)/i.test(q)) return { type: 'confirm', confidence: 0.9 }
  if (/(check|mark my|is my answer|ami likhsi|my answer|eta thik)/i.test(q)) return { type: 'check_answer', confidence: 0.86 }
  if (/(test me|question dao|test koro|exam debo|quiz|practice question)/i.test(q)) return { type: 'test_me', confidence: 0.9 }
  if (/(past paper|paper e|202\d|201\d|ashesilo|came up|question paper|mark scheme)/i.test(q)) {
    return { type: 'past_paper', confidence: 0.88 }
  }
  if (/(formula|equation|sutro|সমীকরণ)/i.test(q)) return { type: 'formula', confidence: 0.9 }
  if (/(solve|answer|calculate|find|determine|work out|koro|সমাধান)/i.test(q)) return { type: 'solve', confidence: 0.86 }
  if (/^(what is|what are|define|meaning|ki hoy|ki|কী|কি)\b/i.test(q)) return { type: 'define', confidence: 0.84 }
  if (/(explain|why|how does|how|keno|kivabe|bujhiye|বোঝাও)/i.test(q)) return { type: 'explain', confidence: 0.82 }
  if (/(example|real life|udahoron|উদাহরণ)/i.test(q)) return { type: 'example', confidence: 0.82 }

  const wordCount = q.split(' ').filter(Boolean).length
  if (hasContext && wordCount <= 4) return { type: 'follow_up', confidence: 0.72 }
  if (wordCount <= 5) return { type: 'define', confidence: 0.58 }
  return { type: hasContext ? 'follow_up' : 'topic_change', confidence: 0.55 }
}

export function detectIntent(message: string, history: Message[] = []): Intent {
  const context = lastContext(history)
  const subject = detectSubjectFromText(message) ?? context.subject
  const topic = detectTopicFromText(message) ?? context.topic
  const classified = classifyType(message, Boolean(context.topic || context.subject))

  return {
    type: classified.type,
    subject,
    topic,
    language: detectLanguage(message),
    confidence: classified.confidence,
    entities: extractEntities(message),
  }
}
