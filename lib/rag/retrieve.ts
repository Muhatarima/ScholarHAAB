import type { SupabaseClient } from '@supabase/supabase-js'
import { logError, logEvent } from '@/lib/server/logger'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'

export type RagMetadata = {
  board?: string | null
  level?: string | null
  subject?: string | null
  topic?: string | null
  year?: number | string | null
  year_from?: number | null
  year_to?: number | null
  paper?: string | null
  question_number?: string | number | null
  source_file?: string | null
  [key: string]: unknown
}

export type RagMatch = {
  id: string
  content: string
  metadata: RagMetadata
  sourceTitle: string
  sourceUrl: string | null
  sourceKind: string | null
  tier: string | null
  vectorSimilarity: number | null
  textScore: number | null
  hybridScore: number | null
}

export type RagRetrievalResult = {
  matches: RagMatch[]
  mode: 'hybrid' | 'keyword' | 'none'
  embeddingAvailable: boolean
  embeddingProvider?: string | null
}

type DbRow = {
  id?: unknown
  content?: unknown
  metadata?: unknown
  source_title?: unknown
  source_url?: unknown
  source_kind?: unknown
  source_subject?: unknown
  source_board?: unknown
  source_topic?: unknown
}

const STOP_WORDS = new Set([
  'cambridge',
  'edexcel',
  'igcse',
  'gcse',
  'level',
  'paper',
  'question',
  'answer',
  'explain',
  'calculate',
  'state',
  'define',
  'describe',
  'what',
  'why',
  'how',
  'when',
  'where',
  'with',
  'from',
  'that',
  'this',
  'these',
  'those',
  'using',
  'give',
  'show',
  'find',
  'the',
  'and',
  'for',
  'are',
  'was',
  'were',
  'into',
  'about',
])

function getRagClient(): SupabaseClient {
  return getSupabaseAdmin()
}

function clean(value?: unknown) {
  return String(value ?? '').trim()
}

function asText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function asNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function normalizeMetadata(value: unknown): RagMetadata {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as RagMetadata)
    : {}
}

function normalizeRow(row: DbRow): RagMatch | null {
  const id = asText(row.id)
  const content = asText(row.content)
  if (!id || !content) return null

  const metadata = normalizeMetadata(row.metadata)

  return {
    id,
    content,
    metadata,
    sourceTitle:
      asText(row.source_title) ||
      asText(metadata.source_title) ||
      asText(metadata.source_file) ||
      'Academic source',
    sourceUrl: asText(row.source_url) || asText(metadata.source_url),
    sourceKind: asText(row.source_kind) || asText(metadata.resource_type),
    tier: null,
    vectorSimilarity: null,
    textScore: null,
    hybridScore: null,
  }
}

function normalizeRows(data: unknown): RagMatch[] {
  return ((data as DbRow[] | null) ?? [])
    .map(normalizeRow)
    .filter((row): row is RagMatch => Boolean(row))
}

function wordsFrom(text: string, max = 18) {
  const seen = new Set<string>()

  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word))
    .filter((word) => {
      if (seen.has(word)) return false
      seen.add(word)
      return true
    })
    .slice(0, max)
}

function guessSubject(question: string, explicit?: unknown) {
  const given = clean(explicit)
  if (given) return given

  const lower = question.toLowerCase()
  const subjects = [
    'Physics',
    'Chemistry',
    'Biology',
    'Mathematics',
    'Math',
    'Economics',
    'Business',
    'Accounting',
    'Computer Science',
    'English',
  ]

  return subjects.find((subject) => lower.includes(subject.toLowerCase())) ?? null
}

function getGeminiKey() {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    null
  )
}

async function expandWithAi(input: {
  question: string
  subject?: string | null
  board?: string | null
  level?: string | null
}) {
  const key = getGeminiKey()
  if (!key) return []

  const prompt = `
Return search keywords for finding Cambridge/Edexcel past-paper mark schemes.

Rules:
- Do not answer.
- Include syllabus topic, synonyms, formulas, examiner wording.
- Return only JSON array of strings.

Subject: ${input.subject || 'unknown'}
Board: ${input.board || 'unknown'}
Level: ${input.level || 'unknown'}
Question/topic: ${input.question}
`.trim()

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 180 },
        }),
      }
    )

    if (!response.ok) return []

    const json = await response.json()
    const text =
      json?.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part.text ?? '')
        .join('')
        .replace(/^```json/i, '')
        .replace(/^```/i, '')
        .replace(/```$/i, '')
        .trim() ?? ''

    const parsed = JSON.parse(text)
    return Array.isArray(parsed)
      ? parsed.map(clean).filter(Boolean).slice(0, 18)
      : []
  } catch (error) {
    logError('rag_query_expansion_failed', error, {
      subject: input.subject ?? null,
      question: input.question,
    })
    return []
  }
}

function sourceWeight(match: RagMatch) {
  const hay = `${match.sourceKind ?? ''} ${match.sourceTitle}`.toLowerCase()

  if (hay.includes('mark_scheme') || hay.includes('mark scheme') || hay.includes('_ms_')) return 900
  if (hay.includes('examiner_report') || hay.includes('examiner report') || hay.includes('_er')) return 750
  if (hay.includes('question_paper') || hay.includes('question paper') || hay.includes('_qp_')) return 700
  return 0
}

function rankMatches(
  matches: RagMatch[],
  input: {
    queryText: string
    subject?: string | null
    board?: string | null
    level?: string | null
  }
) {
  const terms = wordsFrom(input.queryText, 30)
  const subject = clean(input.subject).toLowerCase()
  const board = clean(input.board).toLowerCase()
  const level = clean(input.level).toLowerCase()

  return matches
    .map((match) => {
      const haystack = [
        match.content,
        match.sourceTitle,
        match.sourceKind,
        match.metadata.subject,
        match.metadata.topic,
        match.metadata.board,
        match.metadata.level,
        match.metadata.source_file,
      ]
        .map(clean)
        .join(' ')
        .toLowerCase()

      let score = sourceWeight(match)

      if (subject && haystack.includes(subject)) score += 300
      if (board && haystack.includes(board)) score += 80
      if (level && haystack.includes(level)) score += 80

      for (const term of terms) {
        if (haystack.includes(term)) score += 20
      }

      if (match.content.length > 60 && match.content.length < 2500) score += 20

      return { match, score }
    })
    .sort((a, b) => b.score - a.score)
    .map((item) => ({
      ...item.match,
      textScore: item.score,
      hybridScore: item.score,
    }))
}


function markSchemeLookupKeys(title: string) {
  const keys = new Set<string>()
  const cleanTitle = title.trim()

  if (!cleanTitle) return []

  keys.add(cleanTitle.replace(/question paper/gi, 'mark scheme').replace(/_qp_/gi, '_ms_'))

  const fileMatch = cleanTitle.match(/([0-9]{4}_[a-z][0-9]{2}_qp_[0-9]{2}\.pdf)/i)
  if (fileMatch?.[1]) {
    keys.add(fileMatch[1].replace(/_qp_/i, '_ms_'))
  }

  const noPdfMatch = cleanTitle.match(/([0-9]{4}_[a-z][0-9]{2}_qp_[0-9]{2})/i)
  if (noPdfMatch?.[1]) {
    keys.add(noPdfMatch[1].replace(/_qp_/i, '_ms_'))
  }

  return Array.from(keys)
}

async function findPairedMarkSchemes(
  client: SupabaseClient,
  questionPapers: RagMatch[],
  limit: number
) {
  const found: RagMatch[] = []

  for (const paper of questionPapers.slice(0, 8)) {
    const keys = markSchemeLookupKeys(paper.sourceTitle)

    for (const key of keys) {
      const { data, error } = await client
        .from('documents')
        .select('id, content, metadata, source_title, source_url, source_kind, source_subject, source_board, source_topic')
        .eq('source_kind', 'mark_scheme')
        .ilike('source_title', `%${key}%`)
        .limit(3)

      if (!error && data?.length) {
        found.push(...normalizeRows(data))
      }

      if (found.length >= limit) break
    }

    if (found.length >= limit) break
  }

  return found
}

function uniqueMatches(matches: RagMatch[]) {
  return Array.from(new Map(matches.map((match) => [match.id, match])).values())
}

async function searchKind(
  client: SupabaseClient,
  queryText: string,
  kind: 'mark_scheme' | 'examiner_report' | 'question_paper',
  filters: {
    subject?: string | null
    board?: string | null
    level?: string | null
  },
  limit: number,
  strict: boolean
) {
  const terms = wordsFrom(queryText, 14)
  const subject = clean(filters.subject)
  const board = clean(filters.board)
  const level = clean(filters.level)

  let query = client
    .from('documents')
    .select('id, content, metadata, source_title, source_url, source_kind, source_subject, source_board, source_topic')
    .eq('source_kind', kind)
    .limit(limit)

  if (strict && subject) {
    query = query.or(
      `source_subject.ilike.%${subject}%,source_title.ilike.%${subject}%,metadata->>subject.ilike.%${subject}%`
    )
  }

  if (strict && board) {
    query = query.or(
      `source_board.ilike.%${board}%,source_title.ilike.%${board}%,metadata->>board.ilike.%${board}%`
    )
  }

  if (strict && level) {
    query = query.or(
      `source_title.ilike.%${level}%,metadata->>level.ilike.%${level}%`
    )
  }

  if (terms.length) {
    const parts = terms.flatMap((term) => [
      `content.ilike.%${term}%`,
      `source_title.ilike.%${term}%`,
      `source_topic.ilike.%${term}%`,
      `metadata->>topic.ilike.%${term}%`,
    ])

    query = query.or(parts.join(','))
  }

  const { data, error } = await query

  if (error) {
    logError('rag_documents_ilike_search_failed', error, {
      kind,
      strict,
      query: queryText,
    })
    return []
  }

  return normalizeRows(data)
}

async function searchRpcBackup(client: SupabaseClient, queryText: string, limit: number) {
  const { data, error } = await client.rpc('search_documents_keyword', {
    query_text: queryText,
    match_count: limit,
    filter: {},
  })

  if (error) return []
  return normalizeRows(data)
}

async function runSearch(
  client: SupabaseClient,
  queryText: string,
  filters: {
    subject?: string | null
    board?: string | null
    level?: string | null
  },
  limit: number
) {
  const strict = (
    await Promise.all([
      searchKind(client, queryText, 'mark_scheme', filters, limit * 10, true),
      searchKind(client, queryText, 'examiner_report', filters, limit * 4, true),
      searchKind(client, queryText, 'question_paper', filters, limit * 4, true),
    ])
  ).flat()

  const loose =
    strict.length >= Math.min(limit, 4)
      ? []
      : (
          await Promise.all([
            searchKind(client, queryText, 'mark_scheme', filters, limit * 10, false),
            searchKind(client, queryText, 'examiner_report', filters, limit * 4, false),
            searchKind(client, queryText, 'question_paper', filters, limit * 4, false),
            searchRpcBackup(client, queryText, limit * 4),
          ])
        ).flat()

  const baseMatches = uniqueMatches([...strict, ...loose])
  const questionPapers = baseMatches.filter((match) => {
    const hay = `${match.sourceKind ?? ''} ${match.sourceTitle}`.toLowerCase()
    return hay.includes('question_paper') || hay.includes('question paper') || hay.includes('_qp_')
  })

  const pairedMarkSchemes = await findPairedMarkSchemes(client, questionPapers, limit * 4)

  return uniqueMatches([...pairedMarkSchemes, ...baseMatches])
}

export async function retrieveAcademicContext(
  question: string,
  options: {
    filters?: RagMetadata
    limit?: number
    requestId: string
  }
): Promise<RagRetrievalResult> {
  const limit = Math.min(Math.max(options.limit ?? 6, 1), 12)

  try {
    const client = getRagClient()
    const filters = options.filters ?? {}

    const subject = guessSubject(question, filters.subject)
    const board = clean(filters.board)
    const level = clean(filters.level)
    const topic = clean(filters.topic)

    const aiTerms = await expandWithAi({
      question: [question, topic].filter(Boolean).join(' '),
      subject,
      board,
      level,
    })

    const queryText = [
      question,
      subject,
      board,
      level,
      topic,
      ...aiTerms,
    ]
      .map(clean)
      .filter(Boolean)
      .join(' ')

    const rawMatches = await runSearch(client, queryText, { subject, board, level }, limit)

    const matches = rankMatches(rawMatches, {
      queryText,
      subject,
      board,
      level,
    }).slice(0, limit)

    logEvent('info', 'rag_retrieval_complete', {
      request_id: options.requestId,
      table: 'documents',
      search: 'ilike_plus_rpc',
      match_count: matches.length,
      mark_scheme_count: matches.filter((match) => match.sourceKind === 'mark_scheme').length,
      subject,
      board,
      level,
      ai_terms: aiTerms.slice(0, 8),
    })

    return {
      matches,
      mode: matches.length ? 'keyword' : 'none',
      embeddingAvailable: false,
      embeddingProvider: null,
    }
  } catch (error) {
    logError('rag_retrieval_failed', error, {
      request_id: options.requestId,
    })

    return {
      matches: [],
      mode: 'none',
      embeddingAvailable: false,
      embeddingProvider: null,
    }
  }
}

export async function retrieveTopicDocuments(options: {
  board?: string | null
  limit?: number
  requestId: string
  subject?: string | null
  topic?: string | null
}) {
  const limit = Math.min(Math.max(options.limit ?? 16, 1), 30)

  try {
    const client = getRagClient()

    const subject = guessSubject(options.topic ?? '', options.subject)
    const board = clean(options.board)
    const topic = clean(options.topic)

    const aiTerms = await expandWithAi({
      question: topic || subject || board || 'exam topic',
      subject,
      board,
      level: null,
    })

    const queryText = [topic, subject, board, ...aiTerms]
      .map(clean)
      .filter(Boolean)
      .join(' ')

    const rawMatches = await runSearch(client, queryText, { subject, board, level: null }, limit)

    const matches = rankMatches(rawMatches, {
      queryText,
      subject,
      board,
      level: null,
    }).slice(0, limit)

    logEvent('info', 'rag_topic_documents_loaded', {
      request_id: options.requestId,
      table: 'documents',
      search: 'ilike_plus_rpc',
      match_count: matches.length,
      mark_scheme_count: matches.filter((match) => match.sourceKind === 'mark_scheme').length,
      subject,
      board,
      topic,
      ai_terms: aiTerms.slice(0, 8),
    })

    return matches
  } catch (error) {
    logError('rag_topic_documents_failed', error, {
      request_id: options.requestId,
    })
    return []
  }
}
