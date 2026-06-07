import type { SupabaseClient } from '@supabase/supabase-js'
import { createQueryEmbedding } from '@/lib/embeddings/client'
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

function getRagClient(): SupabaseClient {
  try {
    return getSupabaseAdmin()
  } catch (error) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is required for server-side RAG retrieval.',
      { cause: error }
    )
  }
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

function getMatchThreshold() {
  const value = Number(process.env.RAG_MATCH_THRESHOLD)
  return Number.isFinite(value) && value > 0 && value < 1 ? value : 0.65
}

function buildFilter(filters?: RagMetadata) {
  return Object.fromEntries(
    Object.entries(filters ?? {}).filter(
      ([, value]) => value !== null && value !== undefined && value !== ''
    )
  )
}

async function vectorSearch(
  client: SupabaseClient,
  question: string,
  filters: RagMetadata,
  limit: number,
  requestId: string
) {
  const embedding = await createQueryEmbedding(question)
  const threshold = getMatchThreshold()
  const { data, error } = await client.rpc('match_documents', {
    query_embedding: embedding.vector,
    query_text: question,
    match_threshold: threshold,
    match_count: limit,
    filter: filters,
  })
  if (error) throw error

  const matches = ((data as RagRpcRow[] | null) ?? [])
    .map(normalizeRow)
    .filter((row): row is RagMatch => Boolean(row))

  logEvent('info', 'rag_vector_retrieval_complete', {
    embedding_provider: embedding.provider,
    request_id: requestId,
    filter: filters,
    match_count: matches.length,
    threshold,
    top_similarity: matches[0]?.vectorSimilarity ?? null,
  })
  return { embeddingProvider: embedding.provider, matches }
}

async function hybridSearch(
  client: SupabaseClient,
  question: string,
  filters: RagMetadata,
  limit: number,
  requestId: string
) {
  const embedding = await createQueryEmbedding(question)
  const threshold = getMatchThreshold()
  const { data, error } = await client.rpc('hybrid_search_documents', {
    query_embedding: embedding.vector,
    query_text: question,
    match_threshold: threshold,
    match_count: limit,
    filter: filters,
  })
  if (error) throw error

  const matches = ((data as RagRpcRow[] | null) ?? [])
    .map(normalizeRow)
    .filter((row): row is RagMatch => Boolean(row))

  logEvent('info', 'rag_hybrid_retrieval_complete', {
    embedding_provider: embedding.provider,
    request_id: requestId,
    match_count: matches.length,
    threshold,
    top_similarity: matches[0]?.vectorSimilarity ?? null,
  })
  return { embeddingProvider: embedding.provider, matches }
}

async function keywordSearch(
  client: SupabaseClient,
  question: string,
  filters: RagMetadata,
  limit: number,
  requestId: string
) {
  const { data, error } = await client.rpc('search_documents_keyword', {
    query_text: question,
    match_count: limit,
    filter: filters,
  })
  if (error) throw error

  const matches = ((data as RagRpcRow[] | null) ?? [])
    .map(normalizeRow)
    .filter((row): row is RagMatch => Boolean(row))

  logEvent('info', 'rag_keyword_retrieval_complete', {
    request_id: requestId,
    match_count: matches.length,
  })
  return matches
}

export async function retrieveAcademicContext(
  question: string,
  options: {
    filters?: RagMetadata
    limit?: number
    requestId: string
  }
): Promise<RagRetrievalResult> {
  let client: SupabaseClient
  try {
    client = getRagClient()
  } catch (error) {
    logError('rag_client_unavailable', error, {
      request_id: options.requestId,
    })
    return { matches: [], mode: 'none', embeddingAvailable: false }
  }
  const filters = buildFilter(options.filters)
  const limit = Math.min(Math.max(options.limit ?? 5, 1), 5)

  try {
    const result = await vectorSearch(
      client,
      question,
      filters,
      limit,
      options.requestId
    )
    if (result.matches.length) {
      return {
        matches: result.matches,
        mode: 'hybrid',
        embeddingAvailable: true,
        embeddingProvider: result.embeddingProvider,
      }
    }
  } catch (error) {
    logError('rag_vector_retrieval_failed', error, {
      request_id: options.requestId,
      fallback: 'hybrid',
    })
  }

  try {
    const result = await hybridSearch(
      client,
      question,
      filters,
      limit,
      options.requestId
    )
    if (result.matches.length) {
      return {
        matches: result.matches,
        mode: 'hybrid',
        embeddingAvailable: true,
        embeddingProvider: result.embeddingProvider,
      }
    }
  } catch (error) {
    logError('rag_hybrid_retrieval_failed', error, {
      request_id: options.requestId,
      fallback: 'keyword',
    })
  }

  try {
    const matches = await keywordSearch(
      client,
      question,
      filters,
      limit,
      options.requestId
    )
    return {
      matches,
      mode: matches.length ? 'keyword' : 'none',
      embeddingAvailable: false,
      embeddingProvider: null,
    }
  } catch (error) {
    logError('rag_keyword_retrieval_failed', error, {
      request_id: options.requestId,
    })
    return { matches: [], mode: 'none', embeddingAvailable: false }
  }
}

export async function retrieveTopicDocuments(options: {
  board?: string | null
  limit?: number
  requestId: string
  subject?: string | null
  topic?: string | null
}) {
  let client: SupabaseClient
  try {
    client = getRagClient()
  } catch (error) {
    logError('rag_topic_client_unavailable', error, {
      request_id: options.requestId,
    })
    return []
  }

  const limit = Math.min(Math.max(options.limit ?? 16, 1), 30)
  try {
    let query = client
      .from('documents')
      .select('id, content, metadata, source_title, source_url, source_kind')
      .limit(limit)

    if (options.subject?.trim()) {
      query = query.ilike('metadata->>subject', `%${options.subject.trim()}%`)
    }
    if (options.topic?.trim()) {
      const topic = options.topic.trim()
      query = query.or(`metadata->>topic.ilike.%${topic}%,content.ilike.%${topic}%`)
    }
    if (options.board?.trim()) {
      query = query.ilike('metadata->>board', `%${options.board.trim()}%`)
    }

    const { data, error } = await query
    if (error) throw error

    const rows = ((data as RagRpcRow[] | null) ?? [])
      .map(normalizeRow)
      .filter((row): row is RagMatch => Boolean(row))

    logEvent('info', 'rag_topic_documents_loaded', {
      board: options.board ?? null,
      match_count: rows.length,
      request_id: options.requestId,
      subject: options.subject ?? null,
      topic: options.topic ?? null,
    })

    return rows
  } catch (error) {
    logError('rag_topic_documents_failed', error, {
      request_id: options.requestId,
    })
    return []
  }
}
