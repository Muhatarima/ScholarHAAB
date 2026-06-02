export type CommandWord =
  | 'calculate'
  | 'state'
  | 'define'
  | 'describe'
  | 'explain'
  | 'discuss'
  | 'compare'
  | 'evaluate'
  | 'justify'
  | 'solve'
  | 'unknown'

export type CommandWordAnalysis = {
  commandWords: CommandWord[]
  primaryCommand: CommandWord
  answerStyle: string
  requiredStructure: string[]
}

const COMMANDS: Array<{ command: CommandWord; regex: RegExp }> = [
  { command: 'calculate', regex: /\bcalculate|find the value|work out|determine\b/i },
  { command: 'state', regex: /\bstate|write down|give\b/i },
  { command: 'define', regex: /\bdefine|what is|meaning of\b/i },
  { command: 'describe', regex: /\bdescribe|outline\b/i },
  { command: 'explain', regex: /\bexplain|why|keno|bujhao|bujhiye\b/i },
  { command: 'discuss', regex: /\bdiscuss|consider\b/i },
  { command: 'compare', regex: /\bcompare|difference|distinguish\b/i },
  { command: 'evaluate', regex: /\bevaluate|assess|to what extent\b/i },
  { command: 'justify', regex: /\bjustify|show that|prove\b/i },
  { command: 'solve', regex: /\bsolve|solution|root\b/i },
]

function structureFor(command: CommandWord) {
  if (command === 'calculate' || command === 'solve') {
    return ['write formula', 'substitute values', 'calculate carefully', 'include units/rounding']
  }
  if (command === 'state' || command === 'define') {
    return ['one precise sentence', 'use syllabus keyword', 'avoid extra story']
  }
  if (command === 'describe') {
    return ['what happens', 'sequence/order', 'key observation']
  }
  if (command === 'explain' || command === 'justify') {
    return ['scientific point', 'because/therefore link', 'exam keyword']
  }
  if (command === 'compare') {
    return ['feature A', 'feature B', 'clear difference/similarity']
  }
  if (command === 'evaluate' || command === 'discuss') {
    return ['evidence for', 'evidence against', 'judgement']
  }
  return ['direct answer', 'reason', 'exam keyword']
}

function styleFor(command: CommandWord) {
  if (command === 'calculate') return 'formula-first calculation'
  if (command === 'state' || command === 'define') return 'short mark-scheme definition'
  if (command === 'describe') return 'ordered description'
  if (command === 'explain') return 'cause-effect explanation'
  if (command === 'compare') return 'side-by-side comparison'
  if (command === 'evaluate' || command === 'discuss') return 'balanced judgement'
  if (command === 'justify') return 'evidence-backed reasoning'
  if (command === 'solve') return 'step-by-step solution'
  return 'exam-focused tutor answer'
}

export function analyzeCommandWords(question: string): CommandWordAnalysis {
  const commandWords = COMMANDS
    .filter((entry) => entry.regex.test(question))
    .map((entry) => entry.command)

  const primaryCommand = commandWords[0] ?? 'unknown'
  return {
    commandWords,
    primaryCommand,
    answerStyle: styleFor(primaryCommand),
    requiredStructure: structureFor(primaryCommand),
  }
}
