import fs from 'node:fs'
import path from 'node:path'
import {
  searchQbankBlockedRecovery,
  type QbankBlockedRecoveryMatch,
} from '@/lib/server/qbank-blocked-recovery'
import { searchQbankConcepts, type QbankConceptMatch } from '@/lib/server/qbank-concepts'
import { searchQbankGapStatuses } from '@/lib/server/qbank-gap-status'
import { searchNearbyQbankResources, searchQbankPaperPairs } from '@/lib/server/qbank-paper-pairs'
import { searchQbankPapers } from '@/lib/server/qbank-papers'
import { searchQbankPdfChunks } from '@/lib/server/qbank-pdf-chunks'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'
import { searchQbankSources } from '@/lib/server/qbank-sources'

type QbankSeedRow = {
  id: string
  record_type: 'qbank_topic' | 'qbank_question'
  board: string
  level: string
  subject: string
  chapter: string
  topic: string
  importance_score?: number
  repeat_years?: string[]
  exam_tips?: string[]
  summary?: string
  search_text?: string
  year?: number
  paper?: string
  question_label?: string
  question_text?: string
  answer_summary?: string
  method_steps?: string[]
  repeat_signal?: string
  source_label?: string
  source_url?: string | null
  answer_source_url?: string | null
  link_quality?: 'exact' | 'hierarchical' | 'unlinked' | 'unknown'
  link_score?: number
  link_confidence?: 'high' | 'medium' | 'low' | 'none'
  answer_ready?: boolean
}

export type QbankContextChunk = {
  id: string
  content: string
  sourceTitle: string
  sourceUrl: string | null
  tier: string
  lastChecked: string | null
}

type TopicMatch = {
  id: string
  board: string
  level: string
  subject: string
  chapter: string
  topic: string
  importanceScore: number
  summary: string
  repeatYears: string[]
  examTips: string[]
  sourceLabel: string | null
  sourceUrl: string | null
}

type QuestionMatch = {
  id: string
  board: string
  level: string
  subject: string
  chapter: string
  topic: string
  year: number | null
  paper: string | null
  questionLabel: string | null
  questionText: string
  answerSummary: string
  methodSteps: string[]
  repeatSignal: string | null
  sourceLabel: string | null
  sourceUrl: string | null
  answerSourceUrl: string | null
  linkQuality: 'exact' | 'hierarchical' | 'unlinked' | 'unknown'
  linkScore: number
  linkConfidence: 'high' | 'medium' | 'low' | 'none'
  answerReady: boolean
}

export type QbankParsedQuery = {
  raw: string
  normalized: string
  board: string | null
  level: string | null
  subject: string | null
  year: number | null
  paper: string | null
  intent: 'topic_review' | 'question_lookup' | 'solve' | 'general'
  topicHints: string[]
}

export type QbankPdfChunkMatch = {
  id: string
  documentId: string
  board: string
  level: string
  subject: string
  title: string
  year: number | null
  resourceType: string
  content: string
  visualRich: boolean
  visualRisk: string | null
  imageObjects: number
  visualTags: string[]
  sourceUrl: string | null
}

export type QbankPaperPairMatch = {
  id: string
  board: string
  level: string
  subject: string
  year: number | null
  session: string | null
  paperCode: string | null
  questionPaperUrl: string | null
  markSchemeUrl: string | null
  examinerReportUrl: string | null
  confidentialInstructionsUrl: string | null
  specimenMarkSchemeUrl: string | null
  completeness: 'full' | 'partial'
}

export type QbankNearbyResourceMatch = {
  id: string
  board: string
  level: string
  subject: string
  year: number | null
  session: string | null
  paperCode: string | null
  resourceType: string
  title: string
  url: string
  yearDistance: number | null
  samePaper: boolean
  completeness: 'full' | 'partial'
}

export type QbankGapMatch = {
  id: string
  board: string
  level: string
  subject: string
  year: number | null
  resourceType: string
  status: 'access_blocked' | 'source_page_available' | 'not_yet_published'
  httpStatus: number | null
  effectiveMinYear: number | null
  effectiveMaxYear: number | null
  sourceUrls: string[]
}

export type QbankBlockedRecoveryContextMatch = QbankBlockedRecoveryMatch
export type QbankConceptContextMatch = QbankConceptMatch

const DATA_DIR = path.join(process.cwd(), 'data')
let cachedSeedRows: QbankSeedRow[] | null = null

function isMissingQbankError(error: unknown): boolean {
  const code = (error as { code?: string })?.code
  const message = String((error as { message?: string })?.message ?? '')
  return code === '42P01' || code === 'PGRST205' || /qbank_topic_map|qbank_questions/i.test(message)
}

function expandQueryAliases(query: string) {
  return query
    .replace(/\bedexl\b/gi, 'edexcel')
    .replace(/\bedxcel\b/gi, 'edexcel')
    .replace(/\bial\b/gi, 'international advanced level')
    .replace(/\bigcse\b/gi, 'international gcse')
    .replace(/\bo level\b/gi, 'o level')
    .replace(/\ba level\b/gi, 'a level')
}

function normalizeQuery(query: string) {
  return expandQueryAliases(query)
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(query: string) {
  return normalizeQuery(query)
    .toLowerCase()
    .split(' ')
    .filter((token) => token.length > 2)
}

export function parseQbankQuery(query: string): QbankParsedQuery {
  const normalized = normalizeQuery(query).toLowerCase()
  const yearMatch = normalized.match(/\b(20\d{2})\b/)
  const paperMatch = normalized.match(/\b(paper\s*\d+[a-z]?|paper\s*[a-z]|\bp\d+\b|pure mathematics\s*\d+)\b/i)

  const board = normalized.includes('edexcel')
    ? 'Edexcel'
    : normalized.includes('cambridge') || normalized.includes('cie')
      ? 'Cambridge'
      : normalized.includes('pearson')
        ? 'Pearson'
        : null

  const level = normalized.includes('o level')
    ? 'O Level'
    : normalized.includes('a level')
      ? 'A Level'
      : normalized.includes('international gcse')
        ? 'IGCSE'
        : normalized.includes('international advanced level')
          ? 'International Advanced Level'
          : null

  const subject = normalized.includes('physics')
    ? 'Physics'
    : normalized.includes('chemistry') || normalized.includes('chem')
      ? 'Chemistry'
      : normalized.includes('further mathematics') || normalized.includes('further maths')
        ? 'Further Mathematics'
        : normalized.includes('math') || normalized.includes('mathematics') || normalized.includes('maths')
          ? 'Mathematics'
          : normalized.includes('biology') || normalized.includes('bio')
            ? 'Biology'
            : normalized.includes('computer science') || normalized.includes('comp sci') || normalized.includes('ict')
              ? 'Computer Science'
              : normalized.includes('economics') || normalized.includes('econ')
                ? 'Economics'
                : normalized.includes('business')
                  ? 'Business'
                  : normalized.includes('accounting') || normalized.includes('accounts')
                    ? 'Accounting'
                    : normalized.includes('english')
                      ? 'English'
                      : null

  const topicHints = [
    'vectors',
    'vector',
    'integration',
    'differentiation',
    'periodic table',
    'periodic trends',
    'equilibrium',
    'energetics',
    'kinematics',
    'motion graphs',
    'circuits',
    'electricity',
    'functions',
    'graph',
    'graphs',
    'diagram',
    'diagrams',
    'table',
    'tables',
    'image',
    'images',
    'chart',
    'practical',
    'apparatus',
    'algorithm',
    'pseudocode',
    'programming',
    'market structure',
    'elasticity',
    'cash flow',
    'ledger',
    'poetry',
    'comprehension',
    'mechanics',
    'statistics',
  ].filter((hint) => normalized.includes(hint))

  const intent = /important|repeat|topic|chapter|year wise|yearwise/.test(normalized)
    ? 'topic_review'
    : /solve|working|step by step|tutor/.test(normalized)
      ? 'solve'
      : /question|paper|\b20\d{2}\b/.test(normalized)
        ? 'question_lookup'
        : 'general'

  return {
    raw: query,
    normalized,
    board,
    level,
    subject,
    year: yearMatch ? Number(yearMatch[1]) : null,
    paper: paperMatch ? paperMatch[1].replace(/\s+/g, ' ').trim() : null,
    intent,
    topicHints,
  }
}

function matchesParsedFilters(row: QbankSeedRow, parsed: QbankParsedQuery) {
  if (parsed.board && !row.board.toLowerCase().includes(parsed.board.toLowerCase())) {
    return false
  }

  if (parsed.level && !row.level.toLowerCase().includes(parsed.level.toLowerCase())) {
    return false
  }

  if (parsed.subject && !row.subject.toLowerCase().includes(parsed.subject.toLowerCase())) {
    return false
  }

  if (parsed.year && row.record_type === 'qbank_question' && row.year && row.year !== parsed.year) {
    return false
  }

  if (parsed.paper && row.record_type === 'qbank_question' && row.paper) {
    const normalizedPaper = row.paper.toLowerCase()
    const queryPaper = parsed.paper.toLowerCase()
    if (!normalizedPaper.includes(queryPaper) && !queryPaper.includes(normalizedPaper)) {
      return false
    }
  }

  return true
}

function getSeedRows() {
  if (cachedSeedRows) {
    return cachedSeedRows
  }

  if (!fs.existsSync(DATA_DIR)) {
    cachedSeedRows = []
    return cachedSeedRows
  }

  const seedFiles = fs
    .readdirSync(DATA_DIR)
    .filter((file) => /^qbank_seed.*\.jsonl$/i.test(file))
    .sort()

  cachedSeedRows = seedFiles.flatMap((file) => {
    const raw = fs.readFileSync(path.join(DATA_DIR, file), 'utf8')
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as QbankSeedRow)
  })

  return cachedSeedRows
}

function scoreSeedRow(row: QbankSeedRow, query: string) {
  const tokens = tokenize(query)
  const normalizedQuery = normalizeQuery(query).toLowerCase()
  const haystack = [
    row.board,
    row.level,
    row.subject,
    row.chapter,
    row.topic,
    row.search_text,
    row.summary,
    row.question_text,
    row.answer_summary,
    row.paper,
    row.question_label,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  let score = 0
  for (const token of tokens) {
    if (haystack.includes(token)) {
      score += 3
    }
  }

  if (/\b20\d{2}\b/.test(normalizedQuery) && row.year && normalizedQuery.includes(String(row.year))) {
    score += 6
  }

  if (/paper/i.test(normalizedQuery) && row.paper) {
    score += 4
  }

  if (/important|repeat|topic|chapter|vector|vectors/i.test(normalizedQuery) && row.record_type === 'qbank_topic') {
    score += 4
  }

  if (/solve|answer|question|working|year wise|yearwise/i.test(normalizedQuery) && row.record_type === 'qbank_question') {
    score += 4
  }

  if (row.record_type === 'qbank_question') {
    if (row.link_quality === 'exact') {
      score += 18
    } else if (row.link_quality === 'hierarchical') {
      score += row.link_confidence === 'medium' ? 8 : 2
    } else if (row.link_quality === 'unlinked') {
      score -= 4
    }

    if (row.answer_ready) {
      score += 6
    }
  }

  if (row.board && normalizedQuery.includes(row.board.toLowerCase())) {
    score += 5
  }

  if (row.subject && normalizedQuery.includes(row.subject.toLowerCase())) {
    score += 4
  }

  if (row.topic && normalizedQuery.includes(row.topic.toLowerCase())) {
    score += 5
  }

  if (row.chapter && normalizedQuery.includes(row.chapter.toLowerCase())) {
    score += 4
  }

  return score
}

function buildTopicContent(row: TopicMatch) {
  return [
    `${row.board} ${row.level} ${row.subject}`,
    `${row.chapter} - ${row.topic}`,
    row.summary,
    row.repeatYears.length > 0 ? `Repeat years: ${row.repeatYears.join(', ')}` : '',
    row.examTips.length > 0 ? `Exam tips: ${row.examTips.join(' ')}` : '',
  ]
    .filter(Boolean)
    .join('. ')
}

function buildQuestionContent(row: QuestionMatch) {
  const linkageLine =
    row.linkQuality === 'exact'
      ? 'Official answer linkage: exact mark-scheme match.'
      : row.linkQuality === 'hierarchical'
        ? `Official answer linkage: partial ${row.linkConfidence}-confidence mark-scheme match. Use carefully.`
        : 'Official answer linkage: no exact official answer span linked yet. Use the question paper and mark scheme together.'

  return [
    `${row.board} ${row.level} ${row.subject}`,
    row.year ? `Year ${row.year}` : '',
    row.paper || '',
    row.questionLabel || '',
    row.questionText,
    linkageLine,
    `Answer summary: ${row.answerSummary}`,
    row.methodSteps.length > 0 ? `Method: ${row.methodSteps.join(' ')}` : '',
    row.repeatSignal ? `Repeat pattern: ${row.repeatSignal}` : '',
  ]
    .filter(Boolean)
    .join('. ')
}

function mapSeedTopic(row: QbankSeedRow): TopicMatch {
  return {
    id: row.id,
    board: row.board,
    level: row.level,
    subject: row.subject,
    chapter: row.chapter,
    topic: row.topic,
    importanceScore: row.importance_score ?? 50,
    summary: row.summary ?? '',
    repeatYears: row.repeat_years ?? [],
    examTips: row.exam_tips ?? [],
    sourceLabel: row.source_label ?? null,
    sourceUrl: row.source_url ?? null,
  }
}

function mapSeedQuestion(row: QbankSeedRow): QuestionMatch {
  return {
    id: row.id,
    board: row.board,
    level: row.level,
    subject: row.subject,
    chapter: row.chapter,
    topic: row.topic,
    year: row.year ?? null,
    paper: row.paper ?? null,
    questionLabel: row.question_label ?? null,
    questionText: row.question_text ?? '',
    answerSummary: row.answer_summary ?? '',
    methodSteps: row.method_steps ?? [],
    repeatSignal: row.repeat_signal ?? null,
    sourceLabel: row.source_label ?? null,
    sourceUrl: row.source_url ?? null,
    answerSourceUrl: row.answer_source_url ?? null,
    linkQuality: row.link_quality ?? 'unknown',
    linkScore: row.link_score ?? 0,
    linkConfidence: row.link_confidence ?? 'none',
    answerReady: row.answer_ready ?? false,
  }
}

function rankQuestionMatch(row: QuestionMatch, parsed: QbankParsedQuery) {
  let score = 0

  if (row.linkQuality === 'exact') {
    score += 80
  } else if (row.linkQuality === 'hierarchical') {
    score += row.linkConfidence === 'medium' ? 35 : 14
  } else if (row.linkQuality === 'unlinked') {
    score -= 18
  }

  if (row.answerReady) {
    score += 18
  }

  if (parsed.year && row.year === parsed.year) {
    score += 14
  }

  if (parsed.paper && row.paper?.toLowerCase().includes(parsed.paper.toLowerCase())) {
    score += 12
  }

  if (parsed.subject && row.subject.toLowerCase().includes(parsed.subject.toLowerCase())) {
    score += 10
  }

  if (parsed.intent === 'solve' || parsed.intent === 'question_lookup') {
    score += row.questionText.length > 40 ? 8 : 0
  }

  if (parsed.topicHints.some((hint) => row.questionText.toLowerCase().includes(hint) || row.topic.toLowerCase().includes(hint))) {
    score += 8
  }

  return score
}

async function searchTopicsInDb(query: string): Promise<TopicMatch[]> {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('qbank_topic_map')
    .select(
      'id, board, level, subject, chapter, topic, importance_score, repeat_years, exam_tips, summary, source_label, source_url'
    )
    .textSearch('fts', normalizeQuery(query), {
      type: 'websearch',
      config: 'english',
    })
    .order('importance_score', { ascending: false })
    .limit(4)

  if (error) {
    throw error
  }

  return (
    (data as
      | Array<{
          id: string
          board: string
          level: string
          subject: string
          chapter: string
          topic: string
          importance_score: number
          repeat_years: string[] | null
          exam_tips: string[] | null
          summary: string
          source_label: string | null
          source_url: string | null
        }>
      | null) ?? []
  ).map((row) => ({
    id: row.id,
    board: row.board,
    level: row.level,
    subject: row.subject,
    chapter: row.chapter,
    topic: row.topic,
    importanceScore: row.importance_score,
    summary: row.summary,
    repeatYears: row.repeat_years ?? [],
    examTips: row.exam_tips ?? [],
    sourceLabel: row.source_label,
    sourceUrl: row.source_url,
  }))
}

async function searchQuestionsInDb(query: string): Promise<QuestionMatch[]> {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('qbank_questions')
    .select(
      'id, board, level, subject, chapter, topic, year, paper, question_label, question_text, answer_summary, method_steps, repeat_signal, source_label, source_url'
    )
    .textSearch('fts', normalizeQuery(query), {
      type: 'websearch',
      config: 'english',
    })
    .order('year', { ascending: false })
    .limit(4)

  if (error) {
    throw error
  }

  return (
    (data as
      | Array<{
          id: string
          board: string
          level: string
          subject: string
          chapter: string
          topic: string
          year: number | null
          paper: string | null
          question_label: string | null
          question_text: string
          answer_summary: string
          method_steps: string[] | null
          repeat_signal: string | null
          source_label: string | null
          source_url: string | null
        }>
      | null) ?? []
  ).map((row) => ({
    id: row.id,
    board: row.board,
    level: row.level,
    subject: row.subject,
    chapter: row.chapter,
    topic: row.topic,
    year: row.year,
    paper: row.paper,
    questionLabel: row.question_label,
    questionText: row.question_text,
    answerSummary: row.answer_summary,
    methodSteps: row.method_steps ?? [],
    repeatSignal: row.repeat_signal,
    sourceLabel: row.source_label,
    sourceUrl: row.source_url,
    answerSourceUrl: null,
    linkQuality: 'unknown',
    linkScore: 0,
    linkConfidence: 'none',
    answerReady: false,
  }))
}

function searchTopicsInSeed(query: string): TopicMatch[] {
  const parsed = parseQbankQuery(query)
  const rows = getSeedRows().filter((row) => matchesParsedFilters(row, parsed))
  const candidates = rows.length > 0 ? rows : getSeedRows()

  return candidates
    .filter((row) => row.record_type === 'qbank_topic')
    .map((row) => ({ row, score: scoreSeedRow(row, query) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((entry) => mapSeedTopic(entry.row))
}

function searchQuestionsInSeed(query: string): QuestionMatch[] {
  const parsed = parseQbankQuery(query)
  const rows = getSeedRows().filter((row) => matchesParsedFilters(row, parsed))
  const candidates = rows.length > 0 ? rows : getSeedRows()

  return candidates
    .filter((row) => row.record_type === 'qbank_question')
    .map((row) => ({ row, score: scoreSeedRow(row, query) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => mapSeedQuestion(entry.row))
    .sort((a, b) => rankQuestionMatch(b, parsed) - rankQuestionMatch(a, parsed))
    .slice(0, 4)
}

export async function searchQbankTopics(query: string) {
  try {
    const matches = await searchTopicsInDb(query)
    if (matches.length > 0) {
      return { enabled: true, source: 'db', matches }
    }
  } catch (error) {
    if (!isMissingQbankError(error)) {
      throw error
    }
  }

  return {
    enabled: false,
    source: 'seed',
    matches: searchTopicsInSeed(query),
  }
}

export async function searchQbankQuestions(query: string) {
  const parsed = parseQbankQuery(query)

  try {
    const matches = await searchQuestionsInDb(query)
    if (matches.length > 0) {
      return {
        enabled: true,
        source: 'db',
        matches: matches
          .sort((a, b) => rankQuestionMatch(b, parsed) - rankQuestionMatch(a, parsed))
          .slice(0, 4),
      }
    }
  } catch (error) {
    if (!isMissingQbankError(error)) {
      throw error
    }
  }

  return {
    enabled: false,
    source: 'seed',
    matches: searchQuestionsInSeed(query),
  }
}

export async function retrieveQbankContext(message: string) {
  const parsedQuery = parseQbankQuery(message)
  const [topicResult, questionResult, sourceResult, paperResult] = await Promise.all([
    searchQbankTopics(message),
    searchQbankQuestions(message),
    searchQbankSources(parsedQuery),
    searchQbankPapers(parsedQuery),
  ])
  const paperPairMatches = searchQbankPaperPairs(parsedQuery)
  const pdfChunkMatches = searchQbankPdfChunks(parsedQuery)
  const gapMatches = searchQbankGapStatuses(parsedQuery) as QbankGapMatch[]
  const blockedRecoveryMatches = searchQbankBlockedRecovery(parsedQuery) as QbankBlockedRecoveryContextMatch[]
  const nearbyResourceMatches = searchNearbyQbankResources(parsedQuery, gapMatches) as QbankNearbyResourceMatch[]
  const conceptResult = await searchQbankConcepts(parsedQuery)

  const prioritizedQuestionMatches = [...questionResult.matches].sort(
    (a, b) => rankQuestionMatch(b, parsedQuery) - rankQuestionMatch(a, parsedQuery)
  )

  const questionChunks: QbankContextChunk[] = prioritizedQuestionMatches.slice(0, 2).map((row) => ({
    id: row.id,
    content: buildQuestionContent(row),
    sourceTitle: `${row.board} ${row.level} ${row.subject}${row.year ? ` ${row.year}` : ''}${row.paper ? ` ${row.paper}` : ''}${row.questionLabel ? ` ${row.questionLabel}` : ''}${row.linkQuality === 'exact' ? ' [exact]' : row.linkQuality === 'hierarchical' ? ' [partial]' : ' [question-only]'}`,
    sourceUrl: row.answerSourceUrl ?? row.sourceUrl,
    tier:
      row.linkQuality === 'exact'
        ? 'qbank_exact_answer'
        : row.linkQuality === 'hierarchical'
          ? 'qbank_partial_answer'
          : questionResult.enabled
            ? 'qbank_db'
            : 'qbank_seed',
    lastChecked: null,
  }))

  const topicChunks: QbankContextChunk[] = topicResult.matches.slice(0, 2).map((row) => ({
    id: row.id,
    content: buildTopicContent(row),
    sourceTitle: `${row.board} ${row.level} ${row.subject} - ${row.topic}`,
    sourceUrl: row.sourceUrl,
    tier: topicResult.enabled ? 'qbank_db' : 'qbank_seed',
    lastChecked: null,
  }))

  const conceptChunks: QbankContextChunk[] = conceptResult.matches.slice(0, 2).map((row) => ({
    id: row.id,
    content: `${row.board} ${row.level} ${row.subject}. ${row.chapter} - ${row.topic}. ${row.conceptSummary} ${row.formulaCandidates.length > 0 ? `Formula hints: ${row.formulaCandidates.join(' | ')}.` : ''} ${row.examTips.length > 0 ? `Exam tips: ${row.examTips.join(' ')}` : ''}`,
    sourceTitle: `${row.subject} concept - ${row.topic}`,
    sourceUrl: row.sourceUrls[0] ?? null,
    tier: conceptResult.enabled ? 'qbank_concept_db' : 'qbank_concept_seed',
    lastChecked: null,
  }))

  const sourceChunks: QbankContextChunk[] = sourceResult.matches.slice(0, 2).map((row) => ({
    id: row.id,
    content: `${row.title}. Provider: ${row.provider}. Board: ${row.board}. Level: ${row.level}. Subject: ${row.subject}. Use this source as ${row.allowedUse}.`,
    sourceTitle: row.title,
    sourceUrl: row.url,
    tier: sourceResult.enabled ? 'qbank_source_db' : 'qbank_source_seed',
    lastChecked: null,
  }))

  const paperChunks: QbankContextChunk[] = paperResult.matches.slice(0, 2).map((row) => ({
    id: row.id,
    content: `${row.board} ${row.level} ${row.subject}. ${row.year ?? 'Unknown year'} ${row.paper}. ${row.paperTitle}. ${row.session ? `Session: ${row.session}.` : ''} ${row.focusTopics.length > 0 ? `Focus topics: ${row.focusTopics.join(', ')}.` : ''}`,
    sourceTitle: `${row.board} ${row.level} ${row.subject} ${row.year ?? ''} ${row.paper}`.trim(),
    sourceUrl: row.sourceUrl,
    tier: paperResult.enabled ? 'qbank_paper_db' : 'qbank_paper_seed',
    lastChecked: null,
  }))

  const paperPairChunks: QbankContextChunk[] = paperPairMatches.slice(0, 2).map((row) => ({
    id: row.id,
    content: `${row.board} ${row.level} ${row.subject}. ${row.year ?? 'Unknown year'} ${row.paperCode ? `Paper ${row.paperCode}.` : ''} Pair completeness: ${row.completeness}. ${row.questionPaperUrl ? 'Question paper available.' : ''} ${row.markSchemeUrl ? 'Mark scheme available.' : ''} ${row.examinerReportUrl ? 'Examiner report available.' : ''} ${row.confidentialInstructionsUrl ? 'Practical/confidential instructions available.' : ''}`,
    sourceTitle: `${row.board} ${row.level} ${row.subject} ${row.year ?? ''} ${row.paperCode ? `Paper ${row.paperCode}` : 'paper pair'}`.trim(),
    sourceUrl: row.questionPaperUrl ?? row.markSchemeUrl ?? row.examinerReportUrl ?? row.specimenMarkSchemeUrl,
    tier: 'qbank_paper_pair',
    lastChecked: null,
  }))

  const pdfTextChunks: QbankContextChunk[] = pdfChunkMatches.slice(0, 2).map((row) => ({
    id: row.id,
    content: `${row.board} ${row.level} ${row.subject}. ${row.title}. ${row.visualRich ? `Visual note: this source includes diagrams/graphs/tables risk ${row.visualRisk ?? 'medium'}.` : ''} ${row.content}`,
    sourceTitle: `${row.board} ${row.level} ${row.subject} - ${row.resourceType.replace(/_/g, ' ')}`,
    sourceUrl: row.sourceUrl,
    tier: 'qbank_pdf_text',
    lastChecked: null,
  }))

  const blockedRecoveryChunks: QbankContextChunk[] = blockedRecoveryMatches.slice(0, 2).map((row) => ({
    id: row.id,
    content: `Blocked recovery status: ${row.board} ${row.level} ${row.subject} ${row.year ?? 'unknown year'} ${row.resourceType.replace(/_/g, ' ')} is officially listed but still externally access-blocked${row.officialHttpStatus ? ` (HTTP ${row.officialHttpStatus})` : ''}. Exact filename: ${row.exactFilename ?? 'unknown'}. Do not pretend the file body is loaded. Use nearby official alternatives and tell the student this exact file remains blocked in collection.`,
    sourceTitle: `${row.subject} ${row.year ?? ''} ${row.resourceType.replace(/_/g, ' ')} blocked recovery`.trim(),
    sourceUrl: row.officialUrl ?? row.supportSourceUrls[0] ?? row.publicListingUrls[0] ?? null,
    tier: 'qbank_blocked_recovery',
    lastChecked: null,
  }))

  const gapChunks: QbankContextChunk[] = gapMatches.slice(0, 2).map((row) => ({
    id: row.id,
    content:
      row.status === 'access_blocked'
        ? `Coverage status: ${row.board} ${row.level} ${row.subject} ${row.year ?? 'unknown year'} ${row.resourceType.replace(/_/g, ' ')} is listed on an official source but currently access-blocked${row.httpStatus ? ` (HTTP ${row.httpStatus})` : ''}. Do not claim the exact paper or report text is loaded. Tell the student the official listing exists but the file is not publicly retrievable in the current dataset.`
        : row.status === 'source_page_available'
          ? `Coverage status: ${row.board} ${row.level} ${row.subject} ${row.year ?? 'unknown year'} ${row.resourceType.replace(/_/g, ' ')} has an official source page, but the exact PDF is not recovered into the current dataset yet. Do not pretend the exact text is loaded.`
          : `Coverage status: ${row.board} ${row.level} ${row.subject} ${row.year ?? 'unknown year'} ${row.resourceType.replace(/_/g, ' ')} is not yet published in the current known official window. Do not invent this paper or report.`,
    sourceTitle: `${row.board} ${row.level} ${row.subject} ${row.year ?? ''} ${row.resourceType.replace(/_/g, ' ')} coverage status`.trim(),
    sourceUrl: row.sourceUrls[0] ?? null,
    tier: 'qbank_gap_status',
    lastChecked: null,
  }))

  const nearbyResourceChunks: QbankContextChunk[] = nearbyResourceMatches.slice(0, 2).map((row) => ({
    id: row.id,
    content: `Closest official fallback: ${row.board} ${row.level} ${row.subject} ${row.year ?? 'unknown year'} ${row.paperCode ? `Paper ${row.paperCode}. ` : ''}${row.resourceType.replace(/_/g, ' ')} is available from an official source. ${row.yearDistance === null ? '' : `This is ${row.yearDistance} year${row.yearDistance === 1 ? '' : 's'} away from the requested year. `}${row.samePaper ? 'Paper code matches the requested paper. ' : ''}Use this as the nearest official alternative, not as proof that the blocked year has identical content.`,
    sourceTitle: row.title,
    sourceUrl: row.url,
    tier: 'qbank_nearby_official',
    lastChecked: null,
  }))

  return {
    enabled:
      blockedRecoveryChunks.length > 0 ||
      gapChunks.length > 0 ||
      nearbyResourceChunks.length > 0 ||
      conceptChunks.length > 0 ||
      questionChunks.length > 0 ||
      topicChunks.length > 0 ||
      sourceChunks.length > 0 ||
      paperChunks.length > 0 ||
      paperPairChunks.length > 0 ||
      pdfTextChunks.length > 0,
    chunks: [...blockedRecoveryChunks, ...gapChunks, ...nearbyResourceChunks, ...conceptChunks, ...questionChunks, ...topicChunks, ...paperPairChunks, ...paperChunks, ...pdfTextChunks, ...sourceChunks].slice(0, 4),
    topicMatches: topicResult.matches,
    conceptMatches: conceptResult.matches,
    questionMatches: prioritizedQuestionMatches,
    paperMatches: paperResult.matches,
    paperPairMatches,
    pdfChunkMatches,
    gapMatches,
    blockedRecoveryMatches,
    nearbyResourceMatches,
    sourceMatches: sourceResult.matches,
    sourceMode:
      questionResult.enabled || topicResult.enabled || sourceResult.enabled || paperResult.enabled
        ? 'db'
        : 'seed',
    parsedQuery,
  }
}
