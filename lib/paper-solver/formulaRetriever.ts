import { retrieveFormula, type FormulaRetrieval } from '@/lib/rag/retrieveFormula'
import type { QuestionAnalysis } from '@/lib/paper-solver/questionAnalyzer'

export async function retrieveSolverFormulas(analysis: QuestionAnalysis): Promise<FormulaRetrieval[]> {
  const topic = analysis.topic ?? analysis.chapter ?? analysis.concepts[0] ?? analysis.normalizedQuestion
  const formulas = await retrieveFormula(analysis.normalizedQuestion, analysis.subject ?? 'General', topic)
  const existing = new Set(formulas.map((entry) => entry.formula.toLowerCase()))

  for (const formula of analysis.formulasNeeded) {
    if (!existing.has(formula.toLowerCase())) {
      formulas.push({
        formula,
        topic,
        subject: analysis.subject ?? 'General',
        meaning: 'Relevant exam formula or rule detected from the question.',
        units: null,
        commonMistake: 'Use the formula only after writing known values and units.',
        source: 'local_knowledge',
      })
    }
  }

  return formulas.slice(0, 6)
}
