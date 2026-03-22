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

const DATA_PATH = path.join(process.cwd(), 'data', 'qbank_concept_seed.jsonl')
let cachedRows: QbankConceptRow[] | null = null

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

function getRows() {
  if (cachedRows) {
    return cachedRows
  }

  cachedRows = readJsonl<QbankConceptRow>(DATA_PATH)
  return cachedRows
}

function scoreConcept(row: QbankConceptRow, parsedQuery: QbankParsedQuery) {
  let score = row.importanceScore ?? 0
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
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  for (const token of parsedQuery.normalized.split(' ')) {
    if (token.length > 2 && haystack.includes(token)) {
      score += 3
    }
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
    score += 10
  }

  if (parsedQuery.year && row.repeatYears.includes(String(parsedQuery.year))) {
    score += 6
  }

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
    conceptSummary: row.conceptSummary,
    examTips: row.examTips,
    repeatYears: row.repeatYears,
    formulaCandidates: row.formulaCandidates,
    questionExamples: row.questionExamples,
    answerPatterns: row.answerPatterns,
    importanceScore: row.importanceScore,
    sourceUrls: row.sourceUrls,
    sourceLabels: row.sourceLabels,
  }
}

function searchConceptsInSeed(parsedQuery: QbankParsedQuery) {
  return getRows()
    .map((row) => ({ row, score: scoreConcept(row, parsedQuery) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((entry) => mapConceptRow(entry.row))
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
    ]
      .filter(Boolean)
      .join(' ')

    const { data, error } = await supabaseAdmin
      .from('qbank_concepts')
      .select(
        'id, board, level, subject, chapter, topic, concept_summary, exam_tips, repeat_years, formula_candidates, question_examples, answer_patterns, importance_score, source_urls, source_labels'
      )
      .textSearch('fts', searchTerms, {
        type: 'websearch',
        config: 'english',
      })
      .limit(10)

    if (error) {
      throw error
    }

    const matches =
      ((data as Array<Record<string, unknown>> | null) ?? [])
        .map((row) => ({
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
        }))
        .sort((a, b) => scoreConcept(b, parsedQuery) - scoreConcept(a, parsedQuery))
        .slice(0, 8)
        .map(mapConceptRow)

    if (matches.length > 0) {
      return {
        enabled: true,
        source: 'db' as const,
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
