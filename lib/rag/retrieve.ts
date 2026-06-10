import type { SupabaseClient } from '@supabase/supabase-js'
import { createQueryEmbedding } from '@/lib/embeddings/client'
import { logError, logEvent } from '@/lib/server/logger'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'

export type RagMetadata = {
  board?: string | null
  level?: string | null
  paper?: string | null
  question_number?: string | number | null
  source_file?: string | null
  subject?: string | null
  topic?: string | null
  year?: number | string | null
  [key: string]: unknown
}

export type RagMatch = {
  content: string
  hybridScore: number | null
  id: string
  metadata: RagMetadata
  sourceKind: string | null
  sourceTitle: string
  sourceUrl: string | null
  textScore: number | null
  tier: string | null
  vectorSimilarity: number | null
}

export type RagRetrievalResult = {
  embeddingAvailable: boolean
  embeddingProvider?: string | null
  matches: RagMatch[]
  mode: 'hybrid' | 'keyword' | 'none'
}

type DbRow = {
  content?: unknown
  hybrid_score?: unknown
  id?: unknown
  metadata?: unknown
  similarity?: unknown
  source_kind?: unknown
  source_title?: unknown
  source_url?: unknown
  text_score?: unknown
  tier?: unknown
  vector_similarity?: unknown
}

const STOP_WORDS = new Set([
  'answer',
  'calculate',
  'cambridge',
  'define',
  'describe',
  'edexcel',
  'explain',
  'find',
  'give',
  'level',
  'paper',
  'question',
  'show',
  'state',
  'that',
  'the',
  'this',
  'using',
  'what',
  'with',
])

function client(): SupabaseClient {
  return getSupabaseAdmin()
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function number(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function metadata(value: unknown): RagMetadata {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as RagMetadata)
    : {}
}

function normalizeRow(row: DbRow): RagMatch | null {
  const id = text(row.id)
  const content = text(row.content)
  if (!id || !content) return null

  const meta = metadata(row.metadata)
  return {
    content,
    hybridScore: number(row.hybrid_score) ?? number(row.similarity),
    id,
    metadata: meta,
    sourceKind: text(row.source_kind) || text(meta.source_kind) || text(meta.resource_type),
    sourceTitle:
      text(row.source_title) ||
      text(meta.source_title) ||
      text(meta.source_file) ||
      'Indexed source',
    sourceUrl: text(row.source_url) || text(meta.source_url),
    textScore: number(row.text_score),
    tier: text(row.tier),
    vectorSimilarity: number(row.vector_similarity) ?? number(row.similarity),
  }
}

function normalizeRows(data: unknown) {
  return ((data as DbRow[] | null) ?? [])
    .map(normalizeRow)
    .filter((row): row is RagMatch => Boolean(row))
}

function dedupe(matches: RagMatch[]) {
  return Array.from(new Map(matches.map((match) => [match.id, match])).values())
}

function cleanFilter(filter: RagMetadata = {}) {
  return Object.fromEntries(
    Object.entries(filter).filter(
      ([, value]) => value !== null && value !== undefined && String(value).trim() !== ''
    )
  )
}

function queryTerms(value: string, max = 10) {
  const seen = new Set<string>()
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s=+\-]/g, ' ')
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

function rank(matches: RagMatch[], query: string) {
  const terms = queryTerms(query, 18)
  return dedupe(matches)
    .map((match) => {
      const haystack = [
        match.content,
        match.sourceTitle,
        match.sourceKind,
        match.metadata.board,
        match.metadata.subject,
        match.metadata.topic,
        match.metadata.year,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const termScore = terms.reduce((score, term) => score + (haystack.includes(term) ? 0.04 : 0), 0)
      const sourceBoost = /mark[_\s-]?scheme|examiner[_\s-]?report|question[_\s-]?paper/i.test(
        `${match.sourceKind ?? ''} ${match.sourceTitle}`
      )
        ? 0.08
        : 0
      const semanticScore = match.hybridScore ?? match.vectorSimilarity ?? 0
      const textScore = Math.min(match.textScore ?? 0, 1) * 0.08

      return {
        match,
        score: semanticScore + termScore + sourceBoost + textScore,
      }
    })
    .sort((left, right) => right.score - left.score)
    .map(({ match, score }) => ({
      ...match,
      hybridScore: match.hybridScore ?? score,
    }))
}

async function vectorSearch(input: {
  filter?: RagMetadata
  limit: number
  query: string
  requestId: string
}) {
  try {
    const embedding = await createQueryEmbedding(input.query)
    const threshold = Number(process.env.RAG_MATCH_THRESHOLD || 0.65)
    const { data, error } = await client().rpc('match_documents', {
      filter: cleanFilter(input.filter),
      match_count: input.limit,
      match_threshold: Number.isFinite(threshold) ? threshold : 0.65,
      query_embedding: embedding.vector,
      query_text: input.query,
    })

    if (error) throw error

    const matches = normalizeRows(data)
    logEvent('info', 'rag_vector_search_complete', {
      embedding_provider: embedding.provider,
      match_count: matches.length,
      request_id: input.requestId,
    })

    return {
      embeddingAvailable: true,
      embeddingProvider: embedding.provider,
      matches,
    }
  } catch (error) {
    logError('rag_vector_search_failed', error, { request_id: input.requestId })
    return {
      embeddingAvailable: false,
      embeddingProvider: null,
      matches: [] as RagMatch[],
    }
  }
}

async function keywordRpc(input: {
  filter?: RagMetadata
  limit: number
  query: string
  requestId: string
}) {
  try {
    const { data, error } = await client().rpc('search_documents_keyword', {
      filter: cleanFilter(input.filter),
      match_count: input.limit,
      query_text: input.query,
    })
    if (error) throw error
    return normalizeRows(data)
  } catch (error) {
    logError('rag_keyword_rpc_failed', error, { request_id: input.requestId })
    return []
  }
}

async function ilikeFallback(input: {
  filter?: RagMetadata
  limit: number
  query: string
  requestId: string
}) {
  const terms = queryTerms(input.query, 8)
  if (!terms.length) return []

  try {
    const parts = terms.flatMap((term) => [
      `content.ilike.%${term}%`,
      `source_title.ilike.%${term}%`,
      `source_kind.ilike.%${term}%`,
      `metadata->>topic.ilike.%${term}%`,
      `metadata->>subject.ilike.%${term}%`,
    ])

    let query = client()
      .from('documents')
      .select('id, content, metadata, source_title, source_url, source_kind')
      .or(parts.join(','))
      .limit(input.limit)

    const filter = cleanFilter(input.filter)
    if (filter.subject) query = query.ilike('metadata->>subject', `%${filter.subject}%`)
    if (filter.topic) query = query.ilike('metadata->>topic', `%${filter.topic}%`)
    if (filter.board) query = query.ilike('metadata->>board', `%${filter.board}%`)

    const { data, error } = await query
    if (error) throw error
    return normalizeRows(data)
  } catch (error) {
    logError('rag_ilike_fallback_failed', error, { request_id: input.requestId })
    return []
  }
}

async function retrieve(input: {
  filter?: RagMetadata
  limit: number
  query: string
  requestId: string
}): Promise<RagRetrievalResult> {
  const limit = Math.min(Math.max(input.limit, 1), 8)
  const vector = await vectorSearch({ ...input, limit })

  if (vector.matches.length) {
    return {
      embeddingAvailable: vector.embeddingAvailable,
      embeddingProvider: vector.embeddingProvider,
      matches: rank(vector.matches, input.query).slice(0, limit),
      mode: 'hybrid',
    }
  }

  const keywordMatches = await keywordRpc({ ...input, limit })
  const fallbackMatches = keywordMatches.length
    ? []
    : await ilikeFallback({ ...input, limit })
  const matches = rank([...keywordMatches, ...fallbackMatches], input.query).slice(0, limit)

  return {
    embeddingAvailable: vector.embeddingAvailable,
    embeddingProvider: vector.embeddingProvider,
    matches,
    mode: matches.length ? 'keyword' : 'none',
  }
}

export async function retrieveAcademicContext(
  question: string,
  options: {
    filters?: RagMetadata
    limit?: number
    requestId: string
  }
) {
  const result = await retrieve({
    filter: options.filters,
    limit: options.limit ?? 6,
    query: question,
    requestId: options.requestId,
  })

  logEvent('info', 'rag_retrieval_complete', {
    match_count: result.matches.length,
    mode: result.mode,
    request_id: options.requestId,
  })

  return result
}

export async function retrieveTopicDocuments(options: {
  board?: string | null
  limit?: number
  requestId: string
  subject?: string | null
  topic?: string | null
}) {
  const query = [options.board, options.subject, options.topic, 'past paper mark scheme formula question']
    .filter(Boolean)
    .join(' ')

  const result = await retrieve({
    filter: {
      board: options.board || null,
      subject: options.subject || null,
      topic: options.topic || null,
    },
    limit: options.limit ?? 8,
    query,
    requestId: options.requestId,
  })

  return result.matches
}
