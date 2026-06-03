import { ensureDatasetDirs, jsonlPath, readJsonl, writeJsonl } from './dataset_common'

type TaggedQuestion = {
  board: string
  level: string
  subject: string
  topic?: string | null
  chapter?: string | null
  year: number | null
  paper_code: string
  paper_type: string
  question_number: string | null
  command_word?: string
  question_type?: string
  marks: number | null
  text: string
  formulas_needed?: string[]
}

type Pattern = {
  board: string
  level: string
  subject: string
  topic: string
  chapter: string | null
  paper_type: string
  question_type: string
  command_word: string
  years_appeared: number[]
  frequency: number
  sample_question_ids: string[]
  mark_scheme_keywords: string[]
  common_mistakes: string[]
  reasoning_pattern: string
  formula_patterns: string[]
  confidence: number
}

const STOP = new Set(['what', 'when', 'where', 'which', 'with', 'from', 'that', 'this', 'they', 'their', 'there', 'marks'])

function key(question: TaggedQuestion) {
  return [
    question.board,
    question.level,
    question.subject,
    question.topic ?? 'General',
    question.paper_type,
    question.question_type ?? 'multi-step reasoning',
    question.command_word ?? 'unknown',
  ].join('|')
}

function keywords(text: string) {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 4 && !STOP.has(word))
}

function reasoningPattern(questionType: string, commandWord: string) {
  if (questionType === 'calculation') return 'Formula -> substitution -> answer -> unit.'
  if (questionType === 'experiment design') return 'Apparatus/method -> controls -> repeats -> mean/graph/analysis.'
  if (commandWord === 'explain') return 'Cause -> mechanism -> effect -> conclusion.'
  if (commandWord === 'compare') return 'Similarity plus direct difference.'
  return 'Concept -> application -> exam keyword.'
}

async function main() {
  ensureDatasetDirs()
  const questions = readJsonl<TaggedQuestion>(jsonlPath('processed/tagged_questions.jsonl'))
  const groups = new Map<string, { questions: TaggedQuestion[]; keywordCounts: Map<string, number> }>()

  for (const question of questions) {
    const group = groups.get(key(question)) ?? { questions: [], keywordCounts: new Map<string, number>() }
    group.questions.push(question)
    keywords(question.text).forEach((word) => group.keywordCounts.set(word, (group.keywordCounts.get(word) ?? 0) + 1))
    groups.set(key(question), group)
  }

  const patterns: Pattern[] = Array.from(groups.values()).map(({ questions: groupQuestions, keywordCounts }) => {
    const first = groupQuestions[0]
    const topKeywords = Array.from(keywordCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([word]) => word)
    const years = Array.from(new Set(groupQuestions.map((question) => question.year).filter((year): year is number => typeof year === 'number')))
    const questionType = first.question_type ?? 'multi-step reasoning'
    const commandWord = first.command_word ?? 'unknown'
    return {
      board: first.board,
      level: first.level,
      subject: first.subject,
      topic: first.topic ?? 'General',
      chapter: first.chapter ?? null,
      paper_type: first.paper_type,
      question_type: questionType,
      command_word: commandWord,
      years_appeared: years,
      frequency: groupQuestions.length,
      sample_question_ids: groupQuestions.map((question) => `${question.paper_code}:${question.question_number ?? 'unknown'}`).slice(0, 20),
      mark_scheme_keywords: topKeywords,
      common_mistakes: [],
      reasoning_pattern: reasoningPattern(questionType, commandWord),
      formula_patterns: Array.from(new Set(groupQuestions.flatMap((question) => question.formulas_needed ?? []))),
      confidence: Math.min(89, 45 + groupQuestions.length * 5),
    }
  })

  writeJsonl(jsonlPath('processed/paper_patterns.jsonl'), patterns)
  writeJsonl(jsonlPath('processed/mark_scheme_patterns.jsonl'), patterns.map((pattern) => ({
    subject: pattern.subject,
    topic: pattern.topic,
    question_type: pattern.question_type,
    command_word: pattern.command_word,
    required_points: pattern.mark_scheme_keywords.slice(0, 8),
    optional_points: [],
    common_wrong_answers: pattern.common_mistakes,
    mark_allocation_pattern:
      pattern.question_type === 'calculation'
        ? ['Formula mark [1]', 'Substitution mark [1]', 'Answer mark [1]', 'Unit mark [1]']
        : ['Concept [1]', 'Mechanism [1]', 'Effect/application [1]', 'Conclusion [1]'],
    examiner_keywords: pattern.mark_scheme_keywords,
  })))
  console.log(JSON.stringify({ patterns: patterns.length }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
