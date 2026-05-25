import fs from 'node:fs'
import path from 'node:path'

type QueryLike = {
  raw: string
  normalized: string
  board: string | null
  level: string | null
  subject: string | null
  year: number | null
  yearStart: number | null
  yearEnd: number | null
  paper: string | null
  intent: string
  topicHints: string[]
  queryTerms: string[]
  wantsMostRepeated: boolean
  wantsPrediction: boolean
  wantsSimilar: boolean
}

export type CompiledQbankQuestionRow = {
  id: string
  board: string
  level: string
  subject: string
  topic: string
  question_type: string
  marks: number | null
  question_number: string | null
  question_text: string
  options: string[]
  answer: string | null
  solution: string | null
  page_start: number | null
  page_end: number | null
  year: number | null
  paper: string | null
  paper_code: string | null
  session: string | null
  source_pdf: string
  source_url: string | null
  answer_source_url: string | null
  link_quality: 'exact' | 'hierarchical' | 'unlinked' | 'unknown'
  link_confidence: 'high' | 'medium' | 'low' | 'none'
  answer_ready: boolean
  repeat_group_id: string | null
  frequency: number
}

type CompiledQbankQueryIndexRow = {
  id: string
  board: string
  level: string
  subject: string
  topic: string
  year: number | null
  paper: string | null
  question_type: string
  frequency: number
  repeat_group_id: string | null
  search_text: string
}

export type CompiledQbankRepeatGroup = {
  repeat_group_id: string
  signature: string
  board: string
  level: string
  subject: string
  topic: string
  question_type: string
  frequency: number
  years: number[]
  representative_question: string
  source_ids: string[]
}

export type CompiledQbankTopicFrequency = {
  board: string
  level: string
  subject: string
  topic: string
  question_count: number
  total_frequency: number
  years: number[]
}

const COMPILED_DIR = path.join(process.cwd(), 'data', 'qbank_compiled')
const FEED_SAFE_PATH = path.join(COMPILED_DIR, 'qbank_question_bank_feed_safe.jsonl')
const AO_LEVEL_FEED_SAFE_PATH = path.join(COMPILED_DIR, 'qbank_question_bank_ao_level.jsonl')
const QUERY_INDEX_PATH = path.join(COMPILED_DIR, 'qbank_question_query_index.jsonl')
const AO_LEVEL_QUERY_INDEX_PATH = path.join(COMPILED_DIR, 'qbank_question_query_index_ao_level.jsonl')
const REPEAT_GROUP_PATH = path.join(COMPILED_DIR, 'qbank_repeat_groups.jsonl')
const AO_LEVEL_REPEAT_GROUP_PATH = path.join(COMPILED_DIR, 'qbank_repeat_groups_ao_level.jsonl')
const TOPIC_FREQUENCY_PATH = path.join(COMPILED_DIR, 'qbank_topic_frequency.jsonl')
const AO_LEVEL_TOPIC_FREQUENCY_PATH = path.join(COMPILED_DIR, 'qbank_topic_frequency_ao_level.jsonl')

const QUERY_STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'all',
  'answer',
  'answers',
  'ask',
  'board',
  'boards',
  'by',
  'caie',
  'cambridge',
  'chapter',
  'chapters',
  'edexcel',
  'exam',
  'exams',
  'for',
  'from',
  'give',
  'important',
  'in',
  'last',
  'level',
  'levels',
  'mark',
  'marks',
  'most',
  'of',
  'o',
  'paper',
  'papers',
  'past',
  'physics',
  'chemistry',
  'mathematics',
  'math',
  'maths',
  'biology',
  'economics',
  'accounting',
  'finance',
  'geography',
  'english',
  'ict',
  'problem',
  'problems',
  'question',
  'questions',
  'range',
  'recent',
  'repeated',
  'show',
  'similar',
  'solve',
  'solution',
  'solutions',
  'subject',
  'subjects',
  'the',
  'this',
  'to',
  'topic',
  'topics',
  'want',
  'wise',
  'with',
  'year',
  'years',
])

let cachedQuestions: CompiledQbankQuestionRow[] | null = null
let cachedQuestionById: Map<string, CompiledQbankQuestionRow> | null = null
let cachedQueryIndex: CompiledQbankQueryIndexRow[] | null = null
let cachedRepeatGroups: CompiledQbankRepeatGroup[] | null = null
let cachedTopicFrequency: CompiledQbankTopicFrequency[] | null = null

function readJsonl<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) {
    return []
  }

  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T)
}

function readJsonlMany<T>(filePaths: string[]) {
  return filePaths.flatMap((filePath) => readJsonl<T>(filePath))
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(value: string | null | undefined) {
  return normalizeText(value)
    .split(' ')
    .filter((token) => token.length > 2)
}

function includesLoose(haystack: string | null | undefined, needle: string | null | undefined) {
  const left = normalizeText(haystack)
  const right = normalizeText(needle)
  if (!left || !right) {
    return false
  }

  return left.includes(right) || right.includes(left)
}

function getQuestions() {
  if (!cachedQuestions) {
    cachedQuestions = readJsonlMany<CompiledQbankQuestionRow>([FEED_SAFE_PATH, AO_LEVEL_FEED_SAFE_PATH])
  }

  return cachedQuestions
}

function getQuestionById() {
  if (!cachedQuestionById) {
    cachedQuestionById = new Map(getQuestions().map((row) => [row.id, row]))
  }

  return cachedQuestionById
}

function getQueryIndex() {
  if (!cachedQueryIndex) {
    cachedQueryIndex = readJsonlMany<CompiledQbankQueryIndexRow>([QUERY_INDEX_PATH, AO_LEVEL_QUERY_INDEX_PATH])
  }

  return cachedQueryIndex
}

function getRepeatGroups() {
  if (!cachedRepeatGroups) {
    cachedRepeatGroups = readJsonlMany<CompiledQbankRepeatGroup>([REPEAT_GROUP_PATH, AO_LEVEL_REPEAT_GROUP_PATH])
  }

  return cachedRepeatGroups
}

function getTopicFrequency() {
  if (!cachedTopicFrequency) {
    cachedTopicFrequency = readJsonlMany<CompiledQbankTopicFrequency>([TOPIC_FREQUENCY_PATH, AO_LEVEL_TOPIC_FREQUENCY_PATH])
  }

  return cachedTopicFrequency
}

function getSearchTokens(parsed: QueryLike) {
  const hintTokens = parsed.topicHints.flatMap((hint) => tokenize(hint))
  const rawTokens = parsed.queryTerms.filter((token) => !QUERY_STOPWORDS.has(token))
  return Array.from(new Set([...hintTokens, ...rawTokens]))
}

function matchesCoreFilters(
  row: Pick<CompiledQbankQuestionRow, 'board' | 'level' | 'subject' | 'year' | 'paper'>,
  parsed: QueryLike
) {
  if (parsed.board && !includesLoose(row.board, parsed.board)) {
    return false
  }

  if (parsed.level && !includesLoose(row.level, parsed.level)) {
    return false
  }

  if (parsed.subject && !includesLoose(row.subject, parsed.subject)) {
    return false
  }

  if (parsed.year !== null && row.year !== null && row.year !== parsed.year) {
    return false
  }

  if (parsed.yearStart !== null || parsed.yearEnd !== null) {
    if (row.year === null) {
      return false
    }

    if (parsed.yearStart !== null && row.year < parsed.yearStart) {
      return false
    }

    if (parsed.yearEnd !== null && row.year > parsed.yearEnd) {
      return false
    }
  }

  if (parsed.paper && !includesLoose(row.paper, parsed.paper) && !includesLoose(row.paper, parsed.paper?.replace(/^paper\s*/i, ''))) {
    return false
  }

  return true
}

function scoreTextMatch(haystack: string, tokens: string[]) {
  if (tokens.length === 0) {
    return 0
  }

  const normalized = normalizeText(haystack)
  let score = 0
  for (const token of tokens) {
    if (normalized.includes(token)) {
      score += token.length >= 8 ? 9 : 6
    }
  }
  return score
}

function scoreCompiledQuestion(
  row: CompiledQbankQuestionRow,
  indexRow: CompiledQbankQueryIndexRow | undefined,
  parsed: QueryLike,
  tokens: string[]
) {
  let score = 0
  const searchText = indexRow?.search_text ?? `${row.topic} ${row.question_text}`

  if (parsed.board && includesLoose(row.board, parsed.board)) {
    score += 20
  }

  if (parsed.level && includesLoose(row.level, parsed.level)) {
    score += 18
  }

  if (parsed.subject && includesLoose(row.subject, parsed.subject)) {
    score += 20
  }

  if (parsed.year !== null && row.year === parsed.year) {
    score += 22
  }

  if ((parsed.yearStart !== null || parsed.yearEnd !== null) && row.year !== null) {
    score += 16
  }

  if (parsed.paper && includesLoose(row.paper, parsed.paper)) {
    score += 18
  }

  score += scoreTextMatch(row.topic, tokens) * 2
  score += scoreTextMatch(searchText, tokens)

  if (parsed.wantsMostRepeated || parsed.wantsPrediction) {
    score += Math.min(row.frequency * 6, 36)
  } else {
    score += Math.min(row.frequency * 3, 18)
  }

  if (row.answer_ready) {
    score += 12
  }

  if (row.link_quality === 'exact') {
    score += 15
  } else if (row.link_quality === 'hierarchical') {
    score += 8
  }

  if (row.topic.toLowerCase() === 'general' && tokens.length > 0) {
    score -= 10
  }

  if (row.question_text.length < 18) {
    score -= 12
  }

  return score
}

function scoreRepeatGroup(group: CompiledQbankRepeatGroup, parsed: QueryLike, tokens: string[]) {
  let score = 0

  if (!matchesCoreFilters({ board: group.board, level: group.level, subject: group.subject, year: null, paper: null }, parsed)) {
    return Number.NEGATIVE_INFINITY
  }

  score += group.frequency * 10
  score += scoreTextMatch(group.topic, tokens) * 2
  score += scoreTextMatch(group.representative_question, tokens)

  if (parsed.year !== null) {
    score += group.years.includes(parsed.year) ? 18 : -28
  }

  if (group.topic.toLowerCase() === 'general' && tokens.length > 0) {
    score -= 18
  }

  if (parsed.yearStart !== null || parsed.yearEnd !== null) {
    const yearsInRange = group.years.filter((year) => {
      if (parsed.yearStart !== null && year < parsed.yearStart) {
        return false
      }
      if (parsed.yearEnd !== null && year > parsed.yearEnd) {
        return false
      }
      return true
    })

    if (yearsInRange.length === 0) {
      score -= 30
    } else {
      score += yearsInRange.length * 4
    }
  }

  return score
}

function scoreTopicFrequency(row: CompiledQbankTopicFrequency, parsed: QueryLike, tokens: string[]) {
  let score = 0

  if (!matchesCoreFilters({ board: row.board, level: row.level, subject: row.subject, year: null, paper: null }, parsed)) {
    return Number.NEGATIVE_INFINITY
  }

  score += row.total_frequency * 8
  score += row.question_count * 2
  score += scoreTextMatch(row.topic, tokens) * 3

  if (parsed.year !== null) {
    score += row.years.includes(parsed.year) ? 18 : -24
  }

  if (row.topic.toLowerCase() === 'general' && tokens.length > 0) {
    score -= 20
  }

  if (parsed.yearStart !== null || parsed.yearEnd !== null) {
    const yearsInRange = row.years.filter((year) => {
      if (parsed.yearStart !== null && year < parsed.yearStart) {
        return false
      }
      if (parsed.yearEnd !== null && year > parsed.yearEnd) {
        return false
      }
      return true
    })

    if (yearsInRange.length === 0) {
      score -= 24
    } else {
      score += yearsInRange.length * 4
    }
  }

  return score
}

export function getCompiledLatestQuestionYear() {
  return getQuestions().reduce<number | null>((latest, row) => {
    if (row.year === null) {
      return latest
    }

    if (latest === null || row.year > latest) {
      return row.year
    }

    return latest
  }, null)
}

export function searchCompiledQbankQuestions(parsed: QueryLike, limit = 6) {
  const tokens = getSearchTokens(parsed)
  const indexById = new Map(getQueryIndex().map((row) => [row.id, row]))
  const filtered = getQuestions().filter((row) => matchesCoreFilters(row, parsed))
  const candidates = filtered.length > 0 ? filtered : getQuestions()

  return candidates
    .map((row) => ({
      row,
      score: scoreCompiledQuestion(row, indexById.get(row.id), parsed, tokens),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }
      if (right.row.frequency !== left.row.frequency) {
        return right.row.frequency - left.row.frequency
      }
      return (right.row.year ?? 0) - (left.row.year ?? 0)
    })
    .slice(0, limit)
    .map((entry) => entry.row)
}

export function searchCompiledQbankRepeatGroups(parsed: QueryLike, limit = 5) {
  const tokens = getSearchTokens(parsed)
  return getRepeatGroups()
    .map((group) => ({ group, score: scoreRepeatGroup(group, parsed, tokens) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }
      return right.group.frequency - left.group.frequency
    })
    .slice(0, limit)
    .map((entry) => entry.group)
}

export function searchCompiledQbankTopicFrequency(parsed: QueryLike, limit = 5) {
  const tokens = getSearchTokens(parsed)
  return getTopicFrequency()
    .map((row) => ({ row, score: scoreTopicFrequency(row, parsed, tokens) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }
      return right.row.total_frequency - left.row.total_frequency
    })
    .slice(0, limit)
    .map((entry) => entry.row)
}

export function getCompiledQuestionsByIds(ids: string[]) {
  const questionById = getQuestionById()
  return ids
    .map((id) => questionById.get(id))
    .filter((row): row is CompiledQbankQuestionRow => Boolean(row))
}
