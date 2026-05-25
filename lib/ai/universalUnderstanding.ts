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
  return `
You are an intent parser for a Cambridge exam 
tutoring app used by Bangladeshi students.

Analyze this message and return JSON only.
Message: "${raw}"
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
  "suggestedResponse": "if off_topic or emotional, suggested brief response, else null"
}

Examples:
"wat is werk dun" → cleanMessage: "what is work done", subject: Physics, isAcademic: true
"bujhini arekbar" → intent: confused, isAcademic: true
"ami fail korbo" → intent: emotional, isAcademic: false, suggestedResponse: "Nervous is normal — what topic first?"
"hi hello" → intent: greeting, isAcademic: false
"asdfgh" → intent: gibberish, isAcademic: false
"black hole explain" → isAcademic: true but off syllabus, shouldRunRAG: false

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
    model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
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

function deriveCategory(intent: ParserIntent, isAcademic: boolean): UnderstandingCategory {
  if (intent === 'greeting') return 'greeting'
  if (intent === 'gibberish') return 'gibberish'
  if (intent === 'emotional') return 'emotional'
  if (intent === 'off_topic') return 'off_topic'
  return isAcademic ? 'academic' : 'off_topic'
}

function normalizeParsed(raw: string, parsed: GeminiUnderstanding): UnderstandingResult {
  const intent = asIntent(parsed.intent)
  const cleanMessage = asNullableString(parsed.cleanMessage) ?? raw.trim()
  const isAcademic = typeof parsed.isAcademic === 'boolean' ? parsed.isAcademic : false
  const shouldRunRAG = typeof parsed.shouldRunRAG === 'boolean' ? parsed.shouldRunRAG : false
  const suggestedResponse = asNullableString(parsed.suggestedResponse)
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
    corrections: cleanMessage !== raw.trim() ? [{ from: raw, to: cleanMessage }] : [],
  }
}

function parserFailureResult(raw: string): UnderstandingResult {
  const trimmed = raw.trim()
  const lower = trimmed.toLowerCase()
  const academicIntent = /\b(explain|define|calculate|solve|find|formula|state|what|why|how)\b/.test(lower)
  const academicTopic =
    /\b(newton|force|motion|work|energy|wave|photosynthesis|cell|atom|bond|equation|integral|differentiat|demand|supply)\b/.test(
      lower
    )
  const keyboardMash = /^[a-z]{4,}$/i.test(trimmed) && !/[aeiou]{2}|(ing|tion|law|work|force)$/i.test(trimmed)
  const shouldTreatAsAcademic = !keyboardMash && (academicIntent || academicTopic)

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
      corrections: [],
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
    corrections: [],
  }
}

export async function understandMessage(raw: string, history: Message[] = []): Promise<UnderstandingResult> {
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
