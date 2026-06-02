import { getPrimaryFormula } from '@/lib/math/formulaEngine'
import type { SympySolveResult } from '@/lib/math/sympyEngine'

export function formatMathSolution(question: string, result: SympySolveResult) {
  const formula = getPrimaryFormula(question)
  const working = result.working.length ? result.working : ['Identify the method.', 'Apply the formula carefully.', `Answer: ${result.exactAnswer}`]

  return [
    'AI REASONING - verify before exam',
    '',
    'Math engine result:',
    `Exact answer: ${result.exactAnswer}`,
    result.latex ? `LaTeX: $${result.latex}$` : '',
    '',
    'Working:',
    ...working.map((step, index) => `Step ${index + 1} [1]: ${step}`),
    '',
    'Why it works:',
    formula?.whenToUse ?? 'The calculation follows the standard A/O Level method for this question type.',
    '',
    'Exam tip:',
    formula?.examTip ?? 'Show the method line before the final answer; that is where the method mark usually comes from.',
    '',
    'Mark scheme keywords:',
    formula ? `formula, substitution, simplification, correct final answer` : 'correct method, substitution, final answer',
    '',
    'Common mistake:',
    formula?.commonMistake ?? 'Skipping steps or writing the final answer without working.',
    '',
    result.usedSympy ? 'Calculation engine: SymPy symbolic backend' : 'Calculation engine: deterministic exam fallback',
  ]
    .filter(Boolean)
    .join('\n')
}
