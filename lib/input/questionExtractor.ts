export type ExtractedQuestion = {
  rawInput: string
  cleanPrompt: string
  board: 'Cambridge' | 'Edexcel' | 'General'
  level: 'O Level' | 'A Level' | 'General'
  subject: string | null
  topic: string | null
  chapter: string | null
  year: number | null
  paperCode: string | null
}

const SUBJECT_KEYWORDS: Array<[RegExp, string]> = [
  [/\b(physics|astrophysics|forces|suvat|suvat|circuit|ohms law|momentum|magnetism|induction|electric)\b/i, 'Physics'],
  [/\b(chemistry|bonding|ionic|covalent|organic|reaction rate|stoichiometry|reaction|equilib)\b/i, 'Chemistry'],
  [/\b(biology|photosynthesis|osmosis|cell|enzymes|respiration|genetics|ecology)\b/i, 'Biology'],
  [/\b(mathematics|math|integration|differentiation|algebra|vectors|probability|equation)\b/i, 'Mathematics'],
  [/\b(economics|demand|supply|inflation|fiscal|monetary)\b/i, 'Economics'],
  [/\b(accounting|ledgers|balance sheet|profit and loss|depreciation)\b/i, 'Accounting'],
  [/\b(business|leadership|usp|liquidity|hrm|marketing)\b/i, 'Business'],
  [/\b(computer science|binary|boolean|networking|database|ict)\b/i, 'Computer Science'],
  [/\b(english|literary|reading comprehension|essay)\b/i, 'English']
]

const TOPIC_KEYWORDS: Array<[RegExp, string]> = [
  [/\bwave(?:s)?\b|\bwave motion\b|\bwavelength\b/i, 'Wave Motion'],
  [/\borganic\b|\bhydrocarbon\b|\balkane\b/i, 'Organic Chemistry'],
  [/\bbonding\b|\bionic\b|\bcovalent\b/i, 'Chemical Bonding'],
  [/\bintegration\b|\bintegral\b/i, 'Integration'],
  [/\bdifferentiation\b|\bderivative\b/i, 'Differentiation'],
  [/\bforces?\b|\bmotion\b|\bsuvat\b/i, 'Forces and Motion'],
  [/\bphotosynthesis\b/i, 'Photosynthesis'],
  [/\bwork done\b|\bwork\b/i, 'Work, Energy and Power'],
  [/\breaction rate\b|\brates\b/i, 'Rates of Reaction'],
  [/\bmagnetism\b|\bmagnetic\s+field\b/i, 'Magnetism'],
  [/\belectromagnetic\s+induction\b|\bfaraday\b|\bflux\s+linkage\b|\binduced\s+emf\b/i, 'Electromagnetic Induction'],
  [/\belectromagnetic\b/i, 'Electromagnetism'],
]

export function extractQuestionDetails(rawInput: string): ExtractedQuestion {
  const text = rawInput.replace(/\s+/g, ' ').trim()
  
  // 1. Board detection
  let board: ExtractedQuestion['board'] = 'General'
  if (/\bedexcel\b|\bpearson\b/i.test(text)) {
    board = 'Edexcel'
  } else if (/\bcambridge\b|\bcaie\b|\bcie\b/i.test(text)) {
    board = 'Cambridge'
  }

  // 2. Level detection
  let level: ExtractedQuestion['level'] = 'General'
  if (/\bo\s*level\b|\bigcse\b/i.test(text)) {
    level = 'O Level'
  } else if (/\ba\s*level\b|\bas\b|\ba2\b|\bial\b/i.test(text)) {
    level = 'A Level'
  }

  // 3. Subject detection
  let subject: string | null = null
  for (const [pattern, subName] of SUBJECT_KEYWORDS) {
    if (pattern.test(text)) {
      subject = subName
      break
    }
  }

  // 4. Topic & Chapter detection
  let topic: string | null = null
  for (const [pattern, topicName] of TOPIC_KEYWORDS) {
    if (pattern.test(text)) {
      topic = topicName
      break
    }
  }
  const chapter = topic // heuristic mapping

  // 5. Year detection
  let year: number | null = null
  const yearMatch = /\b(20\d{2})\b/.exec(text)
  if (yearMatch) {
    year = Number(yearMatch[1])
  }

  // 6. Paper code detection (e.g. 9702/22/M/J/21)
  let paperCode: string | null = null
  const paperCodeMatch = /\b(\d{4}\/\d{2}\/[A-Za-z0-9\/]+)\b/.exec(text)
  if (paperCodeMatch) {
    paperCode = paperCodeMatch[1]
  }

  return {
    rawInput,
    cleanPrompt: text,
    board,
    level,
    subject,
    topic,
    chapter,
    year,
    paperCode
  }
}
