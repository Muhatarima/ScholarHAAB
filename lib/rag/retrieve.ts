import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createGeminiEmbedding } from '@/lib/rag/embedding'
import { logError, logEvent } from '@/lib/server/logger'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'

export type RagMetadata = {
  board?: string | null
  level?: string | null
  subject?: string | null
  topic?: string | null
  year?: number | string | null
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
}

export type RagRetrievalResult = {
  matches: RagMatch[]
  mode: 'hybrid' | 'text' | 'none'
  embeddingAvailable: boolean
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
  text_score?: unknown
  similarity?: unknown
}

function getRagClient(): SupabaseClient {
  try {
    return getSupabaseAdmin()
  } catch {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anonKey) {
      throw new Error('Missing Supabase environment variables for RAG retrieval')
    }
    return createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
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
    sourceKind: asText(row.source_kind) || asText(metadata.source_kind),
    tier: asText(row.tier),
    vectorSimilarity: asNumber(row.vector_similarity ?? row.similarity),
    textScore: asNumber(row.text_score),
  }
}

function getMatchThreshold() {
  const value = Number(process.env.RAG_MATCH_THRESHOLD)
  return Number.isFinite(value) && value > 0 && value < 1 ? value : 0.75
}

function buildFilter(filters?: RagMetadata) {
  return Object.fromEntries(
    Object.entries(filters ?? {}).filter(
      ([, value]) => value !== null && value !== undefined && value !== ''
    )
  )
}

async function retrieveVectorMatches(
  client: SupabaseClient,
  question: string,
  filters: RagMetadata,
  limit: number,
  requestId: string
) {
  const embedding = await createGeminiEmbedding(question, 'RETRIEVAL_QUERY')
  const threshold = getMatchThreshold()
  const { data, error } = await client.rpc('match_rag_documents', {
    query_embedding: embedding,
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
    request_id: requestId,
    match_count: matches.length,
    threshold,
    top_similarity: matches[0]?.vectorSimilarity ?? null,
  })

  return matches
}

async function retrieveTextMatches(
  client: SupabaseClient,
  question: string,
  filters: RagMetadata,
  limit: number,
  requestId: string
) {
  const { data, error } = await client.rpc('search_rag_documents', {
    query_text: question,
    match_count: limit,
    filter: filters,
  })

  if (error) throw error

  const matches = ((data as RagRpcRow[] | null) ?? [])
    .map(normalizeRow)
    .filter((row): row is RagMatch => Boolean(row))

  logEvent('info', 'rag_text_retrieval_complete', {
    request_id: requestId,
    match_count: matches.length,
    top_text_score: matches[0]?.textScore ?? null,
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
  const client = getRagClient()
  const filters = buildFilter(options.filters)
  const limit = Math.min(Math.max(options.limit ?? 5, 1), 10)

  try {
    const matches = await retrieveVectorMatches(
      client,
      question,
      filters,
      limit,
      options.requestId
    )
    if (matches.length) {
      return { matches, mode: 'hybrid', embeddingAvailable: true }
    }
  } catch (error) {
    logError('rag_vector_retrieval_failed', error, {
      request_id: options.requestId,
      fallback: 'text_search',
    })
  }

  try {
    const matches = await retrieveTextMatches(
      client,
      question,
      filters,
      limit,
      options.requestId
    )
    return {
      matches,
      mode: matches.length ? 'text' : 'none',
      embeddingAvailable: false,
    }
  } catch (error) {
    logError('rag_text_retrieval_failed', error, {
      request_id: options.requestId,
    })
    return { matches: [], mode: 'none', embeddingAvailable: false }
  }
}
