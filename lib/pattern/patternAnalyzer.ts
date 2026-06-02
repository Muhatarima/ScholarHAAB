import { retrievePatterns, type PatternFilters, type RetrievedPattern } from '@/lib/rag/retrievePatterns'

export type PatternInsight = {
  repeatedTopics: Array<{
    topic: string
    frequency: number
    yearsAppeared: number[]
    confidence: RetrievedPattern['confidence']
  }>
  highFrequencyQuestionTypes: string[]
  recurringFormulas: string[]
  markSchemePatterns: string[]
  commandWords: string[]
  summary: string
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

export async function analyzePatterns(filters: PatternFilters): Promise<PatternInsight> {
  const patterns = await retrievePatterns(filters)
  const repeatedTopics = patterns.map((pattern) => ({
    topic: pattern.topic,
    frequency: pattern.frequency,
    yearsAppeared: pattern.yearsAppeared,
    confidence: pattern.confidence,
  }))
  const highFrequencyQuestionTypes = unique(patterns.flatMap((pattern) => pattern.commonQuestionTypes))
  const recurringFormulas = unique(patterns.flatMap((pattern) => pattern.formulaPatterns))
  const markSchemePatterns = unique(patterns.flatMap((pattern) => pattern.markSchemePatterns))
  const commandWords = unique(patterns.flatMap((pattern) => pattern.commandWords))
  const top = repeatedTopics[0]

  return {
    repeatedTopics,
    highFrequencyQuestionTypes,
    recurringFormulas,
    markSchemePatterns,
    commandWords,
    summary: top
      ? `${top.topic} appears most often in available ${filters.board ?? 'board'} ${filters.level ?? 'level'} ${filters.subject ?? 'subject'} data. Treat this as pattern guidance, not a guarantee.`
      : 'Pattern data is limited, so use syllabus coverage plus recent mistakes first.',
  }
}

export function commandWordStructure(commandWord: string) {
  const normalized = commandWord.toLowerCase()
  if (normalized.includes('calculate')) {
    return ['Formula [1]', 'Substitution [1]', 'Correct answer [1]', 'Unit/rounding [1]']
  }
  if (normalized.includes('explain')) {
    return ['Scientific point [1]', 'Cause/effect link [1]', 'Exam keyword [1]']
  }
  if (normalized.includes('compare')) {
    return ['Feature for A [1]', 'Feature for B [1]', 'Clear difference [1]']
  }
  return ['Definition/keyword [1]', 'Relevant detail [1]', 'Application/example [1]']
}
