import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai'
import { resilientGeminiCall } from '@/lib/api/resilientFetch'
import { canAffordRequest, OUTPUT_CONFIG, recordUsage, truncatePrompt } from '@/lib/ai/costManager'
import { detectIntent } from '@/lib/ai/intentEngine'
import { buildSystemPrompt } from '@/lib/ai/personalityEngine'
import { buildSearchQuery } from '@/lib/ai/queryBuilder'
import { filterResponse } from '@/lib/ai/qualityFilter'
import { searchSimilarQuestions, type SearchResult } from '@/lib/rag/ragSystem'

export type SolvedAnswer = {
  answer: string
  confidence: 'VERIFIED' | 'PARTIAL' | 'UNVERIFIED'
  confidenceScore: number
  sources: SearchResult[]
  subject?: string
  topic?: string
  tokens_used: number
  from_cache: boolean
}

export const QBANK_SOLVER_PROMPT = `
You are ScholarHAAB — Cambridge & Edexcel A/O Level
exam expert with 20 years experience. Give direct, concise,
student-friendly answers.

VERIFIED PAST PAPER CONTEXT:
{context}

STUDENT QUESTION:
{question}

ANSWER RULES:
1. NEVER ask for board, level, syllabus, or paper clarification upfront.
2. If the question is short or vague, assume the most likely Cambridge meaning and answer immediately.
3. Use all available context. If Cambridge and Edexcel or levels differ, give the main answer first, then add a short note about differences.
4. If verified context exists, cite the best Cambridge/Edexcel past-paper source.
5. If no verified context exists, answer from exam knowledge and clearly mark ⚠️ UNVERIFIED.
6. Do not invent official mark scheme points. If adapting, say 🔶 PARTIAL.
7. NEVER output raw LaTeX chemistry notation like \\ce{...}. Use plain text/Unicode instead: H₂O, CO₂, IGCSE, ✅ VERIFIED.
8. Avoid raw LaTeX where possible. Use readable plain text such as 1/2, v = fλ, work done = force × distance.

RESPONSE FORMAT:
**Answer:**
[direct answer first, concise and student-friendly]

**Past paper reference:** [Cambridge/Edexcel source if found, otherwise "No exact verified source found"]

**Confidence:** [✅ VERIFIED / 🔶 PARTIAL / ⚠️ UNVERIFIED]

**Mark scheme points:**
- [only verified/adapted points from context, or "No official mark scheme found"]

**Examiner tip:** [one short practical tip]
`

const SUBJECTS = [
  'Physics',
  'Chemistry',
  'Mathematics',
  'Math',
  'Biology',
  'English',
  'Economics',
  'Computer Science',
  'Accounting',
  'Geography',
  'History',
  'Business',
  'Sociology',
  'Psychology',
]

function getGeminiKey() {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
  if (!key || key.startsWith('your_')) {
    throw new Error('Missing GEMINI_API_KEY or GOOGLE_API_KEY')
  }
  return key
}

function normalizeSubject(subject: string | undefined, message: string) {
  if (subject && subject.trim()) {
    return subject === 'Math' ? 'Mathematics' : subject.trim()
  }
  const found = SUBJECTS.find((candidate) => new RegExp(`\\b${candidate}\\b`, 'i').test(message))
  if (!found) return undefined
  return found === 'Math' ? 'Mathematics' : found
}

function inferLevel(message: string) {
  if (/\bo\s*level\b|\bigcse\b/i.test(message)) return 'O Level'
  if (/\ba\s*level\b|\bas\b|\ba2\b/i.test(message)) return 'A Level'
  return undefined
}

function inferBoard(message: string) {
  if (/\bedexcel\b|\bpearson\b/i.test(message)) return 'edexcel'
  if (/\bcambridge\b|\bcaie\b|\bcie\b/i.test(message)) return 'cambridge'
  return undefined
}

function inferYear(message: string) {
  const match = message.match(/\b(20(?:1[4-9]|2[0-6]))\b/)
  return match ? Number(match[1]) : undefined
}

function expandSearchQuery(message: string, subject?: string) {
  const normalized = message.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim()
  const words = normalized.split(' ').filter(Boolean)
  const isShortOrVague = words.length <= 4

  if (/^(what is|define|meaning of)\s+work\b/.test(normalized) || normalized === 'work') {
    return 'work done physics definition formula Cambridge force distance energy'
  }

  if (/\bphotosynthesis\b/.test(normalized) && isShortOrVague) {
    return 'photosynthesis biology process Cambridge A Level O Level IGCSE chlorophyll carbon dioxide water glucose oxygen'
  }

  if (!isShortOrVague) {
    return message
  }

  const subjectHint = subject ? subject.toLowerCase() : ''
  if (subjectHint.includes('physics')) {
    return `${message} physics definition formula Cambridge O Level A Level mark scheme`
  }
  if (subjectHint.includes('biology')) {
    return `${message} biology definition process Cambridge O Level A Level IGCSE mark scheme`
  }
  if (subjectHint.includes('chemistry')) {
    return `${message} chemistry definition equation Cambridge O Level A Level IGCSE mark scheme`
  }
  if (subjectHint.includes('math')) {
    return `${message} mathematics definition method formula Cambridge O Level A Level mark scheme`
  }

  return `${message} Cambridge A Level O Level IGCSE definition formula process mark scheme`
}

function buildContext(results: SearchResult[]) {
  if (results.length === 0) {
    return 'NO VERIFIED CONTEXT FOUND.'
  }

  return results
    .map((result, index) => {
      const source = `${result.board} ${result.level} ${result.subject} ${result.year} ${result.session} ${result.paper} Q${result.question_number}`
      const points = (result.mark_scheme_points ?? []).slice(0, 6).map((point) => `- ${point}`).join('\n')
      return [
        `SOURCE ${index + 1}: ${source}`,
        `Similarity: ${result.similarity.toFixed(3)}`,
        `Question: ${result.question_text}`,
        `Marks: ${result.marks ?? 'unknown'}`,
        `Mark scheme: ${result.mark_scheme || 'NOT_FOUND'}`,
        points ? `Mark scheme points:\n${points}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n\n---\n\n')
}

function buildIntentAwarePrompt(
  message: string,
  results: SearchResult[],
  subject?: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = []
) {
  const intent = detectIntent(message, history)
  const systemPrompt = buildSystemPrompt(
    {
      ...intent,
      subject: intent.subject ?? subject ?? null,
    },
    results.map((result) => ({
      question_text: result.question_text,
      content: result.content ?? undefined,
      similarity: result.similarity,
      source: `${result.board} ${result.level} ${result.subject} ${result.year} ${result.session} ${result.paper} Q${result.question_number}`,
    })),
    history
  )

  return truncatePrompt(
    [
      systemPrompt,
      '',
      'VERIFIED PAST PAPER CONTEXT:',
      buildContext(results),
      '',
      'STUDENT QUESTION:',
      message,
      '',
      'Answer using the detected intent. Be direct, interactive, and Cambridge-focused.',
    ].join('\n')
  )
}

function classifyConfidence(results: SearchResult[]) {
  const best = results[0]
  if (!best) return { label: 'UNVERIFIED' as const, score: 0 }
  if (best.similarity > 0.9) return { label: 'VERIFIED' as const, score: Math.round(best.similarity * 100) }
  if (best.similarity >= 0.75) return { label: 'PARTIAL' as const, score: Math.round(best.similarity * 100) }
  return { label: 'UNVERIFIED' as const, score: Math.round(best.similarity * 100) }
}

function enforceConfidence(answer: string, confidence: SolvedAnswer['confidence'], source: SearchResult | undefined) {
  if (/\*\*Confidence:\*\*/.test(answer)) {
    return answer
  }

  const badge = confidence === 'VERIFIED' ? '✅ VERIFIED' : confidence === 'PARTIAL' ? '🔶 PARTIAL' : '⚠️ UNVERIFIED'
  const citation = source
    ? `${source.board} ${source.level} ${source.subject} ${source.year} ${source.session} ${source.paper} Q${source.question_number}`
    : 'AI Generated — verify independently'
  return `${answer}\n\n**Past paper reference:** ${citation}\n**Confidence:** ${badge}`
}

function toSubscript(value: string) {
  const map: Record<string, string> = {
    '0': '₀',
    '1': '₁',
    '2': '₂',
    '3': '₃',
    '4': '₄',
    '5': '₅',
    '6': '₆',
    '7': '₇',
    '8': '₈',
    '9': '₉',
  }
  return value.replace(/\d/g, (digit) => map[digit] ?? digit)
}

function toSuperscript(value: string) {
  const map: Record<string, string> = {
    '0': '⁰',
    '1': '¹',
    '2': '²',
    '3': '³',
    '4': '⁴',
    '5': '⁵',
    '6': '⁶',
    '7': '⁷',
    '8': '⁸',
    '9': '⁹',
    '+': '⁺',
    '-': '⁻',
  }
  return value.replace(/[0-9+-]/g, (char) => map[char] ?? char)
}

function consumeBraceGroup(source: string, index: number) {
  if (source[index] !== '{') return null
  let depth = 0
  for (let cursor = index; cursor < source.length; cursor += 1) {
    const char = source[cursor]
    if (char === '\\') {
      cursor += 1
      continue
    }
    if (char === '{') depth += 1
    if (char === '}') depth -= 1
    if (depth === 0) {
      return { content: source.slice(index + 1, cursor), end: cursor + 1 }
    }
  }
  return null
}

function plainChemistryText(value: string) {
  return value
    .replace(/\^\{([^}]+)\}/g, (_, charge: string) => toSuperscript(charge))
    .replace(/_(?:\{([^}]+)\}|(\d+))/g, (_, braced: string | undefined, plain: string | undefined) =>
      toSubscript(braced ?? plain ?? '')
    )
    .replace(/(?<=[A-Za-z)])(\d+)/g, (digits) => toSubscript(digits))
    .replace(/<=>/g, '⇌')
    .replace(/->/g, '→')
    .replace(/\s+/g, ' ')
    .trim()
}

function removeRawLatexNotation(answer: string) {
  let output = ''
  let cursor = 0

  while (cursor < answer.length) {
    const start = answer.indexOf('\\ce{', cursor)
    if (start === -1) {
      output += answer.slice(cursor)
      break
    }

    output += answer.slice(cursor, start)
    const group = consumeBraceGroup(answer, start + 3)
    if (!group) {
      output += answer.slice(start, start + 4)
      cursor = start + 4
      continue
    }

    output += plainChemistryText(group.content)
    cursor = group.end
  }

  return output.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '$1/$2')
}

export async function solveQuestion(
  studentId: string,
  userMessage: string,
  subject?: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<SolvedAnswer> {
  void studentId
  const normalizedSubject = normalizeSubject(subject, userMessage)
  const year = inferYear(userMessage)
  const filters = {
    subject: normalizedSubject,
    level: inferLevel(userMessage),
    board: inferBoard(userMessage),
    year_from: year,
    year_to: year,
  }

  const intent = detectIntent(userMessage, history)
  const searchQuery = buildSearchQuery(
    {
      ...intent,
      subject: intent.subject ?? normalizedSubject ?? null,
    },
    history
  ) || expandSearchQuery(userMessage, normalizedSubject)
  const sources = await searchSimilarQuestions(searchQuery, filters, 5)
  const confidence = classifyConfidence(sources)

  const genAI = new GoogleGenerativeAI(getGeminiKey())
  const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-1.5-flash' })
  const prompt = buildIntentAwarePrompt(userMessage, sources, normalizedSubject, history)
  const fallbackAnswer = [
    '**Confidence:** 🔶 PARTIAL (Resilient Fallback)',
    sources[0]
      ? `**Source:** ${sources[0].board} ${sources[0].level} ${sources[0].subject} ${sources[0].year} ${sources[0].session} ${sources[0].paper} Q${sources[0].question_number}`
      : '**Source:** Cached verified context',
    '',
    '**Step-by-Step Solution:**',
    sources[0]?.question_text || 'Live AI is temporarily unavailable. Use the verified mark scheme below and reconnect for a full generated explanation.',
    '',
    '**Official Mark Scheme:**',
    sources[0]?.mark_scheme || 'NOT_FOUND',
  ].join('\n')
  const { result: raw } = await resilientGeminiCall(
    async () => {
      if (!canAffordRequest()) {
        throw new Error('Daily AI cost budget reached')
      }

      const response = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          ...OUTPUT_CONFIG,
          maxOutputTokens: 600,
          temperature: 0.05,
          topK: 20,
        },
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
        ],
      })
      const text = response.response.text().trim()
      recordUsage(Math.ceil(prompt.length / 4), Math.ceil(text.length / 4))
      return text
    },
    fallbackAnswer
  )
  const answer = filterResponse(removeRawLatexNotation(enforceConfidence(raw, confidence.label, sources[0])))

  return {
    answer,
    confidence: confidence.label,
    confidenceScore: confidence.score,
    sources,
    subject: normalizedSubject,
    topic: sources[0]?.topic ?? undefined,
    tokens_used: Math.ceil((prompt.length + answer.length) / 4),
    from_cache: false,
  }
}
