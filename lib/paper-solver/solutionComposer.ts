import type { SearchResult } from '@/lib/rag/ragSystem'
import type { RetrievedMarkScheme } from '@/lib/rag/retrieveMarkScheme'
import type { FormulaRetrieval } from '@/lib/rag/retrieveFormula'
import type { TheoryRetrieval } from '@/lib/rag/retrieveTheory'
import type { SpecificationRetrieval } from '@/lib/rag/retrieveSpecification'
import type { QuestionAnalysis } from '@/lib/paper-solver/questionAnalyzer'
import type { PatternRetrievalResult } from '@/lib/paper-solver/patternRetriever'
import type { MarkSchemePattern } from '@/lib/paper-solver/markSchemePatternRetriever'
import type { ExaminerSolution } from '@/lib/paper-solver/examinerSolver'
import type { ConfidenceClassification } from '@/lib/paper-solver/confidenceClassifier'

export type SourceBasis = {
  type: 'exact_paper' | 'similar_pattern' | 'formula_theory' | 'ai_reasoning'
  label: string
  sources: Array<Record<string, unknown>>
}

export type ComposedSolution = {
  answer: string
  sourceBasis: SourceBasis
  reasoningSteps: string[]
  markSchemePoints: string[]
  examinerTip: string
  commonMistake: string
  practiceNext: string
}

function sourceFromSearchResult(result: SearchResult) {
  return {
    board: result.board,
    level: result.level,
    subject: result.subject,
    topic: result.topic,
    year: result.year,
    paper_code: result.paper,
    question_number: result.question_number,
    marks: result.marks,
    source_pdf_url: result.source_url,
  }
}

function exactSourceBasis(result: SearchResult): SourceBasis {
  return {
    type: 'exact_paper',
    label: `${result.board || 'Cambridge/Edexcel'} ${result.level || ''} ${result.subject || ''} ${result.year || ''} ${result.paper || ''} Q${result.question_number || ''}`.replace(/\s+/g, ' ').trim(),
    sources: [sourceFromSearchResult(result)],
  }
}

function patternSourceBasis(patterns: PatternRetrievalResult, formulas: FormulaRetrieval[], theory: TheoryRetrieval[], syllabus: SpecificationRetrieval[]): SourceBasis {
  if (patterns.matchedPatterns.length || patterns.similarQuestions.length) {
    return {
      type: 'similar_pattern',
      label: 'Based on similar Cambridge/Edexcel mark scheme patterns.',
      sources: [
        ...patterns.matchedPatterns.slice(0, 3).map((pattern) => ({
          type: pattern.source,
          subject: pattern.subject,
          topic: pattern.topic,
          questionType: pattern.questionType,
          yearsAppeared: pattern.yearsAppeared,
          frequency: pattern.frequency,
        })),
        ...patterns.similarQuestions.slice(0, 2).map(sourceFromSearchResult),
      ],
    }
  }

  if (formulas.length || theory.length || syllabus.length) {
    return {
      type: 'formula_theory',
      label: 'Based on formula/theory/syllabus support.',
      sources: [
        ...formulas.slice(0, 2).map((formula) => ({ type: formula.source, topic: formula.topic, formula: formula.formula })),
        ...theory.slice(0, 2).map((entry) => ({ type: entry.source, topic: entry.topic, keywords: entry.examKeywords })),
        ...syllabus.slice(0, 1).map((entry) => ({ type: 'syllabus', topic: entry.topic, specificationRef: entry.specificationRef })),
      ],
    }
  }

  return {
    type: 'ai_reasoning',
    label: 'No exact or close pattern found. This is AI reasoning - verify before exam.',
    sources: [],
  }
}

function conciseList(title: string, items: string[]) {
  if (!items.length) return []
  return [title, ...items.map((item) => `- ${item}`)]
}

export function composeVerifiedSolution(input: {
  exactResult: SearchResult
  markScheme: RetrievedMarkScheme
  confidence: ConfidenceClassification
}): ComposedSolution {
  const sourceBasis = exactSourceBasis(input.exactResult)
  const markPoints = input.markScheme.markPoints.length
    ? input.markScheme.markPoints
    : input.markScheme.answerText
      ? [input.markScheme.answerText]
      : ['Use the retrieved mark scheme answer.']
  const answer = [
    input.confidence.badge,
    '',
    `Source basis: ${sourceBasis.label}`,
    '',
    'Question:',
    input.exactResult.question_text,
    '',
    'Short answer:',
    input.markScheme.answerText ?? markPoints[0],
    '',
    ...conciseList('Mark scheme style points:', markPoints),
    '',
    'Examiner tip:',
    'Use the same keywords as the mark scheme and keep each mark as a separate point.',
  ].join('\n')

  return {
    answer,
    sourceBasis,
    reasoningSteps: [],
    markSchemePoints: markPoints,
    examinerTip: 'Use the same keywords as the mark scheme and keep each mark as a separate point.',
    commonMistake: 'Do not add unsupported paper-code details beyond the retrieved source.',
    practiceNext: 'Try the next part of the same paper if available.',
  }
}

export function composeReasonedSolution(input: {
  analysis: QuestionAnalysis
  patterns: PatternRetrievalResult
  markSchemePattern: MarkSchemePattern
  formulas: FormulaRetrieval[]
  theory: TheoryRetrieval[]
  syllabus: SpecificationRetrieval[]
  solution: ExaminerSolution
  confidence: ConfidenceClassification
}): ComposedSolution {
  const sourceBasis = patternSourceBasis(input.patterns, input.formulas, input.theory, input.syllabus)
  const heading =
    input.confidence.status === 'pattern_based'
      ? 'I did not find this exact past paper question, but similar examiner patterns support this answer.'
      : input.confidence.warning ?? 'This is AI reasoning - verify before exam.'
  const calculationLine = input.solution.calculationVerification
    ? input.solution.calculationVerification.passed
      ? 'Calculation check: passed by independent SymPy verification.'
      : `Calculation check: failed (${input.solution.calculationVerification.failureTypes.join(', ')}).`
    : null

  const answer = [
    input.confidence.badge,
    '',
    heading,
    '',
    `Source basis: ${sourceBasis.label}`,
    `Confidence: ${input.confidence.confidence}%`,
    calculationLine,
    '',
    'Short answer:',
    input.solution.finalAnswer,
    '',
    ...conciseList('Working / explanation:', input.solution.reasoningSteps),
    '',
    ...conciseList('Mark scheme style points:', input.solution.markSchemeStyleAnswer),
    '',
    'Examiner tip:',
    input.solution.examTip,
    '',
    'Common mistake:',
    input.solution.commonMistake,
    '',
    'Practice next:',
    input.solution.practiceNext,
  ].filter((line) => line !== null).join('\n')

  return {
    answer,
    sourceBasis,
    reasoningSteps: input.solution.reasoningSteps,
    markSchemePoints: input.solution.markSchemeStyleAnswer,
    examinerTip: input.solution.examTip,
    commonMistake: input.solution.commonMistake,
    practiceNext: input.solution.practiceNext,
  }
}
