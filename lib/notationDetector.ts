const SUBSCRIPT_MAP: Record<string, string> = {
  '₀': '0',
  '₁': '1',
  '₂': '2',
  '₃': '3',
  '₄': '4',
  '₅': '5',
  '₆': '6',
  '₇': '7',
  '₈': '8',
  '₉': '9',
  '₊': '+',
  '₋': '-',
}

const SUPERSCRIPT_MAP: Record<string, string> = {
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
  '⁺': '+',
  '⁻': '-',
  '⁽': '(',
  '⁾': ')',
}

const FRACTION_MAP: Record<string, string> = {
  '¼': '\\frac{1}{4}',
  '½': '\\frac{1}{2}',
  '¾': '\\frac{3}{4}',
  '⅓': '\\frac{1}{3}',
  '⅔': '\\frac{2}{3}',
  '⅛': '\\frac{1}{8}',
  '⅜': '\\frac{3}{8}',
  '⅝': '\\frac{5}{8}',
  '⅞': '\\frac{7}{8}',
}

const GREEK_MAP: Record<string, string> = {
  α: '\\alpha',
  β: '\\beta',
  γ: '\\gamma',
  δ: '\\delta',
  Δ: '\\Delta',
  θ: '\\theta',
  Θ: '\\Theta',
  λ: '\\lambda',
  μ: '\\mu',
  π: '\\pi',
  ρ: '\\rho',
  σ: '\\sigma',
  ω: '\\omega',
  Ω: '\\Omega',
}

const WORD_OPERATORS = new Set(['sin', 'cos', 'tan', 'log', 'ln', 'lim'])
const CHEMICAL_FORMULA_PATTERN =
  /(?:\b(?:[A-Z][a-z]?[\d₀-₉]*|[()]){2,}(?:[²³¹⁰⁴⁵⁶⁷⁸⁹⁺⁻]+)?\b|\b(?:mol|dm|kg|ms|m|s|N|J|V|A|Ω)(?:[⁻⁰¹²³⁴⁵⁶⁷⁸⁹-]+)?\b)/
const CHEMICAL_EQUATION_PATTERN =
  /(?:\b\d*)?(?:[A-Z][a-z]?[\d₀-₉]*|[()]){2,}(?:[²³¹⁰⁴⁵⁶⁷⁸⁹⁺⁻]+)?(?:\s*(?:\+|→|⇌|<=>|->)\s*(?:\d*)?(?:[A-Z][a-z]?[\d₀-₉]*|[()]){2,}(?:[²³¹⁰⁴⁵⁶⁷⁸⁹⁺⁻]+)?)+/u
const MATH_TOKEN_PATTERN =
  /(?:\b(?:d[²2]?y\/d[²2]?x[²2]?|dy\/dx|d2y\/dx2|∂[A-Za-z]\/∂[A-Za-z]|lim(?:_\{?[^}\s]+\}?)?|sin[²³⁻¹0-9]*[A-Za-zθπ]?|cos[²³⁻¹0-9]*[A-Za-zθπ]?|tan[²³⁻¹0-9]*[A-Za-zθπ]?|log[₀-₉0-9]*|ln)\b|[A-Za-z]⃗|[A-Za-zθπλμ][₀-₉0-9]*[²³⁰¹⁴⁵⁶⁷⁸⁹⁻⁺^]?(?:\s*[+\-−=*/×÷]\s*[A-Za-z0-9θπλμ√∛][A-Za-z0-9₀-₉²³⁰¹⁴⁵⁶⁷⁸⁹⁻⁺^]*)+|[A-Za-zθπλμ][₀-₉0-9]*[²³⁰¹⁴⁵⁶⁷⁸⁹⁻⁺^]+|√\s*[A-Za-z0-9]+|∛\s*[A-Za-z0-9]+|∫[^\s,.;:)]*|∑[^\s,.;:)]*|\d+(?:\.\d+)?\s*(?:×|x)\s*10[⁻⁺²³⁰¹⁴⁵⁶⁷⁸⁹^+-]*|\d+(?:\.\d+)?\s*(?:m\/s²|ms⁻²|kgm⁻³|mol\s*dm⁻³|nm|kg|m|s|N|J|V|A)\b|[¼½¾⅓⅔⅛⅜⅝⅞]|[A-Za-z]\s*=\s*[A-Za-z0-9θπλμ√∛][^,.;\n]*)/u

export function containsNotation(text: string) {
  return (
    /\$[^$]+\$|\\(?:frac|int|sum|sqrt|ce)\b|[\^_{}]/.test(text) ||
    /[₀-₉⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻¼½¾⅓⅔⅛⅜⅝⅞√∛∫∑π∞≤≥≠±×÷→⇌∂λθαβγΔ⃗]/u.test(text) ||
    CHEMICAL_EQUATION_PATTERN.test(text) ||
    CHEMICAL_FORMULA_PATTERN.test(text) ||
    MATH_TOKEN_PATTERN.test(text)
  )
}

function consumeScript(source: string, index: number, map: Record<string, string>) {
  let cursor = index
  let value = ''
  while (cursor < source.length && map[source[cursor]]) {
    value += map[source[cursor]]
    cursor += 1
  }
  return { value, cursor }
}

function convertUnicodeScripts(source: string) {
  let output = ''
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    if (SUBSCRIPT_MAP[char]) {
      const consumed = consumeScript(source, index, SUBSCRIPT_MAP)
      output += `_{${consumed.value}}`
      index = consumed.cursor - 1
      continue
    }
    if (SUPERSCRIPT_MAP[char]) {
      const consumed = consumeScript(source, index, SUPERSCRIPT_MAP)
      output += `^{${consumed.value}}`
      index = consumed.cursor - 1
      continue
    }
    output += char
  }
  return output
}

function convertPlainScripts(source: string) {
  return source
    .replace(/\^([+-]?\d+|[A-Za-z])/g, '^{$1}')
    .replace(/_([+-]?\d+|[A-Za-z])/g, '_{$1}')
    .replace(/([A-Za-z])(\d+)(?=[A-Za-z]|$)/g, '$1_{$2}')
}

function convertDerivative(source: string) {
  return source
    .replace(/\bd2y\/dx2\b/gi, '\\frac{d^{2}y}{dx^{2}}')
    .replace(/\bd²y\/dx²\b/gi, '\\frac{d^{2}y}{dx^{2}}')
    .replace(/\bdy\/dx\b/gi, '\\frac{dy}{dx}')
    .replace(/∂([A-Za-z])\/∂([A-Za-z])/g, '\\frac{\\partial $1}{\\partial $2}')
}

function convertMathText(raw: string) {
  let text = raw.trim()
  text = convertDerivative(text)
  text = text.replace(/[¼½¾⅓⅔⅛⅜⅝⅞]/g, (match) => FRACTION_MAP[match] ?? match)
  text = convertUnicodeScripts(text)
  text = convertPlainScripts(text)
  text = text
    .replace(/√\s*([A-Za-z0-9]+)/g, '\\sqrt{$1}')
    .replace(/∛\s*([A-Za-z0-9]+)/g, '\\sqrt[3]{$1}')
    .replace(/∫/g, '\\int ')
    .replace(/∑|Σ/g, '\\sum ')
    .replace(/∞/g, '\\infty')
    .replace(/≤/g, '\\le')
    .replace(/≥/g, '\\ge')
    .replace(/≠/g, '\\ne')
    .replace(/±/g, '\\pm')
    .replace(/×/g, '\\times ')
    .replace(/÷/g, '\\div ')
    .replace(/−/g, '-')
    .replace(/→/g, '\\to ')
    .replace(/([A-Za-z])⃗/gu, '\\vec{$1}')
    .replace(/\b([A-Za-z])\s*=\s*/g, '$1 = ')
    .replace(/\b(sin|cos|tan|log|ln|lim)\b/g, (_, op: string) =>
      WORD_OPERATORS.has(op) ? `\\${op}` : op
    )

  for (const [symbol, latex] of Object.entries(GREEK_MAP)) {
    text = text.replace(new RegExp(symbol, 'g'), latex)
  }

  text = text.replace(/\\int\s*([A-Za-z0-9_{}^+\-*/\\ ]+)\s*d([A-Za-z])/g, '\\int $1\\, d$2')
  return text.replace(/\s+/g, ' ').trim()
}

function normalizeChemistryText(raw: string) {
  return raw
    .trim()
    .replace(/₀|₁|₂|₃|₄|₅|₆|₇|₈|₉/g, (match) => SUBSCRIPT_MAP[match] ?? match)
    .replace(/([A-Za-z])([⁰¹²³⁴⁵⁶⁷⁸⁹]+)([⁺⁻])/g, (_, element: string, amount: string, sign: string) => {
      const charge = amount
        .split('')
        .map((char: string) => SUPERSCRIPT_MAP[char] ?? char)
        .join('')
      return `${element}^${charge}${SUPERSCRIPT_MAP[sign]}`
    })
    .replace(/([A-Za-z])([⁺⁻])/g, (_, element: string, sign: string) => `${element}^${SUPERSCRIPT_MAP[sign]}`)
    .replace(/→/g, '->')
    .replace(/⇌/g, '<=>')
}

export function toLatexNotation(raw: string, kind: 'auto' | 'math' | 'chem' = 'auto') {
  const text = raw.trim()
  if (!text) {
    return ''
  }

  if (kind === 'chem' || (kind === 'auto' && CHEMICAL_EQUATION_PATTERN.test(text))) {
    return `\\ce{${normalizeChemistryText(text)}}`
  }

  return convertMathText(text)
}

function shouldTreatAsChemistry(match: string) {
  return CHEMICAL_EQUATION_PATTERN.test(match) || /[A-Z][a-z]?[₀-₉\d]*(?:[A-Z][a-z]?|[₀-₉\d]|[²³¹⁰⁴⁵⁶⁷⁸⁹⁺⁻])/.test(match)
}

function protectExistingMath(text: string) {
  const protectedParts: string[] = []
  const mathProtected = text.replace(/\$\$[\s\S]*?\$\$|\$[^$\n][\s\S]*?\$/g, (match) => {
    const token = `@@MATH_${protectedParts.length}@@`
    protectedParts.push(match)
    return token
  })

  let tokenized = ''
  let cursor = 0
  while (cursor < mathProtected.length) {
    const consumed = consumeBareLatexCommand(mathProtected, cursor)
    if (consumed) {
      const token = `@@MATH_${protectedParts.length}@@`
      protectedParts.push(`$${mathProtected.slice(cursor, consumed)}$`)
      tokenized += token
      cursor = consumed
      continue
    }

    tokenized += mathProtected[cursor]
    cursor += 1
  }

  return { tokenized, protectedParts }
}

function consumeBraceGroup(source: string, index: number) {
  if (source[index] !== '{') {
    return null
  }

  let depth = 0
  for (let cursor = index; cursor < source.length; cursor += 1) {
    const char = source[cursor]
    if (char === '\\') {
      cursor += 1
      continue
    }
    if (char === '{') depth += 1
    if (char === '}') depth -= 1
    if (depth === 0) return cursor + 1
  }

  return null
}

function consumeBracketGroup(source: string, index: number) {
  if (source[index] !== '[') {
    return null
  }

  let depth = 0
  for (let cursor = index; cursor < source.length; cursor += 1) {
    const char = source[cursor]
    if (char === '\\') {
      cursor += 1
      continue
    }
    if (char === '[') depth += 1
    if (char === ']') depth -= 1
    if (depth === 0) return cursor + 1
  }

  return null
}

function consumeBareLatexCommand(source: string, index: number) {
  if (source[index] !== '\\') {
    return null
  }

  const match = /^\\([A-Za-z]+)/.exec(source.slice(index))
  const command = match?.[1]
  if (!command || !/^(ce|frac|sqrt|text|mathrm|mathbf|alpha|beta|gamma|delta|Delta|theta|Theta|lambda|mu|pi|rho|sigma|omega|Omega|int|sum)$/.test(command)) {
    return null
  }

  let cursor = index + command.length + 1
  if (command === 'frac') {
    const numeratorEnd = consumeBraceGroup(source, cursor)
    if (!numeratorEnd) return cursor
    const denominatorEnd = consumeBraceGroup(source, numeratorEnd)
    return denominatorEnd ?? numeratorEnd
  }

  if (command === 'sqrt') {
    const optionalEnd = consumeBracketGroup(source, cursor)
    if (optionalEnd) cursor = optionalEnd
    return consumeBraceGroup(source, cursor) ?? cursor
  }

  const braceEnd = consumeBraceGroup(source, cursor)
  return braceEnd ?? cursor
}

function restoreExistingMath(text: string, protectedParts: string[]) {
  return text.replace(/@@MATH_(\d+)@@/g, (_, index: string) => protectedParts[Number(index)] ?? '')
}

export function detectAndWrapNotation(text: string) {
  const { tokenized, protectedParts } = protectExistingMath(text)
  let output = ''
  let cursor = 0
  const matcher = new RegExp(
    `${CHEMICAL_EQUATION_PATTERN.source}|${CHEMICAL_FORMULA_PATTERN.source}|${MATH_TOKEN_PATTERN.source}`,
    'gu'
  )

  for (const match of tokenized.matchAll(matcher)) {
    const value = match[0]
    const index = match.index ?? 0
    if (!value.trim()) {
      continue
    }
    output += tokenized.slice(cursor, index)
    const kind = shouldTreatAsChemistry(value) ? 'chem' : 'math'
    output += `$${toLatexNotation(value, kind)}$`
    cursor = index + value.length
  }

  output += tokenized.slice(cursor)
  return restoreExistingMath(output, protectedParts)
}

export const notationTestCases = [
  'Find the integral of x² + 3x',
  'CH₄ + 2O₂ → CO₂ + 2H₂O',
  'Calculate velocity if s = 20m, t = 4s',
  'Solve: dy/dx = 3x² - 2x + 1',
  'The wavelength λ = 650nm',
  'x², x³, √x, ∛x, ∫, ∑, π, ∞, ≤, ≥, ≠',
  '½, ¾, dy/dx',
  '∫x²dx, ∫₀^∞, ∫u dv = uv - ∫v du',
  'sin²θ, cos⁻¹x, tan(45°)',
  'H₂O, CO₂, CH₄, H₂SO₄, Ca²⁺, Fe³⁺',
  'ms⁻², kgm⁻³, 3×10⁸, E=mc²',
  'F⃗, v⃗',
]
