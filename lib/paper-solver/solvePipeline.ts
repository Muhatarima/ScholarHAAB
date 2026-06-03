import type { SearchResult } from '@/lib/rag/ragSystem'
import { retrievePastPaper } from '@/lib/rag/retrievePastPaper'
import { retrieveMarkSchemeFromResult } from '@/lib/rag/retrieveMarkScheme'
import { calculateConfidence } from '@/lib/rag/calculateConfidence'
import { analyzeQuestion, type QuestionAnalysis } from '@/lib/paper-solver/questionAnalyzer'
import { retrievePatterns, type PatternRetrievalResult } from '@/lib/paper-solver/patternRetriever'
import { retrieveMarkSchemePattern, type MarkSchemePattern } from '@/lib/paper-solver/markSchemePatternRetriever'
import { classifySolverConfidence, type ConfidenceClassification } from '@/lib/paper-solver/confidenceClassifier'
import { solveUnknownQuestion } from '@/lib/paper-solver/unknownQuestionSolver'
import { composeReasonedSolution, composeVerifiedSolution, type SourceBasis } from '@/lib/paper-solver/solutionComposer'
import type { FormulaRetrieval } from '@/lib/rag/retrieveFormula'
import type { TheoryRetrieval } from '@/lib/rag/retrieveTheory'
import type { SpecificationRetrieval } from '@/lib/rag/retrieveSpecification'
import type { ExaminerSolution } from '@/lib/paper-solver/examinerSolver'
import { routeKnowledge } from '@/lib/knowledge/knowledgeRouter'
import type { KnowledgeRouterResult } from '@/lib/knowledge/types'

export type PaperSolveProfile = {
  board?: string | null
  level?: string | null
  subjects?: string[]
}

export type PatternSolveResult = {
  status: 'verified' | 'pattern_based' | 'ai_reasoning' | 'unsupported'
  confidence: 'VERIFIED' | 'PATTERN_BASED' | 'AI_REASONING' | 'UNSUPPORTED'
  confidenceScore: number
  confidenceBadge: string
  warning: string | null
  answer: string
  response: string
  analysis: QuestionAnalysis
  exactResult: SearchResult | null
  patterns: PatternRetrievalResult
  markSchemePattern: MarkSchemePattern | null
  formulas: FormulaRetrieval[]
  theory: TheoryRetrieval[]
  syllabus: SpecificationRetrieval[]
  knowledge: KnowledgeRouterResult | null
  sourceBasis: SourceBasis
  reasoningSteps: string[]
  markSchemePoints: string[]
  examinerTip: string
  commonMistake: string
  practiceNext: string
  examinerSolution: ExaminerSolution | null
}

function formulaFromKnowledge(items: KnowledgeRouterResult['formulas']): FormulaRetrieval[] {
  return items.map((item) => ({
    formula: item.formula,
    topic: item.topic,
    subject: item.subject,
    meaning: item.meaning,
    units: item.units,
    commonMistake: item.commonMistake,
    source: item.source === 'database' ? 'formula_bank' : 'local_knowledge',
  }))
}

function theoryFromKnowledge(items: KnowledgeRouterResult['theory']): TheoryRetrieval[] {
  return items.map((item) => ({
    subject: item.subject,
    chapter: item.chapter,
    topic: item.topic,
    shortExplanation: item.shortExplanation,
    detailedExplanation: item.detailedExplanation,
    examKeywords: item.examKeywords,
    misconceptions: item.commonMisconceptions,
    source: item.source === 'database' ? 'theory_bank' : 'local_knowledge',
  }))
}

function syllabusFromKnowledge(items: KnowledgeRouterResult['syllabus']): SpecificationRetrieval[] {
  return items.map((item) => ({
    board: item.board,
    level: item.level,
    subject: item.subject,
    chapter: item.chapter ?? '',
    topic: item.topic,
    learningObjectives: item.learningObjectives,
    specificationRef: item.specificationRef,
  }))
}

function selectedSubject(analysis: QuestionAnalysis, profile: PaperSolveProfile) {
  if (analysis.subject) return analysis.subject
  if (profile.subjects?.length === 1) return profile.subjects[0]
  return undefined
}

async function retrieveExactCandidate(analysis: QuestionAnalysis, profile: PaperSolveProfile) {
  const subject = selectedSubject(analysis, profile)
  const results = await retrievePastPaper(
    analysis.normalizedQuestion,
    {
      board: analysis.board ?? profile.board ?? undefined,
      level: analysis.level ?? profile.level ?? undefined,
      subject,
      topic: analysis.topic ?? undefined,
      year_from: analysis.year ?? undefined,
      year_to: analysis.year ?? undefined,
    },
    5
  ).catch(() => [])

  const best = results[0] ?? null
  const confidence = calculateConfidence(best)
  return { best, confidence, results }
}

function emptyPatternResult(similarQuestions: SearchResult[] = []): PatternRetrievalResult {
  return {
    matchedPatterns: [],
    similarQuestions,
    confidence: 0,
    patternSummary: 'Exact verified source found.',
  }
}

export async function solveWithPatternPipeline(input: {
  question: string
  profile: PaperSolveProfile
}): Promise<PatternSolveResult> {
  const analysis = analyzeQuestion(input.question)
  const exact = await retrieveExactCandidate(analysis, input.profile)
  const exactMarkScheme = retrieveMarkSchemeFromResult(exact.best)

  if (exact.best && exact.confidence.status === 'verified' && (exactMarkScheme.answerText || exactMarkScheme.markPoints.length)) {
    const confidence: ConfidenceClassification = {
      status: 'verified',
      confidence: exact.confidence.confidence,
      label: 'VERIFIED',
      badge: 'VERIFIED - from Cambridge/Edexcel past papers',
      warning: null,
    }
    const composed = composeVerifiedSolution({
      exactResult: exact.best,
      markScheme: exactMarkScheme,
      confidence,
    })

    return {
      status: 'verified',
      confidence: 'VERIFIED',
      confidenceScore: confidence.confidence,
      confidenceBadge: confidence.badge,
      warning: null,
      answer: composed.answer,
      response: composed.answer,
      analysis,
      exactResult: exact.best,
      patterns: emptyPatternResult(exact.results),
      markSchemePattern: null,
      formulas: [],
      theory: [],
      syllabus: [],
      knowledge: null,
      sourceBasis: composed.sourceBasis,
      reasoningSteps: composed.reasoningSteps,
      markSchemePoints: composed.markSchemePoints,
      examinerTip: composed.examinerTip,
      commonMistake: composed.commonMistake,
      practiceNext: composed.practiceNext,
      examinerSolution: null,
    }
  }

  const [patterns, knowledge] = await Promise.all([
    retrievePatterns(analysis, {
      board: input.profile.board ?? undefined,
      level: input.profile.level ?? undefined,
      subject: selectedSubject(analysis, input.profile),
    }),
    routeKnowledge(analysis, {
      board: input.profile.board ?? undefined,
      level: input.profile.level ?? undefined,
      subject: selectedSubject(analysis, input.profile),
    }),
  ])
  const formulas = formulaFromKnowledge(knowledge.formulas)
  const theory = theoryFromKnowledge(knowledge.theory)
  const syllabus = syllabusFromKnowledge(knowledge.syllabus)
  const markSchemePattern = await retrieveMarkSchemePattern(analysis, patterns)
  const examinerSolution = await solveUnknownQuestion({
    analysis,
    patterns,
    markSchemePattern,
    formulas,
    theory,
    syllabus,
  })
  const confidence = classifySolverConfidence({
    exactResult: exact.best,
    patternResult: {
      ...patterns,
      confidence: Math.max(0, Math.min(89, patterns.confidence + examinerSolution.confidenceBoost)),
    },
    formulaCount: formulas.length,
    theoryCount: theory.length,
    syllabusCount: syllabus.length,
    sympyVerified: Boolean(examinerSolution.calculationVerification?.passed),
  })
  const composed = composeReasonedSolution({
    analysis,
    patterns,
    markSchemePattern,
    formulas,
    theory,
    syllabus,
    solution: examinerSolution,
    confidence,
  })

  return {
    status: confidence.status,
    confidence: confidence.label,
    confidenceScore: confidence.confidence,
    confidenceBadge: confidence.badge,
    warning: confidence.warning,
    answer: composed.answer,
    response: composed.answer,
    analysis,
    exactResult: exact.best,
    patterns,
    markSchemePattern,
    formulas,
    theory,
    syllabus,
    knowledge,
    sourceBasis: composed.sourceBasis,
    reasoningSteps: composed.reasoningSteps,
    markSchemePoints: composed.markSchemePoints,
    examinerTip: composed.examinerTip,
    commonMistake: composed.commonMistake,
    practiceNext: composed.practiceNext,
    examinerSolution,
  }
}
