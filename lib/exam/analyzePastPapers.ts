import { searchSimilarQuestions, type SearchResult } from '@/lib/rag/ragSystem'
import { retrieveQbankContext, searchQbankQuestions } from '@/lib/server/qbank'

export type PastPaperAnalysis = {
  repeatedTopics: Array<{ topic: string; frequency: number; yearsAppeared: number[] }>
  highFrequencyQuestionTypes: Array<{ type: string; frequency: number }>
  recurringFormulas: Array<{ formula: string; topic: string; frequency: number }>
  markSchemePatterns: string[]
  topicFrequency: Record<string, number>
  predictedImportantTopics: Array<{
    topic: string
    whyImportant: string
    estimatedExamChance: string
    confidence: 'high' | 'medium' | 'low'
  }>
  dataLabel: 'frequency_from_database' | 'prediction_based_on_available_data'
  sources: SearchResult[]
}

const FORMULA_PATTERNS: Array<[RegExp, string]> = [
  [/\bv\s*=\s*f|wave speed|wavelength/gi, 'v = f x wavelength'],
  [/\bf\s*=\s*m\s*a|force\s*=\s*mass/gi, 'F = ma'],
  [/\bw\s*=\s*m\s*g|weight/gi, 'W = mg'],
  [/\bn\s*=\s*m\s*\/\s*mr|moles/gi, 'n = mass / Mr'],
  [/\bc\s*=\s*n\s*\/\s*v|concentration/gi, 'concentration = moles / volume'],
  [/\bquadratic formula|b\^2|b²/gi, 'x = (-b +/- sqrt(b^2 - 4ac)) / 2a'],
]

const QUESTION_TYPES: Array<[RegExp, string]> = [
  [/\bcalculate|determine|find|work out\b/gi, 'calculation'],
  [/\bexplain|why|account for\b/gi, 'explain why'],
  [/\bdefine|state what is meant|what is meant\b/gi, 'definition'],
  [/\bcompare|contrast|difference\b/gi, 'compare'],
  [/\bgraph|sketch|draw|diagram\b/gi, 'graph/diagram'],
]

function increment(map: Map<string, number>, key: string, amount = 1) {
  map.set(key, (map.get(key) ?? 0) + amount)
}

function sortedMap(map: Map<string, number>, limit = 8) {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
}

function sameExamScope(source: Pick<SearchResult, 'board' | 'level' | 'subject'>, input: {
  board: string
  level: string
  subject: string
}) {
  const sourceBoard = source.board?.toLowerCase() ?? ''
  const sourceLevel = source.level?.toLowerCase() ?? ''
  const sourceSubject = source.subject?.toLowerCase() ?? ''
  const requestedBoard = input.board.toLowerCase()
  const requestedLevel = input.level.toLowerCase()
  const requestedSubject = input.subject.toLowerCase()

  if (sourceBoard && sourceBoard !== 'general' && !sourceBoard.includes(requestedBoard)) {
    return false
  }
  if (sourceSubject && sourceSubject !== 'general' && !sourceSubject.includes(requestedSubject)) {
    return false
  }
  if (requestedLevel === 'a level' && /\bo level\b|igcse/.test(sourceLevel)) {
    return false
  }
  if (requestedLevel === 'o level' && /\ba level\b/.test(sourceLevel)) {
    return false
  }
  return true
}

export async function analyzePastPapers({
  level,
  board,
  subject,
  paperType,
  yearsBack = 10,
  topicFocus,
}: {
  level: string
  board: string
  subject: string
  paperType?: string | null
  yearsBack?: number
  topicFocus?: string | null
}): Promise<PastPaperAnalysis> {
  const currentYear = new Date().getFullYear()
  const yearFrom = currentYear - yearsBack
  const query = [board, level, subject, paperType, topicFocus, 'past paper mark scheme formula pattern']
    .filter(Boolean)
    .join(' ')
  let sources: SearchResult[] = []

  try {
    sources = await searchSimilarQuestions(
      query,
      {
        board: board.toLowerCase(),
        level,
        subject,
        year_from: yearFrom,
        year_to: currentYear,
      },
      30
    )
  } catch (error) {
    console.warn('Database past-paper search unavailable; using compiled QBank.', error)
  }

  sources = sources.filter((source) => sameExamScope(source, { board, level, subject }))

  if (sources.length < 8) {
    try {
      const compiled = await searchQbankQuestions(query)
      const compiledSources: SearchResult[] = compiled.matches
        .map((row) => {
          const confidence: SearchResult['confidence'] =
            row.linkQuality === 'exact'
              ? 'VERIFIED'
              : row.linkQuality === 'hierarchical'
                ? 'PARTIAL'
                : 'LOW_CONFIDENCE'
          return {
            id: row.id,
            board: row.board,
            level: row.level,
            subject: row.subject,
            year: row.year ?? 0,
            session: '',
            paper: row.paper ?? '',
            question_number: row.questionLabel ?? '',
            question_text: row.questionText,
            marks: row.marks ?? null,
            mark_scheme: row.answerSummary || row.solution || null,
            mark_scheme_points: row.methodSteps,
            topic: row.topic,
            subtopic: row.chapter,
            source_url: row.sourceUrl ?? row.answerSourceUrl,
            similarity: Math.min(0.95, Math.max(0.75, (row.linkScore || 75) / 100)),
            confidence,
          }
        })
        .filter((source) => sameExamScope(source, { board, level, subject }))
      const deduped = new Map(sources.map((source) => [source.id, source]))
      for (const source of compiledSources) {
        if (!deduped.has(source.id)) deduped.set(source.id, source)
      }
      sources = Array.from(deduped.values()).slice(0, 30)
    } catch (error) {
      console.warn('Compiled QBank analysis unavailable.', error)
    }
  }

  if (sources.length < 3) {
    try {
      const qbankContext = await retrieveQbankContext(query)
      const contextSources: SearchResult[] = qbankContext.chunks
        .map((chunk) => {
          const confidence: SearchResult['confidence'] =
            chunk.score >= 0.85 ? 'PARTIAL' : 'LOW_CONFIDENCE'
          return {
            id: chunk.id,
            board: qbankContext.parsedQuery.board ?? board,
            level: qbankContext.parsedQuery.level ?? level,
            subject: qbankContext.parsedQuery.subject ?? subject,
            year: qbankContext.parsedQuery.year ?? 0,
            session: '',
            paper: qbankContext.parsedQuery.paper ?? paperType ?? '',
            question_number: '',
            question_text: chunk.content,
            marks: null,
            mark_scheme: null,
            mark_scheme_points: [],
            topic: topicFocus ?? subject,
            subtopic: null,
            resource_type: chunk.tier,
            source_url: chunk.sourceUrl,
            similarity: chunk.score,
            confidence,
          }
        })
        .filter((source) => sameExamScope(source, { board, level, subject }))
      const deduped = new Map(sources.map((source) => [source.id, source]))
      for (const source of contextSources) {
        if (!deduped.has(source.id)) deduped.set(source.id, source)
      }
      sources = Array.from(deduped.values()).slice(0, 30)
    } catch (error) {
      console.warn('QBank context analysis unavailable.', error)
    }
  }

  const topicCounts = new Map<string, number>()
  const topicYears = new Map<string, Set<number>>()
  const questionTypeCounts = new Map<string, number>()
  const formulaCounts = new Map<string, number>()
  const formulaTopics = new Map<string, string>()
  const markPatterns = new Set<string>()

  for (const source of sources) {
    const topic = source.topic || source.subtopic || topicFocus || 'Core syllabus'
    const text = `${source.question_text} ${source.mark_scheme ?? ''} ${(source.mark_scheme_points ?? []).join(' ')}`
    increment(topicCounts, topic)
    if (!topicYears.has(topic)) topicYears.set(topic, new Set())
    if (source.year) topicYears.get(topic)!.add(source.year)

    for (const [pattern, type] of QUESTION_TYPES) {
      pattern.lastIndex = 0
      if (pattern.test(text)) increment(questionTypeCounts, type)
    }

    for (const [pattern, formula] of FORMULA_PATTERNS) {
      pattern.lastIndex = 0
      if (pattern.test(text)) {
        increment(formulaCounts, formula)
        formulaTopics.set(formula, topic)
      }
    }

    if (source.mark_scheme || source.mark_scheme_points?.length) {
      if (/\bunit|units\b/i.test(text)) markPatterns.add('unit mark appears in calculation answers')
      if (/\bformula|equation\b/i.test(text)) markPatterns.add('formula/method mark before substitution')
      if (/\bexplain|because|therefore\b/i.test(text)) markPatterns.add('cause-to-effect explanation points')
      if (/\ballow|accept|reject\b/i.test(text)) markPatterns.add('allow/accept/reject mark scheme wording')
    }
  }

  const repeatedTopics = sortedMap(topicCounts).map(([topic, frequency]) => ({
    topic,
    frequency,
    yearsAppeared: Array.from(topicYears.get(topic) ?? []).sort((a, b) => a - b),
  }))

  const dataLabel = sources.length >= 3 ? 'frequency_from_database' : 'prediction_based_on_available_data'

  return {
    repeatedTopics,
    highFrequencyQuestionTypes: sortedMap(questionTypeCounts, 6).map(([type, frequency]) => ({ type, frequency })),
    recurringFormulas: sortedMap(formulaCounts, 8).map(([formula, frequency]) => ({
      formula,
      topic: formulaTopics.get(formula) ?? topicFocus ?? subject,
      frequency,
    })),
    markSchemePatterns: Array.from(markPatterns).slice(0, 8),
    topicFrequency: Object.fromEntries(topicCounts),
    predictedImportantTopics: repeatedTopics.slice(0, 6).map((item) => ({
      topic: item.topic,
      whyImportant:
        dataLabel === 'frequency_from_database'
          ? `Appeared ${item.frequency} time(s) in the retrieved last-${yearsBack}-year set.`
          : 'Prediction based on available data and syllabus patterns.',
      estimatedExamChance: item.frequency >= 5 ? 'high' : item.frequency >= 2 ? 'medium' : 'low',
      confidence: item.frequency >= 5 ? 'high' : item.frequency >= 2 ? 'medium' : 'low',
    })),
    dataLabel,
    sources,
  }
}
