import fs from 'node:fs'
import path from 'node:path'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'
import type { QbankParsedQuery } from '@/lib/server/qbank'

type QbankConceptRow = {
  id: string
  board: string
  level: string
  subject: string
  chapter: string
  topic: string
  conceptSummary: string
  examTips: string[]
  repeatYears: string[]
  formulaCandidates: string[]
  questionExamples: string[]
  answerPatterns: string[]
  importanceScore: number
  sourceUrls: string[]
  sourceLabels: string[]
  searchText: string
}

export type QbankConceptMatch = {
  id: string
  board: string
  level: string
  subject: string
  chapter: string
  topic: string
  conceptSummary: string
  examTips: string[]
  repeatYears: string[]
  formulaCandidates: string[]
  questionExamples: string[]
  answerPatterns: string[]
  importanceScore: number
  sourceUrls: string[]
  sourceLabels: string[]
}

let cachedRows: QbankConceptRow[] | null = null

const GENERIC_QUERY_STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'into',
  'what',
  'which',
  'when',
  'where',
  'how',
  'why',
  'formula',
  'formulas',
  'equation',
  'equations',
  'concept',
  'concepts',
  'definition',
  'meaning',
  'state',
  'explain',
  'tell',
  'show',
  'give',
  'write',
])

const GENERIC_TOPIC_PHRASES = [
  'past paper',
  'official past paper',
  'official guidance',
  'examiner report patterns',
]

const LOW_SIGNAL_SUMMARY_PHRASES = [
  'official exam file indexed from the desktop folder',
  'why choose cambridge',
  'cambridge secondary',
  'back to contents page',
  'contents 1',
  'for more resources and video tutorials please visit',
  'alevelphysicsonline.com',
]

function compactWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function readJsonl<T>(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return [] as T[]
  }

  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T)
}

function isMissingConceptTableError(error: unknown) {
  const code = (error as { code?: string })?.code
  const message = String((error as { message?: string })?.message ?? '')
  return code === '42P01' || code === 'PGRST205' || /qbank_concepts/i.test(message)
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function countPattern(text: string, pattern: RegExp) {
  return text.match(pattern)?.length ?? 0
}

function qualityPenalty(text: string) {
  const compact = compactWhitespace(text)
  if (!compact) {
    return 0
  }

  let penalty = 0
  penalty += countPattern(compact, /\b(?:[A-Za-z]\s+){3,}[A-Za-z]\b/g) * 18
  penalty += countPattern(compact, /\b[A-Za-z]\s+[a-z]{1,3}\b/g) * 5
  penalty += countPattern(compact, /[_/\\]{2,}|Â|Ã|25CBh|___/g) * 18
  penalty += countPattern(compact, /\b[a-z]{1,2}\s+[a-z]{1,2}\s+[a-z]{1,2}\b/g) * 8

  return penalty
}

function hasLowQualityExtraction(text: string) {
  return qualityPenalty(text) >= 36
}

function sanitizeConceptText(text: string) {
  return compactWhitespace(text.replace(/Â|Ã/g, ' '))
}

function sanitizeFormulaCandidates(candidates: string[]) {
  return candidates
    .map((candidate) => compactWhitespace(candidate))
    .filter((candidate) => candidate.length >= 4 && candidate.length <= 60)
    .filter((candidate) => !hasLowQualityExtraction(candidate))
    .filter((candidate) => /[A-Za-z]/.test(candidate))
}

function isGenericTopic(row: QbankConceptRow) {
  const topic = normalizeText(row.topic)
  const chapter = normalizeText(row.chapter)

  return (
    GENERIC_TOPIC_PHRASES.some((phrase) => topic.includes(phrase) || chapter.includes(phrase)) ||
    topic === 'past paper' ||
    chapter === 'official past paper'
  )
}

function cleanConceptTextForOutput(text: string) {
  return compactWhitespace(
    sanitizeConceptText(text)
      .replace(/\bscore\s+\d+\b/gi, '')
      .replace(/\bguidance sample\s+\d+\b/gi, '')
      .replace(/\btier\d+_[a-z_]+\b/gi, '')
  )
}

function isLowSignalConcept(row: QbankConceptRow) {
  const topic = normalizeText(row.topic)
  const chapter = normalizeText(row.chapter)
  const summary = normalizeText(row.conceptSummary)

  if (LOW_SIGNAL_SUMMARY_PHRASES.some((phrase) => summary.includes(phrase))) {
    return true
  }

  if (/pages?\s+\d+(-\d+)?$/.test(topic) || /pages?\s+\d+(-\d+)?$/.test(chapter)) {
    return true
  }

  if (topic.length > 120 && row.examTips.length === 0 && row.formulaCandidates.length <= 1) {
    return true
  }

  if (
    row.formulaCandidates.length === 0 &&
    row.examTips.length === 0 &&
    row.questionExamples.length === 0 &&
    row.answerPatterns.length === 0 &&
    qualityPenalty(summary) >= 24
  ) {
    return true
  }

  return false
}

function getSourcePriorityPenalty(row: QbankConceptRow) {
  const labels = row.sourceLabels.map((value) => normalizeText(value))

  if (row.id.startsWith('concept_')) {
    return 0
  }

  if (row.id.startsWith('concept-pdf-')) {
    return 6
  }

  if (row.id.startsWith('concept-full-')) {
    return row.formulaCandidates.length > 0 ? 8 : 18
  }

  if (labels.some((label) => label.includes('pp.'))) {
    return 10
  }

  return 4
}

function tokenizeSearch(value: string) {
  return normalizeText(value)
    .split(' ')
    .filter((token) => token.length > 2 && !GENERIC_QUERY_STOPWORDS.has(token))
}

function getRows() {
  if (cachedRows) {
    return cachedRows
  }

  const dataDir = path.join(process.cwd(), 'data')
  const cleanedFile = path.join(dataDir, 'qbank_concept_cleaned.jsonl')
  const conceptFiles = fs.existsSync(cleanedFile)
    ? ['qbank_concept_cleaned.jsonl']
    : fs
        .readdirSync(dataDir)
        .filter((file) => /^qbank_concept.*\.jsonl$/i.test(file))
        .sort()

  cachedRows = conceptFiles.flatMap((file) => readJsonl<QbankConceptRow>(path.join(dataDir, file)))
  return cachedRows
}

function scoreConcept(row: QbankConceptRow, parsedQuery: QbankParsedQuery) {
  if (isLowSignalConcept(row)) {
    return 0
  }

  let score = 0
  const searchableTopic = normalizeText(`${row.chapter} ${row.topic}`)
  const normalizedFormulas = sanitizeFormulaCandidates(row.formulaCandidates).map(normalizeText)
  const haystack = [
    row.board,
    row.level,
    row.subject,
    row.chapter,
    row.topic,
    row.conceptSummary,
    ...row.examTips,
    ...row.repeatYears,
    ...row.formulaCandidates,
    ...row.questionExamples,
    row.searchText,
  ]
    .filter(Boolean)
    .join(' ')
  const normalizedHaystack = normalizeText(haystack)
  const normalizedSummary = normalizeText(row.conceptSummary)
  const searchTokens = tokenizeSearch(parsedQuery.normalized)
  const specificTopicHints = parsedQuery.topicHints
    .map((hint) => normalizeText(hint))
    .filter(
      (hint) =>
        hint.length >= 4 &&
        !['formula', 'formulas', 'equation', 'equations', 'concept', 'concepts'].includes(hint)
    )
  let lexicalHits = 0

  for (const token of searchTokens) {
    if (normalizedHaystack.includes(token)) {
      lexicalHits += 1
      score += 5
    }
  }

  if (normalizedHaystack.includes(parsedQuery.normalized) && parsedQuery.normalized.length >= 6) {
    score += 18
  }

  if (parsedQuery.subject && row.subject.toLowerCase().includes(parsedQuery.subject.toLowerCase())) {
    score += 12
  }

  if (parsedQuery.board && row.board.toLowerCase().includes(parsedQuery.board.toLowerCase())) {
    score += 8
  }

  if (parsedQuery.level && row.level.toLowerCase().includes(parsedQuery.level.toLowerCase())) {
    score += 8
  }

  if (parsedQuery.topicHints.some((topic) => haystack.includes(topic))) {
    score += 14
  }

  for (const hint of parsedQuery.topicHints) {
    if (searchableTopic.includes(normalizeText(hint))) {
      score += 10
    }
  }

  if (specificTopicHints.length > 0) {
    const hasSpecificSearchHit = specificTopicHints.some((hint) =>
      normalizeText(row.searchText).includes(hint)
    )
    const hasSpecificTopicHit = specificTopicHints.some(
      (hint) =>
        searchableTopic.includes(hint) ||
        normalizedFormulas.some((candidate) => candidate.includes(hint))
    )

    if (
      parsedQuery.intent === 'formula_lookup' &&
      !hasSpecificTopicHit &&
      !hasSpecificSearchHit
    ) {
      return 0
    }

    if (hasSpecificTopicHit) {
      score += 30
    } else if (parsedQuery.intent === 'formula_lookup' || parsedQuery.intent === 'concept_lookup') {
      score -= 24
    }
  }

  if (parsedQuery.year && row.repeatYears.includes(String(parsedQuery.year))) {
    score += 6
  }

  if (parsedQuery.intent === 'formula_lookup' && row.formulaCandidates.length > 0) {
    score += 18
  }

  if (parsedQuery.intent === 'concept_lookup') {
    score += 8
  }

  if (
    parsedQuery.intent === 'formula_lookup' &&
    row.formulaCandidates.length === 0 &&
    !normalizedSummary.includes(parsedQuery.normalized)
  ) {
    return 0
  }

  if (lexicalHits === 0 && !parsedQuery.topicHints.some((topic) => normalizedHaystack.includes(topic))) {
    return 0
  }

  if (isGenericTopic(row)) {
    if (parsedQuery.intent === 'formula_lookup' || parsedQuery.intent === 'concept_lookup') {
      return 0
    }

    score -= 24
  }

  if (row.importanceScore <= 0 && row.formulaCandidates.length === 0 && row.examTips.length === 0) {
    score -= 14
  }

  const extractionPenalty = Math.max(
    qualityPenalty(normalizedSummary),
    qualityPenalty(row.topic),
    ...row.formulaCandidates.map((candidate) => qualityPenalty(candidate))
  )

  score -= Math.min(extractionPenalty, 60)
  score -= getSourcePriorityPenalty(row)

  if (
    hasLowQualityExtraction(normalizedSummary) &&
    row.formulaCandidates.length === 0 &&
    row.examTips.length === 0
  ) {
    return 0
  }

  score += Math.min(row.importanceScore ?? 0, 30) / 3

  return score
}

function mapConceptRow(row: QbankConceptRow): QbankConceptMatch {
  return {
    id: row.id,
    board: row.board,
    level: row.level,
    subject: row.subject,
    chapter: row.chapter,
    topic: row.topic,
    conceptSummary: cleanConceptTextForOutput(row.conceptSummary),
    examTips: row.examTips,
    repeatYears: row.repeatYears,
    formulaCandidates: sanitizeFormulaCandidates(row.formulaCandidates),
    questionExamples: row.questionExamples,
    answerPatterns: row.answerPatterns,
    importanceScore: row.importanceScore,
    sourceUrls: row.sourceUrls,
    sourceLabels: row.sourceLabels,
  }
}

function rankConceptRows(rows: QbankConceptRow[], parsedQuery: QbankParsedQuery) {
  return rows
    .map((row) => ({ row, score: scoreConcept(row, parsedQuery) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((entry) => mapConceptRow(entry.row))
}

function dedupeConceptRows(rows: QbankConceptRow[]) {
  const seen = new Set<string>()

  return rows.filter((row) => {
    const key = [
      row.id,
      normalizeText(row.board),
      normalizeText(row.level),
      normalizeText(row.subject),
      normalizeText(row.topic),
    ].join('|')

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function searchConceptsInSeed(parsedQuery: QbankParsedQuery) {
  return rankConceptRows(getRows(), parsedQuery)
}

function mapDbConceptRow(row: Record<string, unknown>): QbankConceptRow {
  return {
    id: String(row.id),
    board: String(row.board),
    level: String(row.level),
    subject: String(row.subject),
    chapter: String(row.chapter),
    topic: String(row.topic),
    conceptSummary: String(row.concept_summary),
    examTips: (row.exam_tips as string[] | null) ?? [],
    repeatYears: (row.repeat_years as string[] | null) ?? [],
    formulaCandidates: (row.formula_candidates as string[] | null) ?? [],
    questionExamples: (row.question_examples as string[] | null) ?? [],
    answerPatterns: (row.answer_patterns as string[] | null) ?? [],
    importanceScore: Number(row.importance_score ?? 0),
    sourceUrls: (row.source_urls as string[] | null) ?? [],
    sourceLabels: (row.source_labels as string[] | null) ?? [],
    searchText: '',
  }
}

export async function searchQbankConcepts(parsedQuery: QbankParsedQuery) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const searchTerms = [
      parsedQuery.board,
      parsedQuery.level,
      parsedQuery.subject,
      parsedQuery.year ? String(parsedQuery.year) : null,
      parsedQuery.paper,
      ...parsedQuery.topicHints,
      parsedQuery.normalized,
    ]
      .filter(Boolean)
      .join(' ')

    const queryBuilder = supabaseAdmin.from('qbank_concepts').select(
      'id, board, level, subject, chapter, topic, concept_summary, exam_tips, repeat_years, formula_candidates, question_examples, answer_patterns, importance_score, source_urls, source_labels'
    )
    const { data, error } = searchTerms
      ? await queryBuilder
          .textSearch('fts', searchTerms, {
            type: 'websearch',
            config: 'english',
          })
          .limit(12)
      : await queryBuilder.limit(12)

    if (error) {
      throw error
    }

    const dbRows = ((data as Array<Record<string, unknown>> | null) ?? []).map(mapDbConceptRow)
    const matches = rankConceptRows(dedupeConceptRows([...getRows(), ...dbRows]), parsedQuery)

    if (matches.length > 0) {
      return {
        enabled: dbRows.length > 0,
        source: dbRows.length > 0 ? ('db' as const) : ('seed' as const),
        matches,
      }
    }
  } catch (error) {
    if (!isMissingConceptTableError(error)) {
      throw error
    }
  }

  return {
    enabled: false,
    source: 'seed' as const,
    matches: searchConceptsInSeed(parsedQuery),
  }
}

export function getQbankConceptStats() {
  const rows = getRows()
  return {
    totalConcepts: rows.length,
    bySubject: Object.fromEntries(
      Object.entries(
        rows.reduce<Record<string, number>>((acc, row) => {
          acc[row.subject] = (acc[row.subject] ?? 0) + 1
          return acc
        }, {})
      ).sort((a, b) => b[1] - a[1])
    ),
  }
}
