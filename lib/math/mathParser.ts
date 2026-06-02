export type MathIntent =
  | 'differentiate'
  | 'integrate'
  | 'solve_equation'
  | 'quadratic'
  | 'simultaneous'
  | 'matrix'
  | 'vector'
  | 'statistics'
  | 'mechanics'
  | 'graph'
  | 'formula'
  | 'unknown'

export type ParsedMathProblem = {
  intent: MathIntent
  normalizedQuestion: string
  expression: string | null
  variable: string
  lowerLimit: number | null
  upperLimit: number | null
  equations: string[]
}

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
  '⁻': '-',
  '⁺': '+',
}

function normalizePowers(value: string) {
  return value.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]+/g, (match) => {
    const converted = match
      .split('')
      .map((char) => SUPERSCRIPT_DIGITS[char] ?? char)
      .join('')
    return `^${converted}`
  })
}

function normalizeMathText(raw: string) {
  return normalizePowers(raw)
    .replace(/−/g, '-')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/√\s*/g, 'sqrt')
    .replace(/\s+/g, ' ')
    .trim()
}

function expressionAfter(text: string, pattern: RegExp) {
  const match = text.match(pattern)
  return match?.[1]?.replace(/\bwith respect to\b.*$/i, '').replace(/\bfrom\b.*$/i, '').trim() || null
}

function parseLimits(text: string) {
  const match = text.match(/\bfrom\s+(-?\d+(?:\.\d+)?)\s+to\s+(-?\d+(?:\.\d+)?)/i)
  return {
    lowerLimit: match ? Number(match[1]) : null,
    upperLimit: match ? Number(match[2]) : null,
  }
}

function inferExpression(text: string, intent: MathIntent) {
  if (intent === 'differentiate') {
    return (
      expressionAfter(text, /differentiat(?:e|ion)?\s+(?:y\s*=\s*)?(.+?)(?=$|,|;)/i) ??
      expressionAfter(text, /dy\/dx\s+of\s+(.+?)(?=$|,|;)/i) ??
      expressionAfter(text, /y\s*=\s*(.+?)(?=$|,|;)/i)
    )
  }

  if (intent === 'integrate') {
    return (
      expressionAfter(text, /integrat(?:e|ion)?\s+(.+?)(?=$|,|;)/i) ??
      expressionAfter(text, /∫\s*(.+?)(?:d[xy])?(?=$|,|;)/i)
    )
  }

  if (intent === 'graph') {
    return expressionAfter(text, /(?:graph|plot|sketch)\s+(?:y\s*=\s*)?(.+?)(?=$|,|;)/i) ?? expressionAfter(text, /y\s*=\s*(.+?)(?=$|,|;)/i)
  }

  return expressionAfter(text, /(?:solve|find)\s+(.+?)(?=$|,|;)/i)
}

function inferIntent(text: string): MathIntent {
  const lower = text.toLowerCase()
  if (/\bdifferentiat|derivative|dy\/dx/.test(lower)) return 'differentiate'
  if (/\bintegrat|integral|∫/.test(lower)) return 'integrate'
  if (/\bquadratic|b\^2\s*-\s*4ac|ax\^2/.test(lower)) return 'quadratic'
  if (/\bsimultaneous|system of equations/.test(lower)) return 'simultaneous'
  if (/\bmatrix|determinant|inverse matrix/.test(lower)) return 'matrix'
  if (/\bvector|dot product|cross product|magnitude/.test(lower)) return 'vector'
  if (/\bnormal distribution|binomial|probability|z[- ]?score|histogram/.test(lower)) return 'statistics'
  if (/\bsuvat|momentum|kinetic energy|work done|force|acceleration/.test(lower)) return 'mechanics'
  if (/\bgraph|plot|sketch|y\s*=/.test(lower)) return 'graph'
  if (/\bformula|equation for|derive/.test(lower)) return 'formula'
  if (/\bsolve\b.*=/.test(lower)) return 'solve_equation'
  return 'unknown'
}

export function parseMathQuestion(raw: string): ParsedMathProblem {
  const normalizedQuestion = normalizeMathText(raw)
  const intent = inferIntent(normalizedQuestion)
  const limits = parseLimits(normalizedQuestion)
  const equations = normalizedQuestion
    .split(/\band\b|,|;/i)
    .map((part) => part.trim())
    .filter((part) => /=/.test(part))

  return {
    intent,
    normalizedQuestion,
    expression: inferExpression(normalizedQuestion, intent),
    variable: /\bwith respect to\s+([a-z])\b/i.exec(normalizedQuestion)?.[1] ?? 'x',
    ...limits,
    equations,
  }
}

export function isLikelyMathQuestion(raw: string) {
  const parsed = parseMathQuestion(raw)
  return parsed.intent !== 'unknown'
}
