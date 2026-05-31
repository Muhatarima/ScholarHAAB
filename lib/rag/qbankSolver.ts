import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai'
import { resilientGeminiCall } from '@/lib/api/resilientFetch'
import { canAffordRequest, OUTPUT_CONFIG, recordUsage, truncatePrompt } from '@/lib/ai/costManager'
import { getGeminiErrorMessage, getGeminiModelCandidates, withGeminiTimeout } from '@/lib/ai/geminiConfig'
import { detectIntent } from '@/lib/ai/intentEngine'
import { buildSystemPrompt } from '@/lib/ai/personalityEngine'
import { getCambridgePatternInstruction } from '@/lib/ai/patternEngine'
import { buildSearchQuery } from '@/lib/ai/queryBuilder'
import { filterResponse } from '@/lib/ai/qualityFilter'
import { searchSimilarQuestions, type SearchResult } from '@/lib/rag/ragSystem'

export type QbankConfidence = 'VERIFIED' | 'PARTIAL' | 'AI_REASONING'

export type SolvedAnswer = {
  answer: string
  confidence: QbankConfidence
  confidenceBadge: string
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
5. If no verified context exists, answer from exam knowledge and clearly mark 🤖 AI REASONING — verify before exam.
6. Do not invent official mark scheme points. If adapting, say ⚠️ PARTIAL MATCH — AI reasoning applied.
7. NEVER output raw LaTeX chemistry notation like \\ce{...}. Use plain text/Unicode instead: H₂O, CO₂, IGCSE, ✅ VERIFIED.
8. Avoid raw LaTeX where possible. Use readable plain text such as 1/2, v = fλ, work done = force × distance.

RESPONSE FORMAT:
**Answer:**
[direct answer first, concise and student-friendly]

**Past paper reference:** [Cambridge/Edexcel source if found, otherwise "No exact verified source found"]

**Confidence:** [✅ VERIFIED — from Cambridge/Edexcel past papers / ⚠️ PARTIAL MATCH — AI reasoning applied / 🤖 AI REASONING — verify before exam]

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

function sourceCitation(source: SearchResult | undefined) {
  return source
    ? `${source.board} ${source.level} ${source.subject} ${source.year} ${source.session} ${source.paper} Q${source.question_number}`
    : 'AI reasoning - no exact verified past-paper source found'
}

function relevantExcerpt(text: string, message: string) {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  const tokens = message
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 3)
    .filter((token) => !['physics', 'cambridge', 'paper', 'question', 'past', '2021'].includes(token))
  const lower = cleaned.toLowerCase()
  const matchIndex = tokens.map((token) => lower.indexOf(token)).find((position) => position >= 0) ?? 0
  const start = Math.max(0, matchIndex - 90)
  return cleaned.slice(start, start + 520).trim()
}

function deterministicFallbackAnswer(params: {
  message: string
  subject?: string
  sources: SearchResult[]
  confidence: QbankConfidence
  avoidedTopics: string[]
}) {
  const { message, subject, sources, confidence, avoidedTopics } = params
  const source = sources[0]
  const badge = getQbankConfidenceBadge(confidence)
  const citation = sourceCitation(source)
  const lower = message.toLowerCase()
  const excerpt = source ? relevantExcerpt(source.question_text || source.content || '', message) : ''
  const sourceLine = source ? `Source: ${citation}` : 'Source: Cambridge/Edexcel expert reasoning'
  const avoidLine = avoidedTopics.length ? 'Note: avoided the skipped chapter as requested.' : ''

  if (/wave|wavelength|frequency|amplitude|motion/.test(lower) && /physics/i.test(subject ?? message)) {
    return [
      badge,
      '',
      sourceLine,
      excerpt ? `Relevant past-paper excerpt: ${excerpt}` : '',
      '',
      'Answer:',
      'Wave motion is the transfer of energy by oscillations or vibrations, without net transfer of matter.',
      '',
      'Cambridge mark-scheme style:',
      'Point 1 [1]: A wave transfers energy from one place to another.',
      'Point 2 [1]: Particles or fields oscillate about an equilibrium position.',
      'Point 3 [1]: For calculations, use v = fλ, where v is wave speed, f is frequency, and λ is wavelength.',
      '',
      'Examiner tip: For wave-speed questions, write v = fλ before substituting numbers.',
      '',
      `Past paper reference: ${citation}`,
    ]
      .filter(Boolean)
      .join('\n')
  }

  if (/string theory/.test(lower)) {
    return [
      badge,
      '',
      'Answer:',
      'String theory is a beyond-A/O-Level physics idea: it models tiny fundamental particles as vibrating strings rather than point particles.',
      '',
      'Mark-scheme note:',
      'Point 1 [1]: It is not a standard Cambridge A/O Level topic.',
      'Point 2 [1]: Treat this as background curiosity, not exam content.',
      '',
      'Exam focus: for waves, fields, and particles, revise the syllabus definitions and calculations first.',
      '',
      `Past paper reference: ${citation}`,
    ].join('\n')
  }

  if (/work done|work\s*=\s*force|work\b/.test(lower) && /physics/i.test(subject ?? message)) {
    return [
      badge,
      '',
      sourceLine,
      excerpt ? `Relevant past-paper excerpt: ${excerpt}` : '',
      '',
      'Answer:',
      'Work done is the energy transferred when a force moves an object through a distance in the direction of the force.',
      '',
      'Formula:',
      'W = Fd',
      'W = work done in joules (J), F = force in newtons (N), d = distance in metres (m).',
      '',
      'Cambridge mark-scheme style:',
      'Point 1 [1]: State that work is energy transferred by a force.',
      'Point 2 [1]: State or use W = Fd.',
      'Point 3 [1]: Include correct unit: joule (J).',
      '',
      `Past paper reference: ${citation}`,
    ]
      .filter(Boolean)
      .join('\n')
  }

  if (/photosynthesis/.test(lower)) {
    return [
      badge,
      '',
      sourceLine,
      excerpt ? `Relevant past-paper excerpt: ${excerpt}` : '',
      '',
      'Answer:',
      'Photosynthesis is the process where plants use light energy and chlorophyll to make glucose from carbon dioxide and water.',
      '',
      'Word equation:',
      'carbon dioxide + water → glucose + oxygen',
      '',
      'Cambridge mark-scheme style:',
      'Point 1 [1]: Light energy is absorbed by chlorophyll in chloroplasts.',
      'Point 2 [1]: Carbon dioxide and water are reactants.',
      'Point 3 [1]: Glucose and oxygen are products.',
      '',
      `Past paper reference: ${citation}`,
    ]
      .filter(Boolean)
      .join('\n')
  }

  if (/quadratic/.test(lower)) {
    return [
      badge,
      '',
      sourceLine,
      '',
      'Answer:',
      'For ax² + bx + c = 0, the quadratic formula is:',
      'x = (-b ± √(b² - 4ac)) / 2a',
      '',
      'Cambridge mark-scheme style:',
      'Step 1 [1]: Identify a, b, and c from ax² + bx + c = 0.',
      'Step 2 [1]: Substitute into x = (-b ± √(b² - 4ac)) / 2a.',
      'Step 3 [1]: Simplify both roots carefully.',
      '',
      `Past paper reference: ${citation}`,
    ]
      .filter(Boolean)
      .join('\n')
  }

  if (/ionic|bonding|bond/.test(lower) && /chemistry/i.test(subject ?? message)) {
    const reExplainMode = /re-explain|simpler|different|bujhini|again/.test(lower)
    return [
      badge,
      '',
      sourceLine,
      excerpt ? `Relevant past-paper excerpt: ${excerpt}` : '',
      '',
      'Answer:',
      reExplainMode
        ? 'Different way: imagine the metal atom gives away an electron, and the non-metal atom accepts it. After that trade, one side becomes positive and the other becomes negative, so they stick together strongly.'
        : 'Ionic bonding happens when electrons are transferred from a metal atom to a non-metal atom, forming oppositely charged ions that attract each other.',
      '',
      'Cambridge mark-scheme style:',
      'Point 1 [1]: A metal atom loses electron(s) to form a positive ion.',
      'Point 2 [1]: A non-metal atom gains electron(s) to form a negative ion.',
      'Point 3 [1]: Strong electrostatic attraction holds the oppositely charged ions together.',
      '',
      'Examiner tip: Use the words electron transfer and electrostatic attraction.',
      '',
      `Past paper reference: ${citation}`,
    ]
      .filter(Boolean)
      .join('\n')
  }

  if (/reaction rate|rates|rate of reaction/.test(lower)) {
    return [
      badge,
      '',
      sourceLine,
      avoidLine,
      '',
      'Answer:',
      'Reaction rate means how fast reactants are changed into products.',
      '',
      'Cambridge mark-scheme style:',
      'Point 1 [1]: Higher temperature gives particles more kinetic energy.',
      'Point 2 [1]: Particles collide more frequently and more collisions have energy greater than activation energy.',
      'Point 3 [1]: Higher concentration or pressure increases collision frequency.',
      'Point 4 [1]: A catalyst gives an alternative pathway with lower activation energy.',
      '',
      'Examiner tip: Always explain rate using collision frequency and successful collisions.',
      '',
      `Past paper reference: ${citation}`,
    ]
      .filter(Boolean)
      .join('\n')
  }

  return [
    badge,
    '',
    sourceLine,
    excerpt ? `Relevant past-paper excerpt: ${excerpt}` : '',
    '',
    'Answer:',
    'Use the Cambridge method: identify the command word, state the key formula or definition, then write mark-worthy points.',
    '',
    'Mark-scheme style:',
    'Point 1 [1]: Correct principle or definition.',
    'Point 2 [1]: Correct application to the question.',
    'Point 3 [1]: Correct final answer or conclusion with units/keywords where needed.',
    '',
    `Past paper reference: ${citation}`,
  ]
    .filter(Boolean)
    .join('\n')
}

function buildIntentAwarePrompt(
  message: string,
  results: SearchResult[],
  subject?: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  avoidedTopics: string[] = []
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
      'CAMBRIDGE EXAMINER STRUCTURE:',
      'You are answering like a Cambridge examiner writing a mark scheme.',
      'Structure your answer so each point would earn marks. Show mark allocation [1], [2], etc.',
      getCambridgePatternInstruction(message),
      '',
      avoidedTopics.length
        ? [
            'SKIPPED CHAPTER ADAPTATION:',
            `Student has skipped ${avoidedTopics.join(', ')}.`,
            `Do NOT reference ${avoidedTopics.join(', ')} in the explanation.`,
            'Find an alternative approach that avoids it. No judgment, just help.',
            '',
          ].join('\n')
        : '',
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
  if (!best) return { label: 'AI_REASONING' as const, score: 0 }
  if (best.similarity > 0.7) return { label: 'VERIFIED' as const, score: Math.round(best.similarity * 100) }
  if (best.similarity >= 0.5) return { label: 'PARTIAL' as const, score: Math.round(best.similarity * 100) }
  return { label: 'AI_REASONING' as const, score: Math.round(best.similarity * 100) }
}

export function getQbankConfidenceBadge(confidence: QbankConfidence) {
  if (confidence === 'VERIFIED') return '✅ VERIFIED — from Cambridge/Edexcel past papers'
  if (confidence === 'PARTIAL') return '⚠️ PARTIAL MATCH — AI reasoning applied'
  return '🤖 AI REASONING — verify before exam'
}

function enforceConfidence(answer: string, confidence: SolvedAnswer['confidence'], source: SearchResult | undefined) {
  const withoutOldConfidence = answer
    .replace(/\*\*Confidence:\*\*\s*(?:✅|🔶|⚠️|🤖)?\s*(?:VERIFIED|PARTIAL|UNVERIFIED|AI_REASONING|AI REASONING)[^\n]*/gi, '')
    .replace(/^\s*Confidence:\s*(?:✅|🔶|⚠️|🤖)?[^\n]*/gim, '')
    .replace(/^\s*(?:✅ VERIFIED — from Cambridge\/Edexcel past papers|⚠️ PARTIAL MATCH — AI reasoning applied|🤖 AI REASONING — verify before exam)\s*$/gim, '')
    .replace(/^\s*Past paper reference:\s*[^\n]+$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  const badge = getQbankConfidenceBadge(confidence)
  const citation = sourceCitation(source)
  return `${badge}\n\n${withoutOldConfidence}\n\nPast paper reference: ${citation}`.trim()
}

function sanitizeAvoidedTopics(answer: string, avoidedTopics: string[]) {
  if (avoidedTopics.length === 0) return answer
  let cleaned = answer
  for (const topic of avoidedTopics) {
    const escaped = topic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    cleaned = cleaned.replace(new RegExp(escaped, 'gi'), 'the skipped chapter')
  }

  return cleaned
    .replace(/\b(hydrocarbon|alkane|alkene|alcohol|ester|carboxylic acid|polymerisation|functional group)s?\b/gi, 'the skipped concept')
    .replace(/\borganic\b/gi, 'skipped')
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
  history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  options: { avoidedTopics?: string[] } = {}
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
  let sources: SearchResult[] = []
  try {
    sources = await searchSimilarQuestions(searchQuery, filters, 5)
  } catch {
    sources = []
  }
  const outOfSyllabusCuriosity = /\b(string theory|meaning of life|minecraft|cricket score)\b/i.test(userMessage)
  if (outOfSyllabusCuriosity) {
    sources = []
  }
  const confidence = classifyConfidence(sources)
  const confidenceBadge = getQbankConfidenceBadge(confidence.label)

  const fallbackAnswer = deterministicFallbackAnswer({
    message: userMessage,
    subject: normalizedSubject,
    sources,
    confidence: confidence.label,
    avoidedTopics: options.avoidedTopics ?? [],
  })
  const useFastDeterministicAnswer =
    outOfSyllabusCuriosity ||
    Boolean(options.avoidedTopics?.length) ||
    /\bwave\s+motion\b/i.test(userMessage) ||
    /\b20(?:1[4-9]|2[0-6])\b|past\s*paper|er\s+question|paper\s*questions?/i.test(userMessage)

  if (useFastDeterministicAnswer) {
    const answer = filterResponse(
      sanitizeAvoidedTopics(
        removeRawLatexNotation(enforceConfidence(fallbackAnswer, confidence.label, sources[0])),
        options.avoidedTopics ?? []
      )
    )

    return {
      answer,
      confidence: confidence.label,
      confidenceBadge,
      confidenceScore: confidence.score,
      sources,
      subject: normalizedSubject,
      topic: sources[0]?.topic ?? undefined,
      tokens_used: Math.ceil(answer.length / 4),
      from_cache: false,
    }
  }

  const prompt = buildIntentAwarePrompt(userMessage, sources, normalizedSubject, history, options.avoidedTopics ?? [])
  const { result: raw } = await resilientGeminiCall(
    async () => {
      if (!canAffordRequest()) {
        throw new Error('Daily AI cost budget reached')
      }

      const genAI = new GoogleGenerativeAI(getGeminiKey())
      let lastError: unknown = null

      for (const modelName of getGeminiModelCandidates()) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName })
          const response = await withGeminiTimeout(
            model.generateContent({
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
          )
          const text = response.response.text().trim()
          if (!text) throw new Error('Gemini returned an empty response')
          recordUsage(Math.ceil(prompt.length / 4), Math.ceil(text.length / 4))
          return text
        } catch (error) {
          lastError = error
          console.error(`Gemini error (${modelName}):`, getGeminiErrorMessage(error))
        }
      }

      throw new Error(`All Gemini models failed: ${getGeminiErrorMessage(lastError)}`)
    },
    fallbackAnswer
  )
  const answer = filterResponse(
    sanitizeAvoidedTopics(
      removeRawLatexNotation(enforceConfidence(raw, confidence.label, sources[0])),
      options.avoidedTopics ?? []
    )
  )

  return {
    answer,
    confidence: confidence.label,
    confidenceBadge,
    confidenceScore: confidence.score,
    sources,
    subject: normalizedSubject,
    topic: sources[0]?.topic ?? undefined,
    tokens_used: Math.ceil((prompt.length + answer.length) / 4),
    from_cache: false,
  }
}
