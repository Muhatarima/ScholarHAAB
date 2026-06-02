import type { QuestionDecomposition } from '@/lib/reasoning/questionDecomposer'

export type ExaminerReasoning = {
  markAllocation: string[]
  expectedKeywords: string[]
  requiredSteps: string[]
  commonLostMarks: string[]
  examinerSummary: string
}

export function reasonLikeExaminer(decomposition: QuestionDecomposition): ExaminerReasoning {
  const command = decomposition.commandWords.primaryCommand
  const markAllocation: string[] = []
  const requiredSteps: string[] = []
  const expectedKeywords = [...decomposition.concepts, ...decomposition.formulas]
  const commonLostMarks: string[] = []

  if (command === 'calculate' || command === 'solve') {
    markAllocation.push('Formula or correct method [1]', 'Substitution/working [1]', 'Final answer [1]', 'Unit or exact form where required [1]')
    requiredSteps.push('Identify quantities', 'Write formula', 'Substitute values', 'Simplify and check units')
    commonLostMarks.push('answer without method', 'wrong unit', 'rounding too early')
  } else if (command === 'explain' || command === 'justify') {
    markAllocation.push('Correct scientific point [1]', 'Cause-effect link [1]', 'Exam keyword/application [1]')
    requiredSteps.push('State the cause', 'Link it to the effect', 'Use the syllabus keyword')
    commonLostMarks.push('describing without explaining', 'missing because/therefore link')
  } else if (command === 'compare') {
    markAllocation.push('Point for first item [1]', 'Point for second item [1]', 'Direct comparison [1]')
    requiredSteps.push('Use same feature for both sides', 'Write a clear difference/similarity')
    commonLostMarks.push('two separate descriptions without comparison')
  } else {
    markAllocation.push('Accurate keyword [1]', 'Relevant explanation/example [1]')
    requiredSteps.push('Give direct answer', 'Add one exam phrase')
    commonLostMarks.push('too vague', 'missing syllabus keyword')
  }

  return {
    markAllocation,
    expectedKeywords: expectedKeywords.length ? expectedKeywords : ['definition', 'method', 'application'],
    requiredSteps,
    commonLostMarks,
    examinerSummary: `Examiner expects a ${decomposition.questionType} answer with ${decomposition.commandWords.answerStyle}.`,
  }
}
