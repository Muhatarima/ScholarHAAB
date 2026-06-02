import { classifyIntent } from '@/lib/rag/classifyIntent'

export type CommandWord =
  | 'state'
  | 'define'
  | 'calculate'
  | 'describe'
  | 'explain'
  | 'compare'
  | 'evaluate'
  | 'suggest'
  | 'justify'
  | 'show that'
  | 'prove'
  | 'unknown'

export type QuestionType =
  | 'calculation'
  | 'explanation'
  | 'graph interpretation'
  | 'diagram labeling'
  | 'experiment design'
  | 'data analysis'
  | 'theory recall'
  | 'multi-step reasoning'

export type QuestionQuantity = {
  value: number
  unit: string
  raw: string
}

export type QuestionAnalysis = {
  rawQuestion: string
  normalizedQuestion: string
  board: string | null
  level: string | null
  subject: string | null
  paperType: string | null
  year: number | null
  topic: string | null
  chapter: string | null
  subtopic: string | null
  commandWord: CommandWord
  concepts: string[]
  quantities: QuestionQuantity[]
  formulasNeeded: string[]
  difficulty: 'foundation' | 'core' | 'extension'
  questionType: QuestionType
  skippedChapter: string | null
  emotionalState: 'stressed' | 'confused' | 'neutral'
}

const COMMAND_PATTERNS: Array<[CommandWord, RegExp]> = [
  ['show that', /\bshow\s+that\b/i],
  ['define', /\bdefine\b/i],
  ['state', /\bstate|name|identify\b/i],
  ['calculate', /\bcalculate|find|determine|work\s*out|solve\b/i],
  ['describe', /\bdescribe|outline\b/i],
  ['explain', /\bexplain|why|how\b/i],
  ['compare', /\bcompare|difference|similarity|distinguish\b/i],
  ['evaluate', /\bevaluate|assess|judge\b/i],
  ['suggest', /\bsuggest|predict\b/i],
  ['justify', /\bjustify|give\s+a\s+reason\b/i],
  ['prove', /\bprove\b/i],
]

const CONCEPT_PATTERNS: Array<[RegExp, string]> = [
  [/\bresistance|metal wire|current|voltage|ohm\b/i, 'resistance'],
  [/\btemperature|heat|thermal\b/i, 'temperature'],
  [/\bion|electron|collision|lattice\b/i, 'particle collision'],
  [/\brate of reaction|reaction rate|reliability|repeat|average\b/i, 'rates of reaction'],
  [/\bcracking|hydrocarbon|alkane|alkene|polymer\b/i, 'cracking'],
  [/\bwave|frequency|wavelength|amplitude\b/i, 'waves'],
  [/\bforce|acceleration|newton|motion\b/i, 'forces and motion'],
  [/\benergy|work done|kinetic|gravitational\b/i, 'energy'],
  [/\bbonding|ionic|covalent|electron transfer\b/i, 'chemical bonding'],
  [/\bderivative|differentiate|dy\/dx|integration|integral|sin|cos\b/i, 'calculus'],
  [/\bgraph|axis|gradient|plot|sketch\b/i, 'graph'],
]

function detectCommandWord(text: string): CommandWord {
  for (const [command, pattern] of COMMAND_PATTERNS) {
    if (pattern.test(text)) return command
  }
  return 'unknown'
}

function detectQuestionType(text: string, commandWord: CommandWord): QuestionType {
  if (/\bgraph|axis|gradient|plot|sketch\b/i.test(text)) return 'graph interpretation'
  if (/\bdiagram|label\b/i.test(text)) return 'diagram labeling'
  if (/\bexperiment|investigation|method|reliability|apparatus|control variable|repeat\b/i.test(text)) return 'experiment design'
  if (/\btable|data|trend|anomal|mean|average\b/i.test(text)) return 'data analysis'
  if (commandWord === 'calculate' || /\b\d+(?:\.\d+)?\s*(?:m\/s|m s-1|m|s|kg|n|j|v|a|ohm|hz)\b/i.test(text)) {
    return 'calculation'
  }
  if (commandWord === 'state' || commandWord === 'define') return 'theory recall'
  if (commandWord === 'explain' || commandWord === 'justify' || commandWord === 'suggest') return 'explanation'
  return 'multi-step reasoning'
}

function detectPaperType(text: string) {
  const paperMatch = text.match(/\bpaper\s*([1-6])\b/i)
  if (paperMatch) return `Paper ${paperMatch[1]}`
  const componentMatch = text.match(/\b(component|unit)\s*([0-9a-z]+)\b/i)
  return componentMatch ? `${componentMatch[1]} ${componentMatch[2]}` : null
}

function detectQuantities(text: string): QuestionQuantity[] {
  const quantities: QuestionQuantity[] = []
  const pattern = /(-?\d+(?:\.\d+)?)\s*(m\/s|m\s*s-1|m\s*s\^-1|m|s|kg|n|j|v|a|ohm|hz|mol\/dm3|cm3|dm3|c)\b/gi
  let match = pattern.exec(text)
  while (match) {
    quantities.push({
      value: Number(match[1]),
      unit: match[2].replace(/\s+/g, ' '),
      raw: match[0],
    })
    match = pattern.exec(text)
  }
  return quantities
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function detectConcepts(text: string) {
  return unique(CONCEPT_PATTERNS.filter(([pattern]) => pattern.test(text)).map(([, concept]) => concept))
}

function detectFormulas(concepts: string[], text: string) {
  const formulas: string[] = []
  if (concepts.includes('waves')) formulas.push('v = f x wavelength')
  if (concepts.includes('forces and motion')) formulas.push('F = ma', 'v^2 = u^2 + 2as')
  if (concepts.includes('energy')) formulas.push('E_k = 1/2 mv^2', 'W = Fd')
  if (concepts.includes('resistance')) formulas.push('V = IR')
  if (/\bdy\/dx|differentiate|derivative\b/i.test(text)) formulas.push('product rule / differentiation rules')
  if (/\bintegrat|area under\b/i.test(text)) formulas.push('integration rules')
  return unique(formulas)
}

function inferDifficulty(text: string, questionType: QuestionType): QuestionAnalysis['difficulty'] {
  if (/\bevaluate|justify|multi-step|prove|show that|extension\b/i.test(text)) return 'extension'
  if (questionType === 'calculation' || questionType === 'experiment design') return 'core'
  return 'foundation'
}

function inferChapter(topic: string | null, concepts: string[]) {
  if (topic) return topic
  if (concepts.includes('resistance')) return 'Electricity'
  if (concepts.includes('cracking')) return 'Organic Chemistry'
  if (concepts.includes('rates of reaction')) return 'Rates of Reaction'
  if (concepts.includes('calculus')) return 'Calculus'
  return null
}

export function analyzeQuestion(rawQuestion: string): QuestionAnalysis {
  const classified = classifyIntent(rawQuestion)
  const normalizedQuestion = classified.normalizedQuery
  const commandWord = detectCommandWord(normalizedQuestion)
  const questionType = detectQuestionType(normalizedQuestion, commandWord)
  const concepts = detectConcepts(normalizedQuestion)
  const quantities = detectQuantities(normalizedQuestion)

  return {
    rawQuestion,
    normalizedQuestion,
    board: classified.board,
    level: classified.level,
    subject: classified.subject,
    paperType: detectPaperType(normalizedQuestion),
    year: classified.year,
    topic: classified.topic,
    chapter: inferChapter(classified.topic, concepts),
    subtopic: concepts[0] ?? null,
    commandWord,
    concepts,
    quantities,
    formulasNeeded: detectFormulas(concepts, normalizedQuestion),
    difficulty: inferDifficulty(normalizedQuestion, questionType),
    questionType,
    skippedChapter: classified.skippedChapter,
    emotionalState: classified.emotionalState,
  }
}
