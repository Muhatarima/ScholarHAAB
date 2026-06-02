import { analyzeCommandWords } from '@/lib/reasoning/commandWordAnalyzer'
import { analyzeDifficulty } from '@/lib/reasoning/difficultyAnalyzer'

export type QuestionDecomposition = {
  subject: string | null
  chapter: string | null
  topic: string | null
  subtopic: string | null
  concepts: string[]
  formulas: string[]
  difficulty: ReturnType<typeof analyzeDifficulty>
  questionType: string
  commandWords: ReturnType<typeof analyzeCommandWords>
}

const TOPIC_RULES: Array<{
  subject: string
  chapter: string
  topic: string
  subtopic?: string
  regex: RegExp
  concepts: string[]
  formulas: string[]
}> = [
  {
    subject: 'Physics',
    chapter: 'Waves',
    topic: 'Wave Motion',
    regex: /\bwave|frequency|wavelength|amplitude|velocity of a wave|wave speed\b/i,
    concepts: ['wave speed', 'frequency', 'wavelength', 'energy transfer'],
    formulas: ['v = fλ'],
  },
  {
    subject: 'Physics',
    chapter: 'Mechanics',
    topic: 'Mechanics',
    regex: /\bforce|acceleration|suvat|momentum|kinetic energy|velocity-time|distance-time\b/i,
    concepts: ['force', 'acceleration', 'motion graphs'],
    formulas: ['F = ma', 'v = u + at', 's = ut + 1/2at²'],
  },
  {
    subject: 'Chemistry',
    chapter: 'Atomic Structure and Bonding',
    topic: 'Chemical Bonding',
    regex: /\bbonding|ionic|covalent|metallic|electron transfer|shared pair\b/i,
    concepts: ['outer shell', 'electron transfer', 'shared pair', 'electrostatic attraction'],
    formulas: [],
  },
  {
    subject: 'Biology',
    chapter: 'Cells and Transport',
    topic: 'Cell Biology',
    regex: /\bcell|nucleus|osmosis|diffusion|membrane|chloroplast|mitochondria\b/i,
    concepts: ['cell structure', 'transport', 'membrane'],
    formulas: [],
  },
  {
    subject: 'Mathematics',
    chapter: 'Calculus',
    topic: 'Differentiation',
    regex: /\bdifferentiate|derivative|dy\/dx|stationary point\b/i,
    concepts: ['Differentiation', 'Functions', 'Gradient'],
    formulas: ['d/dx(xⁿ) = nxⁿ⁻¹'],
  },
  {
    subject: 'Mathematics',
    chapter: 'Calculus',
    topic: 'Integration',
    regex: /\bintegrat|∫|area under\b/i,
    concepts: ['Integration', 'Differentiation', 'Area under curve'],
    formulas: ['∫xⁿ dx = xⁿ⁺¹/(n+1) + C'],
  },
  {
    subject: 'Economics',
    chapter: 'Macroeconomics',
    topic: 'Inflation',
    regex: /\binflation|price level|cpi\b/i,
    concepts: ['Inflation', 'Price Level', 'Purchasing Power'],
    formulas: [],
  },
]

function inferQuestionType(command: string) {
  if (command === 'calculate' || command === 'solve') return 'calculation'
  if (command === 'explain' || command === 'justify') return 'explanation'
  if (command === 'compare') return 'comparison'
  if (command === 'evaluate' || command === 'discuss') return 'evaluation'
  return 'short-answer'
}

export function decomposeQuestion(question: string, hints: { subject?: string | null; topic?: string | null } = {}): QuestionDecomposition {
  const commandWords = analyzeCommandWords(question)
  const matched = TOPIC_RULES.find((rule) => rule.regex.test(question) || (hints.topic && rule.topic.toLowerCase() === hints.topic.toLowerCase()))
  const concepts = matched?.concepts ?? (hints.topic ? [hints.topic] : [])
  const formulas = matched?.formulas ?? []
  const difficulty = analyzeDifficulty({ question, concepts, formulas, command: commandWords })

  return {
    subject: hints.subject ?? matched?.subject ?? null,
    chapter: matched?.chapter ?? null,
    topic: hints.topic ?? matched?.topic ?? null,
    subtopic: matched?.subtopic ?? null,
    concepts,
    formulas,
    difficulty,
    questionType: inferQuestionType(commandWords.primaryCommand),
    commandWords,
  }
}
