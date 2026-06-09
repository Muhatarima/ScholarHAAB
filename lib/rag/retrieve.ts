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

type RagRpcRow = {
  id?: unknown
  content?: unknown
  metadata?: unknown
  source_title?: unknown
  source_url?: unknown
  source_kind?: unknown
  tier?: unknown
  vector_similarity?: unknown
  similarity?: unknown
  text_score?: unknown
  hybrid_score?: unknown
}

const expansionCache = new Map<string, string[]>()

function getRagClient(): SupabaseClient {
  return getSupabaseAdmin()
}

function asText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function asNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function clean(value?: string | number | null) {
  return String(value ?? '').trim()
}

function normalizeMetadata(value: unknown): RagMetadata {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as RagMetadata)
    : {}
}

function normalizeRow(row: RagRpcRow): RagMatch | null {
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
    tier: asText(row.tier),
    vectorSimilarity: asNumber(row.vector_similarity) ?? asNumber(row.similarity),
    textScore: asNumber(row.text_score),
    hybridScore: asNumber(row.hybrid_score),
  }
}

function normalizeRows(data: unknown): RagMatch[] {
  return ((data as RagRpcRow[] | null) ?? [])
    .map(normalizeRow)
    .filter((row): row is RagMatch => Boolean(row))
}

function wordsFrom(text: string, max = 18) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean)
    .filter((word) => word.length >= 3)
    .filter(
      (word) =>
        ![
          'cambridge',
          'edexcel',
          'level',
          'igcse',
          'gcse',
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
        ].includes(word)
    )
    .slice(0, max)
}

function guessSubject(text: string, explicit?: string | null) {
  const given = clean(explicit)
  if (given) return given

  const lower = text.toLowerCase()

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

async function expandQueryWithAi(input: {
  question: string
  subject?: string | null
  board?: string | null
  level?: string | null
}) {
  const cacheKey = JSON.stringify(input).toLowerCase()
  const cached = expansionCache.get(cacheKey)
  if (cached) return cached

  const key = getGeminiKey()
  if (!key) return []

  const prompt = `
You are a Cambridge/Edexcel exam retrieval query planner.

Task:
Convert the student's question/topic into search keywords that can find relevant past-paper mark schemes.

Rules:
- Cover the syllabus concept behind the question.
- Include synonyms, chapter names, formula names, common examiner wording, and related keywords.
- Do not answer the question.
- Return ONLY a JSON array of short strings.
- No markdown.

Board: ${input.board || 'unknown'}
Level: ${input.level || 'unknown'}
Subject: ${input.subject || 'unknown'}
Student question/topic: ${input.question}

Example output:
["motion", "velocity", "acceleration", "displacement", "speed time graph"]
`.trim()

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 180,
          },
        }),
      }
    )

    if (!response.ok) return []

    const json = await response.json()
    const text =
      json?.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part.text ?? '')
        .join('')
        .trim() ?? ''

    const cleaned = text
      .replace(/^```json/i, '')
      .replace(/^```/i, '')
      .replace(/```$/i, '')
      .trim()

    const parsed = JSON.parse(cleaned)
    const terms = Array.isArray(parsed)
      ? parsed
          .map((item) => clean(item))
          .filter(Boolean)
          .slice(0, 20)
      : []

    expansionCache.set(cacheKey, terms)
    return terms
  } catch (error) {
    logError('rag_ai_query_expansion_failed', error, {
      question: input.question,
      subject: input.subject ?? null,
    })
    return []
  }
}

function buildSearchText(input: {
  question: string
  subject?: string | null
  board?: string | null
  level?: string | null
  topic?: string | null
  aiTerms?: string[]
}) {
  return [
    input.question,
    input.subject,
    input.board,
    input.level,
    input.topic,
    ...(input.aiTerms ?? []),
  ]
    .map((item) => clean(item))
    .filter(Boolean)
    .join(' ')
}

async function searchKeywordRpc(
  client: SupabaseClient,
  queryText: string,
  limit: number
) {
  const { data, error } = await client.rpc('search_documents_keyword', {
    query_text: queryText,
    match_count: limit,
    filter: {},
  })

  if (error) {
    logError('rag_keyword_rpc_failed', error, { query: queryText })
    return []
  }

  return normalizeRows(data)
}

function applySoftFilters(
  query: ReturnType<SupabaseClient['from']> extends infer T ? any : never,
  filters: {
    subject?: string | null
    board?: string | null
    level?: string | null
  }
) {
  const subject = clean(filters.subject)
  const board = clean(filters.board)
  const level = clean(filters.level)

  let next = query

  if (subject) {
    next = next.or(
      `source_subject.ilike.%${subject}%,metadata->>subject.ilike.%${subject}%,source_title.ilike.%${subject}%`
    )
  }

  if (board) {
    next = next.or(
      `source_board.ilike.%${board}%,metadata->>board.ilike.%${board}%,source_title.ilike.%${board}%`
    )
  }

  if (level) {
    next = next.or(
      `metadata->>level.ilike.%${level}%,source_title.ilike.%${level}%`
    )
  }

  return next
}

async function searchDocumentsByKind(
  client: SupabaseClient,
  queryText: string,
  sourceKind: string | null,
  limit: number,
  filters: {
    subject?: string | null
    board?: string | null
    level?: string | null
  },
  strictFilters: boolean
) {
  const words = wordsFrom(queryText, 16)

  let query = client
    .from('documents')
    .select('id, content, metadata, source_title, source_url, source_kind')
    .limit(limit)

  if (sourceKind) {
    query = query.eq('source_kind', sourceKind)
  }

  if (strictFilters) {
    query = applySoftFilters(query, filters)
  }

  if (words.length) {
    const parts = words.flatMap((word) => [
      `content.ilike.%${word}%`,
      `source_title.ilike.%${word}%`,
      `source_subject.ilike.%${word}%`,
      `source_topic.ilike.%${word}%`,
      `metadata->>subject.ilike.%${word}%`,
      `metadata->>topic.ilike.%${word}%`,
      `metadata->>board.ilike.%${word}%`,
      `metadata->>level.ilike.%${word}%`,
    ])

    query = query.or(parts.join(','))
  }

  const { data, error } = await query

  if (error) {
    logError('rag_documents_search_failed', error, {
      source_kind: sourceKind,
      query: queryText,
      strict_filters: strictFilters,
    })
    return []
  }

  return normalizeRows(data)
}

function uniqueMatches(matches: RagMatch[]) {
  return Array.from(new Map(matches.map((match) => [match.id, match])).values())
}

function rankMatches(
  matches: RagMatch[],
  input: {
    searchText: string
    subject?: string | null
    board?: string | null
    level?: string | null
  }
) {
  const words = wordsFrom(input.searchText, 25)
  const subject = clean(input.subject).toLowerCase()
  const board = clean(input.board).toLowerCase()
  const level = clean(input.level).toLowerCase()

  return matches
    .map((match) => {
      const kind = clean(match.sourceKind).toLowerCase()

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
        .map((item) => clean(item as string | number | null).toLowerCase())
        .join(' ')

      let score = 0

      if (kind === 'mark_scheme' || haystack.includes('mark scheme') || haystack.includes('_ms_')) {
        score += 1000
      } else if (kind === 'examiner_report' || haystack.includes('examiner report')) {
        score += 500
      } else if (kind === 'question_paper' || haystack.includes('question paper') || haystack.includes('_qp_')) {
        score += 100
      }

      if (subject && haystack.includes(subject)) score += 250
      if (board && haystack.includes(board)) score += 80
      if (level && haystack.includes(level)) score += 80

      for (const word of words) {
        if (haystack.includes(word)) score += 12
      }

      const contentLength = match.content.length
      if (contentLength > 80 && contentLength < 2500) score += 20

      return { match, score }
    })
    .sort((a, b) => b.score - a.score)
    .map((item) => item.match)
}

async function searchAllSources(
  client: SupabaseClient,
  searchText: string,
  limit: number,
  filters: {
    subject?: string | null
    board?: string | null
    level?: string | null
  }
) {
  const strict = await Promise.all([
    searchDocumentsByKind(client, searchText, 'mark_scheme', limit * 8, filters, true),
    searchDocumentsByKind(client, searchText, 'examiner_report', limit * 4, filters, true),
    searchDocumentsByKind(client, searchText, 'question_paper', limit * 4, filters, true),
  ])

  const strictMatches = uniqueMatches(strict.flat())

  if (strictMatches.length >= Math.min(limit, 4)) {
    return strictMatches
  }

  const loose = await Promise.all([
    searchDocumentsByKind(client, searchText, 'mark_scheme', limit * 8, filters, false),
    searchDocumentsByKind(client, searchText, 'examiner_report', limit * 4, filters, false),
    searchDocumentsByKind(client, searchText, 'question_paper', limit * 4, filters, false),
    searchKeywordRpc(client, searchText, limit * 4),
  ])

  return uniqueMatches([...strictMatches, ...loose.flat()])
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

    const subject = guessSubject(question, clean(filters.subject as string | null))
    const board = clean(filters.board as string | null)
    const level = clean(filters.level as string | null)
    const topic = clean(filters.topic as string | null)

    const aiTerms = await expandQueryWithAi({
      question: [question, topic].filter(Boolean).join(' '),
      subject,
      board,
      level,
    })

    const searchText = buildSearchText({
      question,
      subject,
      board,
      level,
      topic,
      aiTerms,
    })

    const allMatches = await searchAllSources(client, searchText, limit, {
      subject,
      board,
      level,
    })

    const matches = rankMatches(allMatches, {
      searchText,
      subject,
      board,
      level,
    }).slice(0, limit)

    logEvent('info', 'rag_retrieval_complete', {
      request_id: options.requestId,
      match_count: matches.length,
      mark_scheme_count: matches.filter((m) => m.sourceKind === 'mark_scheme').length,
      mode: matches.length ? 'keyword' : 'none',
      table: 'documents',
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

    const aiTerms = await expandQueryWithAi({
      question: topic || subject || board || 'exam topic',
      subject,
      board,
      level: null,
    })

    const searchText = buildSearchText({
      question: topic,
      subject,
      board,
      level: null,
      topic,
      aiTerms,
    })

    const allMatches = await searchAllSources(client, searchText, limit, {
      subject,
      board,
      level: null,
    })

    const matches = rankMatches(allMatches, {
      searchText,
      subject,
      board,
      level: null,
    }).slice(0, limit)

    logEvent('info', 'rag_topic_documents_loaded', {
      board: options.board ?? null,
      match_count: matches.length,
      mark_scheme_count: matches.filter((m) => m.sourceKind === 'mark_scheme').length,
      request_id: options.requestId,
      subject: options.subject ?? null,
      topic: options.topic ?? null,
      ai_terms: aiTerms.slice(0, 8),
      table: 'documents',
    })

    return matches
  } catch (error) {
    logError('rag_topic_documents_failed', error, {
      request_id: options.requestId,
    })

    return []
  }
}
