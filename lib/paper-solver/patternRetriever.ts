import { retrievePastPaper } from '@/lib/rag/retrievePastPaper'
import type { SearchResult } from '@/lib/rag/ragSystem'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'
import type { QuestionAnalysis } from '@/lib/paper-solver/questionAnalyzer'

export type PaperPattern = {
  id: string
  source: 'paper_patterns' | 'local_pattern'
  subject: string
  topic: string
  chapter?: string | null
  questionType: string
  commandWord: string
  yearsAppeared: number[]
  frequency: number
  markSchemeKeywords: string[]
  commonMistakes: string[]
  reasoningPattern: string
  confidence: number
}

export type PatternRetrievalResult = {
  matchedPatterns: PaperPattern[]
  similarQuestions: SearchResult[]
  confidence: number
  patternSummary: string
}

const LOCAL_PATTERNS: Array<{
  test: (analysis: QuestionAnalysis) => boolean
  pattern: (analysis: QuestionAnalysis) => Omit<PaperPattern, 'id' | 'source'>
}> = [
  {
    test: (analysis) => analysis.concepts.includes('resistance') && analysis.concepts.includes('temperature'),
    pattern: () => ({
      subject: 'Physics',
      topic: 'Resistance',
      chapter: 'Electricity',
      questionType: 'explanation',
      commandWord: 'explain',
      yearsAppeared: [2017, 2019, 2021, 2023],
      frequency: 4,
      markSchemeKeywords: ['ions vibrate more', 'electrons collide more often', 'resistance increases'],
      commonMistakes: ['Saying current increases without explaining collisions.'],
      reasoningPattern: 'Cause: temperature increases. Mechanism: lattice ions vibrate more. Effect: more electron collisions. Conclusion: resistance increases.',
      confidence: 84,
    }),
  },
  {
    test: (analysis) => analysis.concepts.includes('rates of reaction') && analysis.questionType === 'experiment design',
    pattern: () => ({
      subject: 'Chemistry',
      topic: 'Rates of Reaction',
      chapter: 'Physical Chemistry',
      questionType: 'experiment design',
      commandWord: 'suggest',
      yearsAppeared: [2016, 2018, 2020, 2022, 2024],
      frequency: 5,
      markSchemeKeywords: ['repeat', 'average', 'control temperature', 'control concentration', 'same apparatus'],
      commonMistakes: ['Writing improve accuracy without saying how.'],
      reasoningPattern: 'Reliability marks: repeat readings, calculate mean, keep control variables constant, use the same method/apparatus.',
      confidence: 86,
    }),
  },
  {
    test: (analysis) => analysis.concepts.includes('cracking'),
    pattern: () => ({
      subject: 'Chemistry',
      topic: 'Cracking',
      chapter: 'Organic Chemistry',
      questionType: 'explanation',
      commandWord: 'explain',
      yearsAppeared: [2015, 2018, 2020, 2021, 2023],
      frequency: 5,
      markSchemeKeywords: ['long-chain hydrocarbons', 'shorter chains', 'higher demand', 'alkenes', 'polymers'],
      commonMistakes: ['Only saying smaller molecules without saying why they are useful.'],
      reasoningPattern: 'Explain feedstock problem, cracking into shorter useful fuels, and alkenes for polymer manufacture.',
      confidence: 85,
    }),
  },
  {
    test: (analysis) => analysis.questionType === 'calculation' && analysis.subject === 'Physics',
    pattern: (analysis) => ({
      subject: 'Physics',
      topic: analysisTopicFallback(analysis),
      chapter: analysis.chapter,
      questionType: 'calculation',
      commandWord: 'calculate',
      yearsAppeared: [2016, 2017, 2019, 2021, 2024],
      frequency: 5,
      markSchemeKeywords: ['formula mark', 'substitution mark', 'answer mark', 'unit mark'],
      commonMistakes: ['Using the wrong sign or missing the unit.'],
      reasoningPattern: 'Formula, substitution, rearrangement, final answer with unit.',
      confidence: 80,
    }),
  },
]

function analysisTopicFallback(analysis: QuestionAnalysis) {
  return analysis.topic ?? analysis.concepts[0] ?? 'General'
}

function patternQueryText(analysis: QuestionAnalysis) {
  return [
    analysis.subject,
    analysis.topic,
    analysis.chapter,
    analysis.commandWord !== 'unknown' ? analysis.commandWord : null,
    analysis.questionType,
    ...analysis.concepts,
  ].filter(Boolean).join(' ')
}

function normalizeDbPattern(row: Record<string, unknown>, index: number): PaperPattern {
  return {
    id: String(row.id ?? `db-pattern-${index}`),
    source: 'paper_patterns',
    subject: String(row.subject ?? ''),
    topic: String(row.topic ?? ''),
    chapter: row.chapter ? String(row.chapter) : null,
    questionType: String(row.question_type ?? (Array.isArray(row.common_question_types) ? row.common_question_types[0] : '') ?? ''),
    commandWord: String(row.command_word ?? (Array.isArray(row.command_words) ? row.command_words[0] : '') ?? ''),
    yearsAppeared: Array.isArray(row.years_appeared) ? row.years_appeared.map(Number).filter(Number.isFinite) : [],
    frequency: Number(row.frequency ?? 0),
    markSchemeKeywords: Array.isArray(row.mark_scheme_keywords)
      ? row.mark_scheme_keywords.map(String)
      : Array.isArray(row.mark_scheme_patterns)
        ? row.mark_scheme_patterns.map(String)
        : [],
    commonMistakes: Array.isArray(row.common_mistakes) ? row.common_mistakes.map(String) : [],
    reasoningPattern: String(row.reasoning_pattern ?? ''),
    confidence: Number(row.confidence ?? 72),
  }
}

async function retrieveDbPatterns(analysis: QuestionAnalysis): Promise<PaperPattern[]> {
  try {
    const supabase = getSupabaseAdmin()
    let query = supabase
      .from('paper_patterns')
      .select('id, subject, topic, chapter, paper_type, question_type, command_word, years_appeared, frequency, mark_scheme_keywords, mark_scheme_patterns, common_mistakes, reasoning_pattern, confidence')
      .limit(8)

    if (analysis.subject) query = query.ilike('subject', `%${analysis.subject}%`)
    if (analysis.topic) query = query.ilike('topic', `%${analysis.topic}%`)
    if (analysis.paperType) query = query.ilike('paper_type', `%${analysis.paperType}%`)

    const { data, error } = await query
    if (error || !data?.length) return []
    return data.map((row, index) => normalizeDbPattern(row as Record<string, unknown>, index))
  } catch {
    return []
  }
}

function retrieveLocalPatterns(analysis: QuestionAnalysis): PaperPattern[] {
  return LOCAL_PATTERNS
    .filter((entry) => entry.test(analysis))
    .map((entry, index) => ({
      ...entry.pattern(analysis),
      id: `local-pattern-${index}`,
      source: 'local_pattern',
    }))
}

function summarize(patterns: PaperPattern[], similarQuestions: SearchResult[]) {
  if (patterns.length) {
    const top = patterns[0]
    return `Matched ${top.topic} ${top.questionType} pattern: ${top.reasoningPattern}`
  }
  if (similarQuestions.length) {
    return `Found ${similarQuestions.length} similar past-paper question(s), but no exact verified mark scheme match.`
  }
  return 'No close paper pattern found; using formula/theory and examiner reasoning.'
}

export async function retrievePatterns(analysis: QuestionAnalysis, filters: {
  board?: string
  level?: string
  subject?: string
}): Promise<PatternRetrievalResult> {
  const queryText = patternQueryText(analysis)
  const searchFilters = {
    board: analysis.board ?? filters.board,
    level: analysis.level ?? filters.level,
    subject: analysis.subject ?? filters.subject,
    topic: analysis.topic ?? undefined,
    year_from: new Date().getFullYear() - 10,
    year_to: new Date().getFullYear(),
  }

  const [dbPatterns, similarQuestions] = await Promise.all([
    retrieveDbPatterns(analysis),
    retrievePastPaper(queryText || analysis.normalizedQuestion, searchFilters, 6).catch(() => []),
  ])
  const matchedPatterns = [...dbPatterns, ...retrieveLocalPatterns(analysis)]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 6)
  const similarConfidence = similarQuestions[0] ? Math.round((similarQuestions[0].similarity || 0) * 100) : 0
  const patternConfidence = matchedPatterns[0]?.confidence ?? 0
  const confidence = Math.max(patternConfidence, Math.min(89, similarConfidence))

  return {
    matchedPatterns,
    similarQuestions,
    confidence,
    patternSummary: summarize(matchedPatterns, similarQuestions),
  }
}
