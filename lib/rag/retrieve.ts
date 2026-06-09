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

function buildFilter(filters?: RagMetadata) {
  return Object.fromEntries(
    Object.entries(filters ?? {}).filter(
      ([, value]) => value !== null && value !== undefined && value !== ''
    )
  )
}

function normalizeRows(data: unknown): RagMatch[] {
  return ((data as RagRpcRow[] | null) ?? [])
    .map(normalizeRow)
    .filter((row): row is RagMatch => Boolean(row))
}

async function searchWithRpc(
  client: SupabaseClient,
  question: string,
  filters: RagMetadata,
  limit: number
) {
  const rpcNames = ['search_rag_documents', 'search_documents_keyword']

  for (const rpcName of rpcNames) {
    const { data, error } = await client.rpc(rpcName, {
      query_text: question,
      match_count: limit,
      filter: filters,
    })

    if (!error) return normalizeRows(data)
  }

  return []
}

async function searchWithTable(
  client: SupabaseClient,
  question: string,
  filters: RagMetadata,
  limit: number
) {
  const tables = ['rag_documents', 'documents']
  const cleanQuestion = question.trim()

  for (const table of tables) {
    let query = client
      .from(table)
      .select('id, content, metadata, source_title, source_url, source_kind')
      .limit(limit)

    if (cleanQuestion) {
      query = query.ilike('content', `%${cleanQuestion}%`)
    }

    if (filters.subject) {
      query = query.ilike('metadata->>subject', `%${String(filters.subject)}%`)
    }

    if (filters.topic) {
      query = query.ilike('metadata->>topic', `%${String(filters.topic)}%`)
    }

    if (filters.board) {
      query = query.ilike('metadata->>board', `%${String(filters.board)}%`)
    }

    if (filters.level) {
      query = query.ilike('metadata->>level', `%${String(filters.level)}%`)
    }

    const { data, error } = await query

    if (!error) return normalizeRows(data)
  }

  return []
}

export async function retrieveAcademicContext(
  question: string,
  options: {
    filters?: RagMetadata
    limit?: number
    requestId: string
  }
): Promise<RagRetrievalResult> {
  try {
    const client = getRagClient()
    const filters = buildFilter(options.filters)
    const limit = Math.min(Math.max(options.limit ?? 5, 1), 10)

    let matches = await searchWithRpc(client, question, filters, limit)

    if (!matches.length) {
      matches = await searchWithTable(client, question, filters, limit)
    }

    logEvent('info', 'rag_retrieval_complete', {
      request_id: options.requestId,
      match_count: matches.length,
      mode: matches.length ? 'keyword' : 'none',
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
  try {
    const client = getRagClient()
    const limit = Math.min(Math.max(options.limit ?? 16, 1), 30)

    const filters = buildFilter({
      board: options.board,
      subject: options.subject,
      topic: options.topic,
    })

    const matches = await searchWithTable(
      client,
      options.topic || options.subject || options.board || '',
      filters,
      limit
    )

    logEvent('info', 'rag_topic_documents_loaded', {
      board: options.board ?? null,
      match_count: matches.length,
      request_id: options.requestId,
      subject: options.subject ?? null,
      topic: options.topic ?? null,
    })

    return matches
  } catch (error) {
    logError('rag_topic_documents_failed', error, {
      request_id: options.requestId,
    })

    return []
  }
}
