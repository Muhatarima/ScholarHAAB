import type { FormulaRetrieval } from '@/lib/rag/retrieveFormula'
import type { TheoryRetrieval } from '@/lib/rag/retrieveTheory'
import type { SpecificationRetrieval } from '@/lib/rag/retrieveSpecification'
import type { QuestionAnalysis } from '@/lib/paper-solver/questionAnalyzer'
import type { PatternRetrievalResult } from '@/lib/paper-solver/patternRetriever'
import type { MarkSchemePattern } from '@/lib/paper-solver/markSchemePatternRetriever'
import { solveLikeExaminer, type ExaminerSolution } from '@/lib/paper-solver/examinerSolver'

export async function solveUnknownQuestion(input: {
  analysis: QuestionAnalysis
  patterns: PatternRetrievalResult
  markSchemePattern: MarkSchemePattern
  formulas: FormulaRetrieval[]
  theory: TheoryRetrieval[]
  syllabus: SpecificationRetrieval[]
}): Promise<ExaminerSolution> {
  return solveLikeExaminer(input)
}
