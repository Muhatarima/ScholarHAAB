import { GoogleGenerativeAI } from '@google/generative-ai'
import { requireAuth } from '@/lib/auth/requireAuth'
import { searchSimilarQuestions, type SearchResult } from '@/lib/rag/ragSystem'
import { checkRateLimit } from '@/lib/rateLimit/rateLimiter'
import {
  trackConfident,
  trackExampleRequest,
  trackFormulaRequest,
  trackSession,
  trackSkip,
  trackWeak,
} from '@/lib/analytics/topicTracker'
import { detectIntent } from '@/lib/ai/intentEngine'
import { buildSearchQuery } from '@/lib/ai/queryBuilder'
import { buildSystemPrompt } from '@/lib/ai/personalityEngine'
import { getMemoryContext, memoryToPrompt, updateMemory } from '@/lib/ai/sessionMemory'
import { filterResponse } from '@/lib/ai/qualityFilter'
import {
  formatUnderstandingResponse,
  understandMessage,
  type Message as UnderstandingMessage,
} from '@/lib/ai/universalUnderstanding'

type ExamPrepMode = 'start' | 'chat'

type HistoryEntry = {
  role: 'user' | 'assistant'
  content: string
}

type ExamPrepBody = {
  subject?: unknown
  topic?: unknown
  level?: unknown
  message?: unknown
  history?: unknown
  mode?: unknown
  sessionId?: unknown
}

type AnalyzedPrepData = {
  chunks: SearchResult[]
  rankedSubtopics: Array<{ name: string; count: number }>
  formulas: string[]
  patterns: Array<{ name: string; count: number }>
  context: string
}

const SYSTEM_PROMPT = `
You are a Cambridge exam coach.
Student has exam tomorrow. Be warm and focused.

Start EVERY session with:
"Ok, [topic] for [subject].
Here's what matters most for tomorrow:

🔴 HIGH PRIORITY (came up X times):
1. [most frequent topic]
2. [second most frequent]

🟡 MEDIUM PRIORITY:
3. [topic]
4. [topic]

🟢 KNOW IF YOU CAN:
5. [topic]

Want to start with #1? Or jump to a specific one?"

When student says:
- "skip" / "next" / "pore" -> next topic, no debate
- "bujhini" / "again" / "different way":
  -> Try analogy from daily life first
  -> Then ASCII diagram if helpful
  -> Then numerical example
  -> Never repeat same explanation
- "formula" -> formulas only, clean format
- "example" -> past paper question immediately
- "summary" -> 5 bullet summary of all covered
- "test me" -> give exam question, wait for answer
- Student gives answer -> check it, mark scheme style

Never ask for clarification. Just start helping immediately.
Keep responses concise. Student has one night, not one week.
Never use LaTeX notation. Use plain text formulas such as F = ma, H2O, a/b.
`

const FALLBACK_FORMULAS: Record<string, string[]> = {
  Physics: ['F = ma', 'W = mg', 'moment = force x perpendicular distance', 'p = mv', 'pressure = force / area'],
  Chemistry: ['moles = mass / Mr', 'concentration = moles / volume', 'pH = -log[H+]', 'PV = nRT'],
  Biology: ['magnification = image size / actual size', 'rate = change / time'],
  Mathematics: ['gradient = change in y / change in x', 'area under graph = integral', 'quadratic formula'],
}

const SUBTOPIC_KEYWORDS: Record<string, string[]> = {
  'resultant force': ['resultant force', 'balanced force', 'unbalanced force', 'net force'],
  'newtons laws': ['newton', 'inertia', 'action and reaction'],
  'f equals ma': ['f = ma', 'force = mass', 'acceleration', 'accelerates'],
  weight: ['weight', 'gravitational field strength', 'w = mg'],
  friction: ['friction', 'drag', 'air resistance', 'terminal velocity'],
  moments: ['moment', 'pivot', 'turning effect', 'clockwise', 'anticlockwise'],
  momentum: ['momentum', 'impulse', 'collision', 'conservation of momentum'],
  pressure: ['pressure', 'area', 'force per unit area'],
}

const PATTERN_KEYWORDS: Record<string, string[]> = {
  'calculation questions': ['calculate', 'find', 'determine', 'work out'],
  'explain why questions': ['explain', 'why', 'give a reason', 'account for'],
  'definition questions': ['define', 'state what is meant', 'what is meant'],
  'graph or diagram questions': ['sketch', 'draw', 'graph', 'diagram', 'label'],
  'comparison questions': ['compare', 'difference between', 'contrast'],
}

const FORCES_FALLBACK_SUBTOPICS = [
  { name: 'resultant force', count: 9 },
  { name: 'f equals ma', count: 8 },
  { name: 'weight', count: 7 },
  { name: 'friction', count: 6 },
  { name: 'moments', count: 6 },
  { name: 'momentum', count: 5 },
  { name: 'pressure', count: 4 },
]

const DEFAULT_FALLBACK_PATTERNS = [
  { name: 'calculation questions', count: 8 },
  { name: 'explain why questions', count: 6 },
  { name: 'definition questions', count: 4 },
]

function asString(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function asMode(value: unknown): ExamPrepMode {
  return value === 'chat' ? 'chat' : 'start'
}

function asHistory(value: unknown): HistoryEntry[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => {
      const candidate = entry as { role?: unknown; content?: unknown }
      const role: HistoryEntry['role'] = candidate.role === 'assistant' ? 'assistant' : 'user'
      const content = typeof candidate.content === 'string' ? candidate.content : ''
      return { role, content }
    })
    .filter((entry) => entry.content.trim())
    .slice(-12)
}

function asOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ')
}

function extractFormulaCandidates(text: string) {
  const candidates = new Set<string>()
  const patterns = [
    /\b[Ff]\s*=\s*m\s*a\b/g,
    /\b[Ww]\s*=\s*m\s*g\b/g,
    /\bp\s*=\s*m\s*v\b/g,
    /\b[Pp]\s*=\s*[Ff]\s*\/\s*[Aa]\b/g,
    /\b[Vv]\s*=\s*[Ii]\s*[Rr]\b/g,
    /\b[Pp]\s*=\s*[Ii]\s*[Vv]\b/g,
    /\bn\s*=\s*m\s*\/\s*Mr\b/gi,
    /\bPV\s*=\s*nRT\b/gi,
  ]

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      candidates.add(match[0].replace(/\s+/g, ' '))
    }
  }

  return candidates
}

function scoreKeywords(chunks: SearchResult[], groups: Record<string, string[]>) {
  const scores = new Map<string, number>()
  for (const chunk of chunks) {
    const text = normalizeText(chunk.question_text || chunk.content || '')
    for (const [name, keywords] of Object.entries(groups)) {
      const count = keywords.reduce((total, keyword) => total + (text.includes(keyword) ? 1 : 0), 0)
      if (count > 0) scores.set(name, (scores.get(name) ?? 0) + count)
    }
  }

  return Array.from(scores.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 7)
}

function buildContext(chunks: SearchResult[]) {
  return chunks
    .slice(0, 8)
    .map((chunk, index) => {
      const source = [chunk.board, chunk.level, chunk.subject, chunk.year || null, chunk.resource_type || null]
        .filter(Boolean)
        .join(' ')
      return `[Past paper ${index + 1} | ${source || 'Supabase question bank'} | similarity ${Math.round(chunk.similarity * 100)}%]\n${chunk.question_text.slice(0, 900)}`
    })
    .join('\n\n')
}

async function analyzePastPapers(subject: string, topic: string, level: string, searchQuery?: string): Promise<AnalyzedPrepData> {
  const query = searchQuery || `${subject} ${topic} Cambridge ${level} past paper formulas common question patterns`
  let chunks: SearchResult[] = []

  try {
    chunks = await searchSimilarQuestions(query, { subject, level }, 18)
  } catch {
    chunks = []
  }

  const text = chunks.map((chunk) => chunk.question_text || chunk.content || '').join('\n')
  const rankedSubtopics = scoreKeywords(chunks, SUBTOPIC_KEYWORDS)
  const patterns = scoreKeywords(chunks, PATTERN_KEYWORDS)
  const formulaSet = extractFormulaCandidates(text)
  const forcesTopic = /force|motion/i.test(topic) && /physics/i.test(subject)

  for (const formula of FALLBACK_FORMULAS[subject] ?? []) {
    if (forcesTopic || formulaSet.size < 4) {
      formulaSet.add(formula)
    }
  }

  return {
    chunks,
    rankedSubtopics: rankedSubtopics.length
      ? rankedSubtopics
      : forcesTopic
        ? FORCES_FALLBACK_SUBTOPICS
        : [{ name: topic, count: chunks.length || 1 }],
    formulas: Array.from(formulaSet).slice(0, 10),
    patterns: patterns.length ? patterns : DEFAULT_FALLBACK_PATTERNS,
    context: buildContext(chunks),
  }
}

function buildPrompt(params: {
  subject: string
  topic: string
  level: string
  message: string
  mode: ExamPrepMode
  history: HistoryEntry[]
  analysis: AnalyzedPrepData
  intentPrompt?: string
  memoryContext?: string
}) {
  const { subject, topic, level, message, mode, history, analysis, intentPrompt, memoryContext } = params
  const historyText = history.map((entry) => `${entry.role}: ${entry.content}`).join('\n').slice(-5000)
  const subtopics = analysis.rankedSubtopics.map((item, index) => `${index + 1}. ${item.name} (${item.count} signals)`).join('\n')
  const formulas = analysis.formulas.map((formula) => `- ${formula}`).join('\n')
  const patterns = analysis.patterns.map((item) => `- ${item.name}: ${item.count} signals`).join('\n')

  return `
${SYSTEM_PROMPT}

SMART TUTOR PROMPT:
${intentPrompt || 'Use warm Cambridge exam coaching.'}

STUDENT TARGET:
Subject: ${subject}
Topic: ${topic}
Level: ${level}
Mode: ${mode}
Message: ${message}

PAST PAPER ANALYSIS:
Most frequent subtopics:
${subtopics}

Key formulas:
${formulas || '- No exact formula found. Use standard Cambridge formulas for this topic.'}

Common question patterns:
${patterns}

REAL RETRIEVED PAST PAPER CONTEXT:
${analysis.context || 'No exact chunk available. Use Cambridge examiner reasoning and say "Cambridge expert reasoning".'}

CONVERSATION SO FAR:
${historyText || 'No previous exam-prep messages.'}

SESSION MEMORY:
${memoryContext || 'No session memory yet.'}

RESPONSE REQUIREMENTS:
- If mode is start, build a structured night-before prep plan.
- If message is skip/next, move to the next ranked subtopic immediately.
- If message is bujhini/don't understand, explain the current subtopic differently with analogy and a tiny example.
- If message is example/question dao, give a past-paper-style question from the retrieved context if possible, plus mark scheme.
- If message is formula, show formulas only.
- If message is summary, give exactly 3 bullets.
- No LaTeX chemistry \\ce{} syntax. Use plain text like H2O, NaCl, F = ma.
- End with exactly: "Got it? Or want me to explain differently?"
`.trim()
}

function fallbackStreamText(subject: string, topic: string, analysis: AnalyzedPrepData) {
  const subtopics = analysis.rankedSubtopics.map((item, index) => `${index + 1}. ${item.name}`).join('\n')
  const formulas = analysis.formulas.map((formula) => `- ${formula}`).join('\n')
  return [
    `**Night Before ${subject}: ${topic}**`,
    '',
    '**Most important topics:**',
    subtopics,
    '',
    '**Formula sheet:**',
    formulas || '- Use the main formulas from this topic and write them before substitution.',
    '',
    '**Quick plan:**',
    '1. Revise the top 3 subtopics first.',
    '2. Do one calculation and one explain question for each.',
    '3. Memorise mark-scheme keywords, not long textbook paragraphs.',
    '',
    'Got it? Or want me to explain differently?',
  ].join('\n')
}

async function trackExamPrepIntent(params: {
  userId: string
  subject: string
  topic: string
  level: string
  message: string
  mode: ExamPrepMode
  sessionId: string | null
}) {
  const { userId, subject, topic, level, message, mode } = params
  let sessionId = params.sessionId

  if (mode === 'start') {
    sessionId = await trackSession(userId, subject, topic, level)
  }

  const normalized = normalizeText(message)
  if (/\b(skip|next|pore|porer|bad dao)\b/.test(normalized)) {
    await trackSkip(userId, subject, topic, sessionId)
  } else if (/(bujhini|bujhi nai|don't understand|dont understand|again|arekbar|confused)/i.test(normalized)) {
    await trackWeak(userId, subject, topic, sessionId)
  } else if (/(bujhechi|got it|understood|ok next|okay next)/i.test(normalized)) {
    await trackConfident(userId, subject, topic, sessionId)
  } else if (/(example|question dao|proshno)/i.test(normalized)) {
    await trackExampleRequest(userId, subject, topic, sessionId)
  } else if (/\bformula|formulas|sutro\b/i.test(normalized)) {
    await trackFormulaRequest(userId, subject, topic, sessionId)
  }

  return sessionId
}

function textStream(text: string) {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const words = text.split(/(\s+)/)
      for (const word of words) {
        controller.enqueue(encoder.encode(word))
      }
      controller.close()
    },
  })
}

async function geminiStream(prompt: string, fallback: string) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return textStream(fallback)
  }

  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey)
        const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-1.5-flash' })
        const result = await model.generateContentStream({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 800,
            temperature: 0.08,
            topP: 0.85,
            topK: 20,
          },
        })

        for await (const chunk of result.stream) {
          const text = filterResponse(chunk.text())
          if (text) controller.enqueue(encoder.encode(text))
        }
      } catch {
        controller.enqueue(encoder.encode(fallback))
      } finally {
        controller.close()
      }
    },
  })
}

export async function POST(req: Request) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError

  const demoMode =
    process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ||
    process.env.DEMO_MODE === 'true' ||
    process.env.NODE_ENV === 'development'

  if (!demoMode) {
    const rate = checkRateLimit({
      maxRequests: 80,
      windowMs: 60 * 60 * 1000,
      identifier: `exam_prep_${user?.id ?? 'anonymous'}`,
    })

    if (!rate.allowed) {
      return Response.json({ error: 'Rate limit reached. Try again soon.' }, { status: 429 })
    }
  }

  const body = (await req.json()) as ExamPrepBody
  const subject = asString(body.subject, 'Physics')
  const topic = asString(body.topic, 'Forces and Motion')
  const level = asString(body.level, 'O Level')
  const mode = asMode(body.mode)
  const rawMessage = asString(body.message, mode === 'start' ? `Start ${topic}` : 'summary')
  const history = asHistory(body.history)
  const understood = await understandMessage(rawMessage, history as UnderstandingMessage[])
  const message = understood.cleanMessage

  if (!understood.shouldRunRag || (understood.intent === 'confused' && mode !== 'start')) {
    return new Response(textStream(formatUnderstandingResponse(understood)), {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store, no-transform',
        'X-Accel-Buffering': 'no',
      },
    })
  }

  const sessionKey = asOptionalString(body.sessionId) ?? `${user?.id ?? 'demo'}:${subject}:${topic}`
  const intent = detectIntent(message, history)
  const searchQuery = buildSearchQuery(
    {
      ...intent,
      subject: intent.subject ?? subject,
      topic: intent.topic ?? topic,
    },
    history
  )
  const memory = getMemoryContext(sessionKey)
  const sessionId = await trackExamPrepIntent({
    userId: user?.id ?? 'test-anonymous-user',
    subject,
    topic,
    level,
    message,
    mode,
    sessionId: asOptionalString(body.sessionId),
  })

  const analysis = await analyzePastPapers(subject, topic, level, searchQuery)
  const intentPrompt = buildSystemPrompt(
    intent,
    analysis.chunks.map((chunk) => ({
      question_text: chunk.question_text,
      content: chunk.content ?? undefined,
      similarity: chunk.similarity,
      source: [chunk.board, chunk.level, chunk.subject, chunk.year].filter(Boolean).join(' '),
    })),
    history,
    { memory }
  )
  const prompt = buildPrompt({
    subject,
    topic,
    level,
    message,
    mode,
    history,
    analysis,
    intentPrompt,
    memoryContext: memoryToPrompt(memory),
  })
  const fallback = fallbackStreamText(subject, topic, analysis)
  updateMemory(sessionKey, intent, fallback)
  const stream = await geminiStream(prompt, fallback)

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
      'x-exam-prep-session-id': sessionId ?? '',
    },
  })
}
