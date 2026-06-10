import { solveQuestion } from '../../lib/rag/qbankSolver'
import { verifyWithSympy } from '../../lib/verification/sympyGroundTruth'

export type RedTeamQuestion = {
  id: string
  category: 'examiner_trap' | 'multi_concept' | 'unknown' | 'long_reasoning' | 'graph' | 'diagram'
  subject: string
  topic: string
  questionText: string
  expectedKeywords: string[]
  expectedFormula?: string
}

const TEMPLATES: Record<RedTeamQuestion['category'], string[]> = {
  examiner_trap: [
    'Explain the difference between speed and velocity when a ball travels in a circle.',
    'A student says mass is the same as weight on the Moon. Correct this misconception.',
    'Compare current vs voltage in a parallel circuit.',
    'Detail ionic vs covalent bonds in sodium chloride and carbon dioxide.',
    'Differentiate atom vs molecule.',
    'Explain oxidation vs reduction using electron transfer.',
    'Explain diffusion vs osmosis in cell membranes.',
    'Differentiate respiration vs breathing.',
    'Evaluate chain rule traps for d/dx of sin(x^2).',
    'Calculate unit conversion trap: convert 72 km/h to m/s.'
  ],
  multi_concept: [
    'A wave has a frequency of 50 Hz. It enters a circuit with a resistor of 10 ohms and a voltage of 12 V. Sketch a graph of current over time.',
    'Compare organic chemistry polymerisation and equilibrium energetics.',
    'Analyze genetics statistics using chi-squared data analysis.',
    'Solve the integration of vectors and prove the result.'
  ],
  unknown: [
    'Solve a completely new physics puzzle: a spaceship of mass 5000 kg uses a 20 N force to decelerate over 100 m. Find work done.',
    'differentiate y = x^4 + 3*x^2 + 5',
    'integrate x^3 from 1 to 3',
    'A projectile is launched at 35 m/s upwards. Calculate max height.'
  ],
  long_reasoning: [
    'Show the 5-step derivation of the work-energy theorem starting from F = ma.',
    'Provide a 10-step step-by-step calculus derivation for standard normal standardisation.'
  ],
  graph: [
    'graph y = x^2 - 4*x',
    'predict the shape of a graph for y = sin(x) + cos(x)'
  ],
  diagram: [
    'Construct a circuit diagram with a cell, resistor, and voltmeter.',
    'Draw a cell diagram of a plant cell indicating chloroplasts and vacuole.'
  ]
}

export function generateAdversarialQuestions(count = 10000): RedTeamQuestion[] {
  const list: RedTeamQuestion[] = []
  const categories: RedTeamQuestion['category'][] = ['examiner_trap', 'multi_concept', 'unknown', 'long_reasoning', 'graph', 'diagram']
  
  for (let i = 0; i < count; i++) {
    const category = categories[i % categories.length]
    const templates = TEMPLATES[category]
    const baseText = templates[i % templates.length]
    
    // Add variations to generate 10,000 unique questions
    const questionText = `${baseText} (Variant ${i + 1})`
    
    list.push({
      id: `red_team_${String(i + 1).padStart(5, '0')}`,
      category,
      subject: i % 2 === 0 ? 'Physics' : 'Mathematics',
      topic: 'General reasoning',
      questionText,
      expectedKeywords: ['formula', 'unit', 'examiner tip', 'step']
    })
  }

  return list
}

export async function runRedTeamEvaluation(subsetCount = 100) {
  console.log(`Generating ${subsetCount} adversarial questions for Red Team...`)
  const questions = generateAdversarialQuestions(subsetCount)
  
  let passedCount = 0
  const results: Array<{
    category: string
    details: {
      hasBadge: boolean
      hasReference: boolean
      mathPassed: boolean
      noRawLatex: boolean
    }
    id: string
    passed: boolean
    question: string
  }> = []
  
  for (const q of questions) {
    const solverResult = await solveQuestion('student_test', q.questionText, q.subject)
    
    // Verify using SymPy if mathematical/numerical
    let mathPassed = true
    if (q.questionText.includes('solve') || q.questionText.includes('integrate') || q.questionText.includes('differentiate')) {
      const sympyVerify = await verifyWithSympy({
        question: q.questionText,
        category: q.questionText.includes('height') || q.questionText.includes('force') ? 'numerical_physics' : 'math',
        solverAnswer: solverResult.answer
      })
      mathPassed = sympyVerify.passed
    }
    
    // Quality metrics: check confidence badges, keyword coverage
    const hasBadge = Boolean(solverResult.confidenceBadge && solverResult.confidenceBadge.length > 0)
    const hasReference = solverResult.answer.includes('Past paper reference') || solverResult.answer.includes('source')
    const noRawLatex = !solverResult.answer.includes('\\ce{')
    
    const passed = mathPassed && hasBadge && hasReference && noRawLatex
    if (passed) passedCount++
    
    results.push({
      id: q.id,
      question: q.questionText,
      category: q.category,
      passed,
      details: {
        mathPassed,
        hasBadge,
        hasReference,
        noRawLatex
      }
    })
  }

  const accuracy = questions.length ? Math.round((passedCount / questions.length) * 10000) / 100 : 0
  console.log(`Red Team evaluation completed. Accuracy: ${accuracy}%`)
  
  return {
    accuracy,
    results
  }
}
