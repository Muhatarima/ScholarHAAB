export type FormulaCard = {
  subject: string
  topic: string
  formula: string
  whenToUse: string
  commonMistake: string
  examTip: string
}

const FORMULAS: FormulaCard[] = [
  {
    subject: 'Mathematics',
    topic: 'Differentiation',
    formula: 'If y = ax^n, then dy/dx = anx^(n-1)',
    whenToUse: 'Use for polynomial terms in calculus questions.',
    commonMistake: 'Substituting x before differentiating.',
    examTip: 'Differentiate first, then substitute if the question asks for a gradient at a point.',
  },
  {
    subject: 'Mathematics',
    topic: 'Integration',
    formula: '∫x^n dx = x^(n+1)/(n+1) + C',
    whenToUse: 'Use for polynomial integration, area under curves, and reverse differentiation.',
    commonMistake: 'Forgetting + C in indefinite integration or forgetting lower-limit subtraction.',
    examTip: 'Show the integrated expression before applying limits to secure method marks.',
  },
  {
    subject: 'Mathematics',
    topic: 'Quadratics',
    formula: 'x = (-b ± √(b² - 4ac)) / 2a',
    whenToUse: 'Use when factorising is difficult or the roots are irrational/decimal.',
    commonMistake: 'Using the wrong sign for b or forgetting the denominator 2a.',
    examTip: 'Put the equation in ax² + bx + c = 0 first.',
  },
  {
    subject: 'Statistics',
    topic: 'Normal Distribution',
    formula: 'z = (x - μ) / σ',
    whenToUse: 'Use to standardise a normal random variable before table/calculator lookup.',
    commonMistake: 'Using variance instead of standard deviation.',
    examTip: 'Sketch the tail direction before using the z-value.',
  },
  {
    subject: 'Physics',
    topic: 'Mechanics',
    formula: 'v = u + at, s = ut + 1/2at², v² = u² + 2as',
    whenToUse: 'Use SUVAT when acceleration is constant.',
    commonMistake: 'Mixing signs for upward/downward motion.',
    examTip: 'Write known values with units before choosing the equation.',
  },
]

export function getFormulaCards(query: string, limit = 3) {
  const lower = query.toLowerCase()
  return FORMULAS.filter((card) => {
    const text = `${card.subject} ${card.topic} ${card.formula}`.toLowerCase()
    return text.split(/\s+/).some((word) => word.length > 4 && lower.includes(word)) || lower.includes(card.topic.toLowerCase())
  }).slice(0, limit)
}

export function getPrimaryFormula(query: string) {
  return getFormulaCards(query, 1)[0] ?? null
}
