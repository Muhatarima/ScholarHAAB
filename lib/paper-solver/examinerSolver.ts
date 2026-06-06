import type { FormulaRetrieval } from '@/lib/rag/retrieveFormula'
import type { TheoryRetrieval } from '@/lib/rag/retrieveTheory'
import type { SpecificationRetrieval } from '@/lib/rag/retrieveSpecification'
import { solveNumericalPhysics, type NumericalPhysicsResult } from '@/lib/math/numericalPhysicsEngine'
import { solveWithSympy, type SympySolveResult } from '@/lib/math/sympyEngine'
import { verifyWithSympy, type SympyVerificationResult } from '@/lib/verification/sympyGroundTruth'
import type { QuestionAnalysis } from '@/lib/paper-solver/questionAnalyzer'
import type { PatternRetrievalResult } from '@/lib/paper-solver/patternRetriever'
import type { MarkSchemePattern } from '@/lib/paper-solver/markSchemePatternRetriever'

export type ExaminerSolution = {
  reasoningSteps: string[]
  finalAnswer: string
  markSchemeStyleAnswer: string[]
  examTip: string
  commonMistake: string
  practiceNext: string
  confidenceBoost: number
  numericalPhysics?: NumericalPhysicsResult | null
  mathResult?: (SympySolveResult & { parsed: { intent: string } }) | null
  calculationVerification?: SympyVerificationResult | null
}

function includesConcept(analysis: QuestionAnalysis, concept: string) {
  return analysis.concepts.includes(concept) || analysis.normalizedQuestion.toLowerCase().includes(concept)
}

async function solveCalculation(analysis: QuestionAnalysis): Promise<Partial<ExaminerSolution>> {
  const numericalPhysics = solveNumericalPhysics(analysis.normalizedQuestion)
  if (numericalPhysics) {
    const verification = await verifyWithSympy({
      question: analysis.normalizedQuestion,
      category: 'numerical_physics',
      solverAnswer: numericalPhysics.finalAnswer,
      solverLatex: numericalPhysics.latex ?? null,
      solverNumericValue: numericalPhysics.numericValue,
      solverUnit: numericalPhysics.unit,
      solverFormulaPath: numericalPhysics.formulaPath,
      solverMarkAllocation: numericalPhysics.markAllocation,
    })

    return {
      numericalPhysics,
      calculationVerification: verification,
      finalAnswer: numericalPhysics.finalAnswer,
      reasoningSteps: numericalPhysics.working,
      markSchemeStyleAnswer: numericalPhysics.markAllocation,
      examTip: 'Write the formula first, substitute with units, then round at the final step.',
      commonMistake: verification.passed ? 'Most students lose the unit or sign.' : `Check: ${verification.failureTypes.join(', ')}`,
      confidenceBoost: verification.passed ? 8 : -12,
    }
  }

  const mathResult = await solveWithSympy(analysis.normalizedQuestion)
  if (mathResult) {
    const verification = await verifyWithSympy({
      question: analysis.normalizedQuestion,
      category: 'math',
      solverAnswer: mathResult.exactAnswer,
      solverLatex: mathResult.latex ?? null,
      solverFormulaPath: mathResult.working,
      solverMarkAllocation: mathResult.working,
    })

    return {
      mathResult,
      calculationVerification: verification,
      finalAnswer: mathResult.exactAnswer,
      reasoningSteps: mathResult.working,
      markSchemeStyleAnswer: mathResult.working.map((step, index) => `${step} [${index + 1}]`),
      examTip: mathResult.latex ? `LaTeX: ${mathResult.latex}` : 'Show the rule you used before writing the final answer.',
      commonMistake: verification.passed ? 'Do not skip the rule name; examiners award method marks.' : `Check: ${verification.failureTypes.join(', ')}`,
      confidenceBoost: verification.passed ? 8 : -12,
    }
  }

  return {}
}

function localExaminerAnswer(analysis: QuestionAnalysis): Partial<ExaminerSolution> | null {
  if (
    includesConcept(analysis, 'calculus') &&
    /\barea\s+under\s+(?:the\s+)?curv\w*|\bdefinite integral\b/i.test(analysis.normalizedQuestion)
  ) {
    return {
      finalAnswer: 'The area under y = f(x) from x = a to x = b is A = integral from a to b of f(x) dx. For y = x^2 from 0 to 2, A = [x^3/3] from 0 to 2 = 8/3 square units.',
      reasoningSteps: [
        'Identify the curve and the lower and upper x-limits.',
        'Write the definite integral A = integral from a to b of f(x) dx.',
        'Integrate the function.',
        'Substitute the upper limit, then subtract the lower-limit value.',
      ],
      markSchemeStyleAnswer: [
        'Correct definite integral with limits [1]',
        'Correct antiderivative [1]',
        'Upper-limit value minus lower-limit value [1]',
        'Correct area with square units [1]',
      ],
      examTip: 'Always show the limits and upper minus lower substitution.',
      commonMistake: 'Do not forget that a geometric area below the x-axis may need an absolute value.',
      practiceNext: 'Find the area under y = 2x from x = 1 to x = 3.',
      confidenceBoost: 8,
    }
  }

  if (includesConcept(analysis, 'ideal gas law')) {
    return {
      finalAnswer: 'PV = nRT is the ideal gas equation: pressure x volume = moles x gas constant x absolute temperature.',
      reasoningSteps: [
        'P is pressure in pascals (Pa).',
        'V is volume in cubic metres (m^3).',
        'n is amount of gas in moles.',
        'R = 8.31 J mol^-1 K^-1 and T must be in kelvin.',
      ],
      markSchemeStyleAnswer: [
        'State PV = nRT [1]',
        'Use SI units for pressure and volume [1]',
        'Convert temperature to kelvin [1]',
      ],
      examTip: 'Convert degrees Celsius to kelvin by adding 273 before substituting.',
      commonMistake: 'Using degrees Celsius directly in PV = nRT.',
      practiceNext: 'Rearrange PV = nRT to make pressure P the subject.',
      confidenceBoost: 8,
    }
  }

  if (includesConcept(analysis, 'resistance') && includesConcept(analysis, 'temperature')) {
    return {
      finalAnswer: 'As temperature increases, the metal ions vibrate more. Electrons collide with them more often, so charge flow is opposed more and resistance increases.',
      reasoningSteps: [
        'Temperature increases.',
        'Positive metal ions in the lattice vibrate more strongly.',
        'Free electrons collide with the vibrating ions more often.',
        'This makes it harder for charge to flow, so resistance increases.',
      ],
      markSchemeStyleAnswer: [
        'Ions/lattice vibrate more [1]',
        'Electrons collide more often with ions [1]',
        'Charge flow is reduced / harder [1]',
        'Resistance increases [1]',
      ],
      examTip: 'Use particle words: ions, electrons, collisions. That is what examiners look for.',
      commonMistake: 'Do not just say electrons get hotter; explain collisions.',
      practiceNext: 'Try one 3-mark explanation on resistance and temperature.',
      confidenceBoost: 6,
    }
  }

  if (includesConcept(analysis, 'rates of reaction') && analysis.questionType === 'experiment design') {
    return {
      finalAnswer: 'Repeat the experiment, calculate a mean, keep temperature/concentration the same, and use the same apparatus and method each time.',
      reasoningSteps: [
        'Repeat readings reduce random error.',
        'Calculate a mean to improve reliability.',
        'Control variables such as temperature, concentration, mass, and volume.',
        'Use the same apparatus/method so only the intended variable changes.',
      ],
      markSchemeStyleAnswer: [
        'Repeat the experiment [1]',
        'Calculate an average/mean [1]',
        'Control temperature or concentration [1]',
        'Use same apparatus/method or remove anomalies [1]',
      ],
      examTip: 'For reliability, write repeat + mean. For fair test, write control variables.',
      commonMistake: 'Saying "make it accurate" is too vague.',
      practiceNext: 'Practise one rate experiment method question.',
      confidenceBoost: 6,
    }
  }

  if (includesConcept(analysis, 'cracking')) {
    return {
      finalAnswer: 'Cracking breaks long-chain hydrocarbons into shorter-chain alkanes and alkenes. Shorter chains are more useful fuels and in higher demand, while alkenes are useful for making polymers.',
      reasoningSteps: [
        'Crude oil contains many long-chain hydrocarbons.',
        'Cracking breaks long chains into shorter molecules.',
        'Shorter-chain hydrocarbons are more useful fuels / have higher demand.',
        'Alkenes produced can be used to make polymers.',
      ],
      markSchemeStyleAnswer: [
        'Long-chain hydrocarbons are broken down [1]',
        'Shorter-chain hydrocarbons are formed [1]',
        'Shorter chains are more useful/in higher demand as fuels [1]',
        'Alkenes are made and used for polymers [1]',
      ],
      examTip: 'Always mention both products: shorter fuels and alkenes.',
      commonMistake: 'Forgetting the polymer/alkene point.',
      practiceNext: 'Do a 4-mark cracking explanation question.',
      confidenceBoost: 6,
    }
  }

  return null
}

function genericByCommandWord(
  analysis: QuestionAnalysis,
  markSchemePattern: MarkSchemePattern,
  formulas: FormulaRetrieval[],
  theory: TheoryRetrieval[],
  syllabus: SpecificationRetrieval[]
): ExaminerSolution {
  const support = theory[0]
  const formula = formulas[0]
  const learningObjective = syllabus[0]?.learningObjectives?.[0]
  const topic = analysis.topic ?? analysis.chapter ?? analysis.concepts[0] ?? 'this topic'

  if (analysis.commandWord === 'define' || analysis.commandWord === 'state') {
    const short = support?.shortExplanation || formula?.meaning || learningObjective || `Use the key definition for ${topic}.`
    return {
      finalAnswer: short,
      reasoningSteps: [short],
      markSchemeStyleAnswer: markSchemePattern.requiredPoints.slice(0, 3).map((point, index) => `${point} [${index + 1}]`),
      examTip: 'Keep state/define answers short. Keywords matter more than long sentences.',
      commonMistake: markSchemePattern.commonMistakes[0] ?? 'Writing too much but missing the keyword.',
      practiceNext: `Revise the definition and one example for ${topic}.`,
      confidenceBoost: 0,
    }
  }

  if (analysis.commandWord === 'compare') {
    return {
      finalAnswer: `Compare ${topic} by giving one similarity and one clear difference.`,
      reasoningSteps: ['State feature for A.', 'State feature for B.', 'Write the direct difference.', 'Add one similarity if asked.'],
      markSchemeStyleAnswer: ['Point about A [1]', 'Point about B [1]', 'Direct comparison/difference [1]'],
      examTip: 'Use comparative words: both, whereas, but, unlike.',
      commonMistake: 'Describing two things separately without comparing them.',
      practiceNext: `Make a two-column comparison table for ${topic}.`,
      confidenceBoost: 0,
    }
  }

  const core = support?.shortExplanation || formula?.meaning || learningObjective || `Apply the key idea for ${topic} to the exact wording of the question.`
  return {
    finalAnswer: core,
    reasoningSteps: markSchemePattern.requiredPoints.length
      ? markSchemePattern.requiredPoints.slice(0, 4)
      : ['State the cause.', 'Explain the mechanism.', 'Link to the effect.', 'Finish with the conclusion.'],
    markSchemeStyleAnswer: markSchemePattern.requiredPoints.slice(0, 5).map((point, index) => `${point} [${index + 1}]`),
    examTip: `For ${analysis.commandWord === 'unknown' ? 'exam' : analysis.commandWord} questions, link each point back to the question.`,
    commonMistake: markSchemePattern.commonMistakes[0] ?? 'Writing facts without applying them.',
    practiceNext: `Practise one ${analysis.questionType} question on ${topic}.`,
    confidenceBoost: 0,
  }
}

export async function solveLikeExaminer(input: {
  analysis: QuestionAnalysis
  patterns: PatternRetrievalResult
  markSchemePattern: MarkSchemePattern
  formulas: FormulaRetrieval[]
  theory: TheoryRetrieval[]
  syllabus: SpecificationRetrieval[]
}): Promise<ExaminerSolution> {
  const calculation = await solveCalculation(input.analysis)
  if (calculation.finalAnswer && calculation.reasoningSteps && calculation.markSchemeStyleAnswer) {
    return {
      finalAnswer: calculation.finalAnswer,
      reasoningSteps: calculation.reasoningSteps,
      markSchemeStyleAnswer: calculation.markSchemeStyleAnswer,
      examTip: calculation.examTip ?? 'Show the method clearly.',
      commonMistake: calculation.commonMistake ?? 'Missing method marks.',
      practiceNext: 'Try the same formula with different numbers.',
      confidenceBoost: calculation.confidenceBoost ?? 0,
      numericalPhysics: calculation.numericalPhysics ?? null,
      mathResult: calculation.mathResult ?? null,
      calculationVerification: calculation.calculationVerification ?? null,
    }
  }

  const local = localExaminerAnswer(input.analysis)
  const base = local ?? genericByCommandWord(input.analysis, input.markSchemePattern, input.formulas, input.theory, input.syllabus)

  return {
    finalAnswer: base.finalAnswer ?? '',
    reasoningSteps: base.reasoningSteps ?? [],
    markSchemeStyleAnswer: base.markSchemeStyleAnswer ?? [],
    examTip: base.examTip ?? 'Use mark-scheme keywords.',
    commonMistake: base.commonMistake ?? input.markSchemePattern.commonMistakes[0] ?? 'Avoid vague wording.',
    practiceNext: base.practiceNext ?? 'Try one similar past-paper style question.',
    confidenceBoost: base.confidenceBoost ?? 0,
    numericalPhysics: null,
    mathResult: null,
    calculationVerification: null,
  }
}
