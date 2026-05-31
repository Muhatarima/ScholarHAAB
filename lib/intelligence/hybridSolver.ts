import {
  buildIntelligentPrompt,
  type ChunkResult,
  type IntelligentSearchResult,
} from '@/lib/intelligence/promptBuilder'
import { getGeminiErrorMessage, getGeminiModelCandidates, withGeminiTimeout } from '@/lib/ai/geminiConfig'

export interface HybridAnswer {
  answer: string
  confidence: 'VERIFIED' | 'PATTERN_BASED' | 'UNVERIFIED'
  confidenceBadge: '✅' | '🔶' | '⚠️'
  sources: string[]
  markScheme: string[]
  examinerTip: string
  solvingPattern: string
  usedPatternReasoning: boolean
  questionType?: string
  similarityScore?: number
}

const CHROMA_URL = process.env.CHROMA_SERVER_URL || process.env.NEXT_PUBLIC_CHROMA_SERVER_URL
const GEMINI_TIMEOUT_MS = 25_000

function isChunkResult(value: unknown): value is ChunkResult {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ChunkResult>
  return typeof candidate.text === 'string' && typeof candidate.similarity === 'number'
}

function normalizeSearchResult(value: unknown): IntelligentSearchResult {
  const input = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const chunksRaw = Array.isArray(input.chunks) ? input.chunks : []
  const chunks = chunksRaw.filter(isChunkResult)
  const analysis =
    input.analysis && typeof input.analysis === 'object'
      ? (input.analysis as IntelligentSearchResult['analysis'])
      : {}
  const maxSimilarity =
    typeof input.max_similarity === 'number'
      ? input.max_similarity
      : Math.max(...chunks.map((chunk) => chunk.similarity), 0)
  const totalInDb = typeof input.total_in_db === 'number' ? input.total_in_db : 0

  return {
    chunks,
    analysis,
    max_similarity: maxSimilarity,
    total_in_db: totalInDb,
  }
}

async function intelligentSearch(
  question: string,
  subject: string,
  level: string
): Promise<IntelligentSearchResult> {
  if (!CHROMA_URL) {
    return {
      chunks: [],
      analysis: {},
      max_similarity: 0,
      total_in_db: 0,
    }
  }

  const searchRes = await fetch(`${CHROMA_URL}/intelligent_search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: question,
      subject,
      level,
      n_results: 7,
      include_analysis: true,
    }),
  })

  if (!searchRes.ok) {
    const detail = await searchRes.text().catch(() => '')
    throw new Error(`Intelligence search failed: ${detail || searchRes.statusText}`)
  }

  return normalizeSearchResult(await searchRes.json())
}

function fallbackPatternAnswer(
  question: string,
  searchResult: IntelligentSearchResult,
  subject: string
): string {
  const analysis = searchResult.analysis
  const formula = analysis.relevant_formulas?.[0]?.formula
  const guide = analysis.solving_guide || 'Use the command word, state the principle, apply it, and conclude.'
  const solved = solveKnownCalculation(question, formula)

  if (solved) {
    return solved
  }

  return [
    '**Confidence:** 🔶 PATTERN-BASED',
    '**Source:** Pattern reasoning',
    '',
    '**Solution:**',
    `This is a ${analysis.classification?.question_type?.replace(/_/g, ' ') || 'general'} ${subject} question.`,
    formula ? `Use: ${formula}` : 'Use the relevant definition, principle, or equation from the question context.',
    'Apply the Cambridge solving sequence below and write the final answer with units where needed.',
    '',
    '**Mark Scheme:**',
    ...guide
      .split('\n')
      .filter((line) => /^\s*\d+\.|^\s*-|^\s*->/.test(line))
      .slice(0, 4)
      .map((line) => `- ${line.replace(/^\s*/, '')}`),
    '',
    `**Examiner Tip:** Start with the formula or principle before applying it to "${question}".`,
  ].join('\n')
}

function extractNumberAfter(text: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) return Number(match[1])
  }
  return null
}

function solveKnownCalculation(question: string, formula?: string): string | null {
  const text = question.toLowerCase()

  if (formula === 'v=fλ' || /\bwave\b/.test(text)) {
    const frequency = extractNumberAfter(text, [
      /frequency\s*(?:=|is)?\s*(\d+(?:\.\d+)?)/i,
      /\bf\s*=\s*(\d+(?:\.\d+)?)/i,
      /(\d+(?:\.\d+)?)\s*hz/i,
    ])
    const wavelength = extractNumberAfter(text, [
      /wavelength\s*(?:=|is)?\s*(\d+(?:\.\d+)?)/i,
      /(?:λ|lambda)\s*=\s*(\d+(?:\.\d+)?)/i,
      /(\d+(?:\.\d+)?)\s*m\b/i,
    ])

    if (frequency !== null && wavelength !== null) {
      const speed = frequency * wavelength
      return [
        '**Confidence:** 🔶 PATTERN-BASED',
        '**Source:** Pattern reasoning using Cambridge wave-speed method',
        '',
        '**Solution:**',
        'Formula: v = fλ',
        `Substitute: v = ${frequency} × ${wavelength}`,
        `Calculate: v = ${Number(speed.toFixed(4))} m/s`,
        '',
        '**Mark Scheme:**',
        '- States v = fλ',
        `- Substitutes ${frequency} × ${wavelength}`,
        `- Gives ${Number(speed.toFixed(4))} m/s with correct unit`,
        '',
        '**Examiner Tip:** Always write the formula before substituting values.',
      ].join('\n')
    }
  }

  if (formula === 'F=ma') {
    const mass = extractNumberAfter(text, [/mass\s*(?:=|is)?\s*(\d+(?:\.\d+)?)/i, /(\d+(?:\.\d+)?)\s*kg/i])
    const acceleration = extractNumberAfter(text, [
      /acceleration\s*(?:=|is)?\s*(\d+(?:\.\d+)?)/i,
      /(\d+(?:\.\d+)?)\s*m\s*s-?2/i,
    ])
    if (mass !== null && acceleration !== null) {
      const force = mass * acceleration
      return [
        '**Confidence:** 🔶 PATTERN-BASED',
        '**Source:** Pattern reasoning using Newton’s second law',
        '',
        '**Solution:**',
        'Formula: F = ma',
        `Substitute: F = ${mass} × ${acceleration}`,
        `Calculate: F = ${Number(force.toFixed(4))} N`,
        '',
        '**Mark Scheme:**',
        '- States F = ma',
        '- Correct substitution',
        '- Correct force with unit N',
        '',
        '**Examiner Tip:** Resultant force is measured in newtons.',
      ].join('\n')
    }
  }

  if (formula === 'V=IR') {
    const voltage = extractNumberAfter(text, [/voltage\s*(?:=|is)?\s*(\d+(?:\.\d+)?)/i, /(\d+(?:\.\d+)?)\s*v\b/i])
    const current = extractNumberAfter(text, [/current\s*(?:=|is)?\s*(\d+(?:\.\d+)?)/i, /(\d+(?:\.\d+)?)\s*a\b/i])
    if (voltage !== null && current !== null && current !== 0) {
      const resistance = voltage / current
      return [
        '**Confidence:** 🔶 PATTERN-BASED',
        '**Source:** Pattern reasoning using Ohm’s law',
        '',
        '**Solution:**',
        'Formula: V = IR, so R = V/I',
        `Substitute: R = ${voltage}/${current}`,
        `Calculate: R = ${Number(resistance.toFixed(4))} Ω`,
        '',
        '**Mark Scheme:**',
        '- Rearranges Ohm’s law correctly',
        '- Correct substitution',
        '- Correct resistance with unit Ω',
        '',
        '**Examiner Tip:** Resistance is measured in ohms.',
      ].join('\n')
    }
  }

  return null
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

export async function solveWithHybridIntelligence(
  studentId: string,
  question: string,
  subject: string,
  level: string,
  studentMemory: string
): Promise<HybridAnswer> {
  const searchResult = await intelligentSearch(question, subject, level)
  const maxSim = searchResult.max_similarity || 0
  const prompt = buildIntelligentPrompt(question, searchResult, studentMemory, subject)

  let responseText = ''
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY

  if (geminiKey) {
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai')
      const genAI = new GoogleGenerativeAI(geminiKey)
      let lastError: unknown = null

      for (const modelName of getGeminiModelCandidates()) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName })
          const result = await withGeminiTimeout(
            model.generateContent({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: {
                maxOutputTokens: 700,
                temperature: 0.05,
                topP: 0.85,
                topK: 20,
              },
            }),
            GEMINI_TIMEOUT_MS
          )
          responseText = result.response.text()
          if (responseText.trim()) break
          throw new Error('Gemini returned an empty response')
        } catch (error) {
          lastError = error
          console.error(`Hybrid solver Gemini error (${modelName}):`, getGeminiErrorMessage(error))
        }
      }

      if (!responseText.trim() && lastError) {
        console.error('Hybrid solver Gemini exhausted all models:', getGeminiErrorMessage(lastError))
      }
    } catch (error) {
      console.error('Hybrid solver Gemini error:', error)
    }
  }

  if (!responseText.trim()) {
    responseText = fallbackPatternAnswer(question, searchResult, subject)
  }

  let confidence: HybridAnswer['confidence']
  let badge: HybridAnswer['confidenceBadge']
  let usedPatternReasoning = false

  const hasPatternReasoning =
    Boolean(searchResult.analysis?.solving_guide) ||
    Boolean(searchResult.analysis?.relevant_formulas?.length)

  if (maxSim > 0.85) {
    confidence = 'VERIFIED'
    badge = '✅'
  } else if (maxSim > 0.55 || hasPatternReasoning) {
    confidence = 'PATTERN_BASED'
    badge = '🔶'
    usedPatternReasoning = true
  } else {
    confidence = 'UNVERIFIED'
    badge = '⚠️'
    usedPatternReasoning = true
  }

  const sources = searchResult.chunks
    .filter((chunk) => chunk.similarity > 0.55)
    .map((chunk) => chunk.metadata?.source || 'ScholarHAAB question bank')
    .filter((source, index, list) => Boolean(source) && list.indexOf(source) === index)
    .slice(0, 3)

  const questionType = searchResult.analysis?.classification?.question_type || 'general'

  return {
    answer: responseText,
    confidence,
    confidenceBadge: badge,
    sources,
    markScheme: [],
    examinerTip: '',
    solvingPattern: usedPatternReasoning
      ? `Pattern-based reasoning: ${questionType}`
      : 'Direct mark scheme used',
    usedPatternReasoning,
    questionType,
    similarityScore: maxSim,
  }
}
