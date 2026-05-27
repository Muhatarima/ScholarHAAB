import { GoogleGenerativeAI } from '@google/generative-ai'

export type Message = {
  role: 'user' | 'assistant'
  content: string
}

export type ParserIntent =
  | 'define'
  | 'explain'
  | 'formula'
  | 'solve'
  | 'example'
  | 'past_paper'
  | 'confused'
  | 'skip'
  | 'confirm'
  | 'test_me'
  | 'check_answer'
  | 'off_topic'
  | 'greeting'
  | 'emotional'
  | 'gibberish'

export type UnderstandingCategory = 'academic' | 'emotional' | 'off_topic' | 'greeting' | 'gibberish'
export type UnderstandingLanguage = 'english' | 'bangla' | 'mixed'
export type EmotionalState = 'stressed' | 'curious' | 'frustrated' | 'neutral'
export type Subject = 'Physics' | 'Chemistry' | 'Mathematics' | 'Biology' | 'Economics' | 'Accounting'

export type UnderstandingResult = {
  raw: string
  cleanMessage: string
  correctedMessage: string
  intent: ParserIntent
  subject: Subject | null
  topic: string | null
  language: UnderstandingLanguage
  isAcademic: boolean
  emotionalState: EmotionalState
  shouldRunRAG: boolean
  suggestedResponse: string | null
  category: UnderstandingCategory
  shouldRunRag: boolean
  specialResponse?: string
  skippedTopic: string | null
  corrections: Array<{ from: string; to: string }>
}

type GeminiUnderstanding = {
  cleanMessage?: unknown
  intent?: unknown
  subject?: unknown
  topic?: unknown
  language?: unknown
  isAcademic?: unknown
  emotionalState?: unknown
  shouldRunRAG?: unknown
  suggestedResponse?: unknown
  skippedTopic?: unknown
}

const VALID_INTENTS = new Set<ParserIntent>([
  'define',
  'explain',
  'formula',
  'solve',
  'example',
  'past_paper',
  'confused',
  'skip',
  'confirm',
  'test_me',
  'check_answer',
  'off_topic',
  'greeting',
  'emotional',
  'gibberish',
])

const VALID_SUBJECTS = new Set<Subject>([
  'Physics',
  'Chemistry',
  'Mathematics',
  'Biology',
  'Economics',
  'Accounting',
])

function getGeminiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ''
}

function buildUnderstandingPrompt(raw: string, history: Message[]) {
  const correctedRaw = applyLocalCorrections(raw).text
  return `
You are an intent parser for a Cambridge exam 
tutoring app used by Bangladeshi students.

Analyze this message and return JSON only.
Message: "${correctedRaw}"
Original message: "${raw}"
Last 3 messages context: ${JSON.stringify(history.slice(-3))}

Return this exact JSON structure:
{
  "cleanMessage": "corrected version of message in English",
  "intent": "define|explain|formula|solve|example|past_paper|confused|skip|confirm|test_me|check_answer|off_topic|greeting|emotional|gibberish",
  "subject": "Physics|Chemistry|Mathematics|Biology|Economics|Accounting|null",
  "topic": "detected topic or null",
  "language": "english|bangla|mixed",
  "isAcademic": true/false,
  "emotionalState": "stressed|curious|frustrated|neutral",
  "shouldRunRAG": true/false,
  "skippedTopic": "topic student asked to avoid or null",
  "suggestedResponse": "if off_topic or emotional, suggested brief response, else null"
}

Examples:
"wat is werk dun" → cleanMessage: "what is work done", subject: Physics, isAcademic: true
"bujhini arekbar" → intent: confused, isAcademic: true
"ami fail korbo" → intent: emotional, isAcademic: false, suggestedResponse: "Nervous is normal — what topic first?"
"hi hello" → intent: greeting, isAcademic: false
"asdfgh" → intent: gibberish, isAcademic: false
"black hole explain" → isAcademic: true but off syllabus, shouldRunRAG: false
"explain reaction rates without organic chemistry" → skippedTopic: "organic chemistry", shouldRunRAG: true

Return ONLY valid JSON. No explanation.
`.trim()
}

function extractJson(text: string): GeminiUnderstanding {
  const trimmed = text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim()

  try {
    return JSON.parse(trimmed) as GeminiUnderstanding
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Gemini parser returned no JSON object')
    return JSON.parse(match[0]) as GeminiUnderstanding
  }
}

async function callGeminiParser(prompt: string) {
  const key = getGeminiKey()
  if (!key) throw new Error('Missing GEMINI_API_KEY')

  const genAI = new GoogleGenerativeAI(key)
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  })
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: 420,
      temperature: 0,
      topP: 0.2,
      topK: 1,
      responseMimeType: 'application/json',
    },
  })

  return result.response.text()
}

function asIntent(value: unknown): ParserIntent {
  const candidate = typeof value === 'string' ? value.trim() : ''
  if (VALID_INTENTS.has(candidate as ParserIntent)) return candidate as ParserIntent
  return 'gibberish'
}

function asLanguage(value: unknown): UnderstandingLanguage {
  if (value === 'bangla' || value === 'mixed' || value === 'english') return value
  return 'english'
}

function asEmotionalState(value: unknown): EmotionalState {
  if (value === 'stressed' || value === 'curious' || value === 'frustrated' || value === 'neutral') {
    return value
  }
  return 'neutral'
}

function asSubject(value: unknown): Subject | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  if (normalized === 'null') return null
  return VALID_SUBJECTS.has(normalized as Subject) ? (normalized as Subject) : null
}

function asNullableString(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed && trimmed !== 'null' ? trimmed : null
}

function applyLocalCorrections(raw: string) {
  const replacements: Array<[RegExp, string]> = [
    [/\bwaev\b/gi, 'wave'],
    [/\bphysic\b/gi, 'physics'],
    [/\bwerk\s+dun\b/gi, 'work done'],
    [/\bwork\s+dun\b/gi, 'work done'],
    [/\bphotsynthesis\b/gi, 'photosynthesis'],
    [/\bdifferentation\b/gi, 'differentiation'],
    [/\bnucelus\b/gi, 'nucleus'],
    [/\belctron\b/gi, 'electron'],
    [/\baccleration\b/gi, 'acceleration'],
    [/\bchemestry\b/gi, 'chemistry'],
    [/\bmathamatics\b/gi, 'mathematics'],
    [/\bbujhina\b/gi, "don't understand"],
    [/\bskipp\b/gi, 'skip'],
    [/\bnxt\b/gi, 'next'],
    [/\bwat\b/gi, 'what'],
    [/\bhw\b/gi, 'how'],
    [/\b(?:bcz|cz)\b/gi, 'because'],
    [/\b(?:plz|pls)\b/gi, 'please'],
    [/\bidk\b/gi, "I don't know"],
    [/\b(?:omg|lol)\b/gi, ''],
  ]
  const corrections: Array<{ from: string; to: string }> = []
  let text = raw

  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, (match) => {
      corrections.push({ from: match, to: replacement })
      return replacement
    })
  }

  text = text.replace(/\s+/g, ' ').trim()
  return { text, corrections }
}

function extractSkippedTopic(raw: string) {
  const corrected = applyLocalCorrections(raw).text
  const patterns = [
    /\bi\s+skipped\s+(.+?)(?:[,.!?]|$)/i,
    /\bwithout\s+(.+?)(?:[,.!?]|$)/i,
    /\bdon'?t\s+use\s+(.+?)(?:[,.!?]|$)/i,
    /\bami\s+(.+?)\s+pari\s+na(?:[,.!?]|$)/i,
    /\b(.+?)\s+skip\s+korechi(?:[,.!?]|$)/i,
  ]

  for (const pattern of patterns) {
    const match = corrected.match(pattern)
    const topic = match?.[1]?.trim()
    if (topic && topic.length > 2) {
      return topic.replace(/\bplease\b/gi, '').replace(/\s+/g, ' ').trim()
    }
  }

  return null
}

function deriveCategory(intent: ParserIntent, isAcademic: boolean): UnderstandingCategory {
  if (intent === 'greeting') return 'greeting'
  if (intent === 'gibberish') return 'gibberish'
  if (intent === 'emotional') return 'emotional'
  if (intent === 'off_topic') return 'off_topic'
  return isAcademic ? 'academic' : 'off_topic'
}

function normalizeParsed(raw: string, parsed: GeminiUnderstanding): UnderstandingResult {
  const local = applyLocalCorrections(raw)
  const intent = asIntent(parsed.intent)
  const cleanMessage = asNullableString(parsed.cleanMessage) ?? local.text
  const suggestedResponse = asNullableString(parsed.suggestedResponse)
  const skippedTopic = asNullableString(parsed.skippedTopic) ?? extractSkippedTopic(raw)
  const isAcademic = skippedTopic ? true : typeof parsed.isAcademic === 'boolean' ? parsed.isAcademic : false
  const shouldRunRAG = skippedTopic ? true : typeof parsed.shouldRunRAG === 'boolean' ? parsed.shouldRunRAG : false
  const category = deriveCategory(intent, isAcademic)
  const specialResponse =
    suggestedResponse ??
    (intent === 'greeting'
      ? 'Hey! What are we studying today?'
      : intent === 'gibberish'
        ? "Didn't catch that — what topic?"
        : undefined)

  return {
    raw,
    cleanMessage,
    correctedMessage: cleanMessage,
    intent,
    subject: asSubject(parsed.subject),
    topic: asNullableString(parsed.topic),
    language: asLanguage(parsed.language),
    isAcademic,
    emotionalState: asEmotionalState(parsed.emotionalState),
    shouldRunRAG,
    suggestedResponse,
    category,
    shouldRunRag: shouldRunRAG,
    specialResponse,
    skippedTopic,
    corrections:
      cleanMessage !== raw.trim()
        ? [{ from: raw, to: cleanMessage }, ...local.corrections]
        : local.corrections,
  }
}

function parserFailureResult(raw: string): UnderstandingResult {
  const local = applyLocalCorrections(raw)
  const trimmed = local.text
  const lower = trimmed.toLowerCase()
  const skippedTopic = extractSkippedTopic(raw)
  const emotional = /\b(panic|fail|nervous|parbona|dar|scared|ami shesh|kal exam|exam kal|kichui janina)\b/i.test(lower)
  if (emotional) {
    return {
      raw,
      cleanMessage: trimmed,
      correctedMessage: trimmed,
      intent: 'emotional',
      subject: null,
      topic: null,
      language: /ami|kal|dar|parbona|kichui/.test(lower) ? 'mixed' : 'english',
      isAcademic: false,
      emotionalState: 'stressed',
      shouldRunRAG: false,
      suggestedResponse: 'Nervous is normal — let’s focus on what matters. What topic first?',
      category: 'emotional',
      shouldRunRag: false,
      specialResponse: 'Nervous is normal — let’s focus on what matters. What topic first?',
      skippedTopic: null,
      corrections: local.corrections,
    }
  }

  if (/\b(bujhini|bujhi nai|bujhte|confus|stuck|arekbar|again)\b/i.test(lower)) {
    return {
      raw,
      cleanMessage: trimmed,
      correctedMessage: trimmed,
      intent: 'confused',
      subject: null,
      topic: null,
      language: /bujh|arekbar/.test(lower) ? 'mixed' : 'english',
      isAcademic: false,
      emotionalState: 'neutral',
      shouldRunRAG: false,
      suggestedResponse: null,
      category: 'off_topic',
      shouldRunRag: false,
      specialResponse:
        "Haan, arekbar. I'll explain it a different way: simple idea first, one tiny example, then exam wording. Which topic confused you?",
      skippedTopic: null,
      corrections: local.corrections,
    }
  }

  if (/^\s*(skip|next|porer ta|pore|bad dao)\s*$/i.test(lower)) {
    return {
      raw,
      cleanMessage: trimmed,
      correctedMessage: trimmed,
      intent: 'skip',
      subject: null,
      topic: null,
      language: /porer|pore|bad dao/.test(lower) ? 'mixed' : 'english',
      isAcademic: false,
      emotionalState: 'neutral',
      shouldRunRAG: false,
      suggestedResponse: 'Ok, skipping this. Send the next topic or ask for a formula.',
      category: 'off_topic',
      shouldRunRag: false,
      specialResponse: 'Ok, skipping this. Send the next topic or ask for a formula.',
      skippedTopic: null,
      corrections: local.corrections,
    }
  }

  const academicIntent = /\b(explain|define|calculate|solve|find|formula|state|what|why|how)\b/.test(lower)
  const academicTopic =
    /\b(newton|force|motion|work|energy|wave|photosynthesis|cell|atom|bond|equation|integral|differentiat|demand|supply)\b/.test(
      lower
    )
  const knownAcademicTerm =
    /\b(wave|force|work|energy|power|cell|atom|bond|rate|nucleus|electron|photosynthesis)\b/i.test(
      trimmed
    )
  const keyboardMash =
    !knownAcademicTerm &&
    /^[a-z]{4,}$/i.test(trimmed) &&
    !/[aeiou]{2}|(ing|tion|law|work|force)$/i.test(trimmed)
  const shouldTreatAsAcademic = !keyboardMash && (academicIntent || academicTopic || Boolean(skippedTopic))

  if (shouldTreatAsAcademic) {
    return {
      raw,
      cleanMessage: trimmed,
      correctedMessage: trimmed,
      intent: academicIntent && /\b(calculate|solve|find)\b/.test(lower) ? 'solve' : 'explain',
      subject: /\b(newton|force|motion|work|energy|wave)\b/.test(lower) ? 'Physics' : null,
      topic: academicTopic ? trimmed : null,
      language: 'english',
      isAcademic: true,
      emotionalState: 'neutral',
      shouldRunRAG: true,
      suggestedResponse: null,
      category: 'academic',
      shouldRunRag: true,
      skippedTopic,
      corrections: local.corrections,
    }
  }

  return {
    raw,
    cleanMessage: trimmed,
    correctedMessage: trimmed,
    intent: 'gibberish',
    subject: null,
    topic: null,
    language: 'english',
    isAcademic: false,
    emotionalState: 'neutral',
    shouldRunRAG: false,
    suggestedResponse: null,
    category: 'gibberish',
    shouldRunRag: false,
    specialResponse: "Didn't catch that — what topic?",
    skippedTopic: null,
    corrections: local.corrections,
  }
}

export async function understandMessage(raw: string, history: Message[] = []): Promise<UnderstandingResult> {
  const localText = applyLocalCorrections(raw).text.toLowerCase()
  const localAcademicFastPath =
    /\b20(?:1[4-9]|2[0-6])\b|past\s*paper|wave|newton|force|motion|reaction\s+rate|photosynthesis|string theory|without|explain|define|calculate|solve|formula|what|why|how|bujhini|bujhte|arekbar|panic|fail|nervous|skip/i.test(
      localText
    )
  if (localAcademicFastPath) {
    return parserFailureResult(raw)
  }

  try {
    const text = await callGeminiParser(buildUnderstandingPrompt(raw, history))
    return normalizeParsed(raw, extractJson(text))
  } catch {
    return parserFailureResult(raw)
  }
}

export function formatUnderstandingResponse(understood: UnderstandingResult) {
  if (understood.specialResponse) return understood.specialResponse
  if (understood.intent === 'greeting') return 'Hey! What are we studying today?'
  if (understood.intent === 'gibberish') return "Didn't catch that — what topic?"
  if (understood.intent === 'confused') {
    return "Haan, arekbar. Let's explain it a different way: start with the simple idea, then one example, then the exam wording. Which topic or answer line confused you?"
  }
  if (understood.intent === 'off_topic') {
    return 'Quick answer: interesting topic, but it is not the best exam focus right now. Want to switch back to your Cambridge subject?'
  }
  return "I'm with you. What topic should we tackle?"
}
