import { getSupabaseAdmin } from '@/lib/server/supabase-admin'

// Corpus embeddings are generated locally with sentence-transformers:
// all-MiniLM-L6-v2, 384 dimensions. Query embeddings use the same model
// through Hugging Face Inference so Supabase pgvector dimensions stay aligned.
export type QuestionSearchFilters = {
  subject?: string
  level?: string
  board?: string
  topic?: string
  difficulty?: string
  year_from?: number
  year_to?: number
}

export type SearchConfidence = 'VERIFIED' | 'PARTIAL' | 'LOW_CONFIDENCE'

export type SearchResult = {
  id: string
  board: string
  level: string
  subject: string
  subject_code?: string | null
  year: number
  session: string
  paper: string
  question_number: string
  part?: string | null
  question_text: string
  marks?: number | null
  mark_scheme?: string | null
  mark_scheme_points?: string[] | null
  topic?: string | null
  subtopic?: string | null
  difficulty?: string | null
  has_diagram?: boolean | null
  content?: string | null
  document_id?: string | null
  resource_type?: string | null
  source_url?: string | null
  local_path?: string | null
  chunk_index?: number | null
  similarity: number
  confidence: SearchConfidence
}

type QueryPatternType = 'FACTUAL' | 'COMPARATIVE' | 'MULTI_HOP' | 'PROCEDURAL' | 'AMBIGUOUS'
type RetrievalStrategy = 'direct' | 'multi_doc' | 'chain' | 'sequential' | 'broad'

type QueryPattern = {
  type: QueryPatternType
  regex: RegExp
  weight: {
    semantic: number
    keyword: number
  }
  maxChunks: number
  strategy: RetrievalStrategy
}

type QueryExpansion = {
  original: string
  expanded: string
  hypothetical: string
}

type QueryEmbeddings = {
  original: number[]
  hyde: number[]
}

type RawQuestionRow = {
  id?: string | null
  board?: string | null
  level?: string | null
  subject?: string | null
  subject_code?: string | null
  year?: number | null
  session?: string | null
  paper?: string | null
  question_number?: string | number | null
  part?: string | null
  question_text?: string | null
  marks?: number | null
  mark_scheme?: string | null
  mark_scheme_points?: unknown
  topic?: string | null
  subtopic?: string | null
  difficulty?: string | null
  has_diagram?: boolean | null
  content?: string | null
  document_id?: string | null
  resource_type?: string | null
  source_url?: string | null
  local_path?: string | null
  chunk_index?: number | null
  similarity?: number | null
  rrfScore?: number
}

type SupabaseFilterBuilder = {
  eq: (column: string, value: unknown) => SupabaseFilterBuilder
  gte: (column: string, value: unknown) => SupabaseFilterBuilder
  lte: (column: string, value: unknown) => SupabaseFilterBuilder
  then: PromiseLike<unknown>['then']
}

type SupabaseQueryResult = {
  data: unknown[] | null
  error: Error | null
}

type HybridSearchResults = {
  semantic: RawQuestionRow[]
  keyword: RawQuestionRow[]
}

const QUESTION_SELECT =
  'id, document_id, board, level, subject, year, resource_type, chunk_index, content, source_url, local_path'

const RESOURCE_PRIORITY: Record<string, number> = {
  unified_concept: 4,
  past_paper: 3,
  question_paper: 3,
  mark_scheme: 3,
  textbook: 2,
  concept_guide: 1,
  concept: 1,
}

function resourcePriority(resourceType?: string | null): number {
  return RESOURCE_PRIORITY[resourceType ?? ''] ?? 0
}

function boostSimilarity(row: RawQuestionRow, similarity: number): number {
  const boost = row.resource_type === 'unified_concept' ? 0.1 : 0
  return Math.min(0.99, similarity + boost)
}

const QUERY_PATTERNS: QueryPattern[] = [
  {
    type: 'FACTUAL',
    regex: /^(what is|what are|who is|when did|where is|define|explain|state|name|identify)/i,
    weight: { semantic: 0.7, keyword: 0.3 },
    maxChunks: 3,
    strategy: 'direct',
  },
  {
    type: 'COMPARATIVE',
    regex: /\b(vs|versus|compare|difference between|better|worse|similar|differentiate)\b/i,
    weight: { semantic: 0.5, keyword: 0.5 },
    maxChunks: 6,
    strategy: 'multi_doc',
  },
  {
    type: 'MULTI_HOP',
    regex: /\b(because|therefore|caused by|led to|result of|why did|how does.*affect|explain why)\b/i,
    weight: { semantic: 0.8, keyword: 0.2 },
    maxChunks: 8,
    strategy: 'chain',
  },
  {
    type: 'PROCEDURAL',
    regex: /^(how to|how do|steps to|guide|tutorial|process of|calculate|find|solve|determine)/i,
    weight: { semantic: 0.6, keyword: 0.4 },
    maxChunks: 5,
    strategy: 'sequential',
  },
  {
    type: 'AMBIGUOUS',
    regex: /.*/,
    weight: { semantic: 0.6, keyword: 0.4 },
    maxChunks: 5,
    strategy: 'broad',
  },
]

export function confidenceFromSimilarity(similarity: number): SearchConfidence {
  if (similarity > 0.9) return 'VERIFIED'
  if (similarity >= 0.75) return 'PARTIAL'
  return 'LOW_CONFIDENCE'
}

export function detectQueryPattern(query: string): Omit<QueryPattern, 'regex'> {
  const normalized = query.toLowerCase().trim()
  const match = QUERY_PATTERNS.find((pattern) => pattern.regex.test(normalized)) ?? QUERY_PATTERNS.at(-1)

  return {
    type: match?.type ?? 'AMBIGUOUS',
    weight: match?.weight ?? { semantic: 0.6, keyword: 0.4 },
    maxChunks: match?.maxChunks ?? 5,
    strategy: match?.strategy ?? 'broad',
  }
}

async function embedText(text: string): Promise<number[]> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (process.env.HUGGINGFACE_API_KEY) {
    headers.Authorization = `Bearer ${process.env.HUGGINGFACE_API_KEY}`
  }

  const response = await fetch(
    'https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2',
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ inputs: text, options: { wait_for_model: true } }),
    }
  )
  const data: unknown = await response.json()

  if (!response.ok) {
    const message = typeof data === 'object' && data && 'error' in data ? String(data.error) : response.statusText
    throw new Error(`Hugging Face embedding failed: ${message}`)
  }

  if (Array.isArray(data) && Array.isArray(data[0])) {
    return data[0].map((value) => Number(value))
  }

  if (Array.isArray(data)) {
    return data.map((value) => Number(value))
  }

  throw new Error('Hugging Face embedding returned an unexpected shape')
}

export async function createQueryEmbedding(query: string): Promise<number[]> {
  return embedText(query.slice(0, 8000))
}

function normalizeMarkSchemePoints(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string')
  }
  return []
}

function cleanSearchText(text: string): string {
  return text
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function inferSubjectFromText(text: string): string {
  const normalized = text.toLowerCase()

  if (/\b(force|wave|current|voltage|energy|work done|momentum|circuit|lens|pressure)\b/.test(normalized)) {
    return 'Physics'
  }
  if (/\b(atom|bond|molecule|acid|alkali|reaction|enthalpy|organic|electron|ion)\b/.test(normalized)) {
    return 'Chemistry'
  }
  if (/\b(cell|photosynthesis|respiration|enzyme|genetic|ecosystem|osmosis|blood|plant)\b/.test(normalized)) {
    return 'Biology'
  }
  if (/\b(equation|integral|differentiate|probability|matrix|vector|triangle|graph)\b/.test(normalized)) {
    return 'Mathematics'
  }

  return 'General'
}

function buildHypotheticalAnswer(query: string, pattern: Omit<QueryPattern, 'regex'>): string {
  const normalized = query.toLowerCase()
  const subject = inferSubjectFromText(query)

  if (/\bwork\b/.test(normalized)) {
    return 'Work done in Physics means energy transferred when a force moves an object through a distance. Formula: work done = force × distance moved in the direction of the force. Unit: joule.'
  }

  if (/\bphotosynthesis\b/.test(normalized)) {
    return 'Photosynthesis is the Biology process where plants use light energy and chlorophyll to convert carbon dioxide and water into glucose and oxygen.'
  }

  if (/\bdemand\b/.test(normalized)) {
    return 'The law of demand states that as price increases, quantity demanded usually decreases, and as price decreases, quantity demanded usually increases, shown by a downward-sloping demand curve.'
  }

  const intent = pattern.type === 'PROCEDURAL' ? 'step by step method' : 'definition, formula, explanation, and exam mark scheme language'
  return `${subject} Cambridge A Level O Level IGCSE ${intent}: ${query}`
}

export async function expandQuery(query: string, pattern: Omit<QueryPattern, 'regex'>): Promise<QueryExpansion> {
  const hypothetical = buildHypotheticalAnswer(query, pattern)
  const wordCount = query.trim().split(/\s+/).filter(Boolean).length
  const shouldExpand = wordCount <= 4 || pattern.strategy === 'chain' || pattern.strategy === 'broad'

  return {
    original: query,
    expanded: shouldExpand ? `${query} ${hypothetical}` : query,
    hypothetical,
  }
}

async function generateEmbeddings(queryData: QueryExpansion): Promise<QueryEmbeddings> {
  const [original, hyde] = await Promise.all([
    createQueryEmbedding(queryData.original),
    createQueryEmbedding(queryData.hypothetical),
  ])

  return { original, hyde }
}

function applySafeFilters(query: SupabaseFilterBuilder, filters: QuestionSearchFilters) {
  let next = query
  if (filters.subject) next = next.eq('subject', filters.subject)
  if (filters.level) next = next.eq('level', filters.level)
  if (filters.board) next = next.eq('board', filters.board.toLowerCase())
  if (typeof filters.year_from === 'number') next = next.gte('year', filters.year_from)
  if (typeof filters.year_to === 'number') next = next.lte('year', filters.year_to)
  return next
}

function questionContent(row: RawQuestionRow): string {
  return row.question_text || row.content || row.mark_scheme || ''
}

function normalizeRow(row: RawQuestionRow): SearchResult {
  const content = questionContent(row)
  const similarity = boostSimilarity(row, Number(row.similarity ?? row.rrfScore ?? 0))
  const resourceType = row.resource_type ?? null

  return {
    id: String(row.id ?? ''),
    board: row.board || (row.document_id ? 'General' : 'Cambridge'),
    level: row.level || 'General',
    subject: row.subject || inferSubjectFromText(content),
    subject_code: row.subject_code ?? null,
    year: Number(row.year ?? 0),
    session: row.session || '',
    paper: row.paper || resourceType || '',
    question_number: String(row.question_number ?? row.chunk_index ?? ''),
    part: row.part ?? null,
    question_text: content,
    marks: row.marks ?? null,
    mark_scheme: row.mark_scheme ?? (resourceType === 'concept' ? content : null),
    mark_scheme_points: normalizeMarkSchemePoints(row.mark_scheme_points),
    topic: row.topic ?? null,
    subtopic: row.subtopic ?? null,
    difficulty: row.difficulty ?? null,
    has_diagram: row.has_diagram ?? null,
    content: row.content ?? null,
    document_id: row.document_id ?? null,
    resource_type: resourceType,
    source_url: row.source_url ?? null,
    local_path: row.local_path ?? null,
    chunk_index: row.chunk_index ?? null,
    similarity,
    confidence: confidenceFromSimilarity(similarity),
  }
}

async function semanticSearch(
  embedding: number[],
  filters: QuestionSearchFilters,
  limit: number
): Promise<RawQuestionRow[]> {
  const supabase = getSupabaseAdmin()
  const exactYear =
    typeof filters.year_from === 'number' && filters.year_from === filters.year_to ? filters.year_from : null

  const { data, error } = await supabase.rpc('match_questions', {
    query_embedding: embedding,
    match_threshold: 0.5,
    match_count: limit,
    filter_level: filters.level ?? null,
    filter_subject: filters.subject ?? null,
    filter_year: exactYear,
  })

  if (error) {
    throw error
  }

  return (data ?? []) as RawQuestionRow[]
}

async function keywordSearch(
  query: string,
  filters: QuestionSearchFilters,
  limit: number
): Promise<RawQuestionRow[]> {
  const supabase = getSupabaseAdmin()
  const webQuery = cleanSearchText(query)
  if (!webQuery) return []

  const baseQuery = supabase
    .from('questions')
    .select(QUESTION_SELECT)
    .textSearch('content', webQuery, { type: 'websearch', config: 'english' })
    .limit(limit) as unknown as SupabaseFilterBuilder
  const textQuery = applySafeFilters(baseQuery, filters)

  const { data, error } = (await textQuery) as SupabaseQueryResult
  if (error) {
    throw error
  }

  return ((data ?? []) as RawQuestionRow[]).map((row, index) => ({
    ...row,
    similarity: Math.max(0.52, 0.74 - index * 0.025),
  }))
}

async function fallbackTextSearch(
  query: string,
  filters: QuestionSearchFilters,
  limit: number
): Promise<SearchResult[]> {
  const keywordResults = await keywordSearch(query, filters, limit)

  return keywordResults
    .map(normalizeRow)
    .filter((result) => result.id && result.question_text)
    .slice(0, limit)
}

async function hybridSearch(
  embeddings: QueryEmbeddings,
  query: string,
  filters: QuestionSearchFilters,
  pattern: Omit<QueryPattern, 'regex'>
): Promise<HybridSearchResults> {
  const candidateLimit = Math.max(pattern.maxChunks, 5) * 3
  const [semanticOriginal, semanticHyde, keyword] = await Promise.allSettled([
    semanticSearch(embeddings.original, filters, candidateLimit),
    semanticSearch(embeddings.hyde, filters, candidateLimit),
    keywordSearch(query, filters, candidateLimit),
  ])

  return {
    semantic: [
      ...(semanticOriginal.status === 'fulfilled' ? semanticOriginal.value : []),
      ...(semanticHyde.status === 'fulfilled' ? semanticHyde.value : []),
    ],
    keyword: keyword.status === 'fulfilled' ? keyword.value : [],
  }
}

function resultKey(row: RawQuestionRow): string {
  return String(row.id || questionContent(row).slice(0, 120))
}

function reciprocalRankFusion(
  semanticResults: RawQuestionRow[],
  keywordResults: RawQuestionRow[],
  pattern: Omit<QueryPattern, 'regex'>,
  k = 60
): RawQuestionRow[] {
  const scores = new Map<string, { doc: RawQuestionRow; rrf: number; bestSimilarity: number }>()

  const addResults = (results: RawQuestionRow[], weight: number) => {
    const seen = new Set<string>()
    results.forEach((doc, rank) => {
      const key = resultKey(doc)
      if (seen.has(key)) return
      seen.add(key)

      const existing = scores.get(key)
      const score = (1 / (k + rank + 1)) * weight
      const similarity = Number(doc.similarity ?? 0)

      scores.set(key, {
        doc: existing?.doc ?? doc,
        rrf: (existing?.rrf ?? 0) + score,
        bestSimilarity: Math.max(existing?.bestSimilarity ?? 0, similarity),
      })
    })
  }

  addResults(semanticResults, pattern.weight.semantic)
  addResults(keywordResults, pattern.weight.keyword)

  return Array.from(scores.values())
    .sort((a, b) => {
      const priorityDiff = resourcePriority(b.doc.resource_type) - resourcePriority(a.doc.resource_type)
      return priorityDiff || b.rrf - a.rrf
    })
    .map(({ doc, rrf, bestSimilarity }) => ({
      ...doc,
      similarity: boostSimilarity(doc, Math.max(bestSimilarity, Math.min(0.99, rrf * 42))),
      rrfScore: rrf,
    }))
}

function contentOverlapSimilarity(a: RawQuestionRow, b: RawQuestionRow): number {
  const wordsA = new Set(cleanSearchText(questionContent(a).toLowerCase()).split(/\s+/).filter(Boolean))
  const wordsB = new Set(cleanSearchText(questionContent(b).toLowerCase()).split(/\s+/).filter(Boolean))

  if (wordsA.size === 0 || wordsB.size === 0) return 0

  let intersection = 0
  for (const word of wordsA) {
    if (wordsB.has(word)) intersection += 1
  }

  return intersection / Math.sqrt(wordsA.size * wordsB.size)
}

function applyMMR(docs: RawQuestionRow[], lambda = 0.7, topK = 5): RawQuestionRow[] {
  if (docs.length <= topK) return docs

  const selected: RawQuestionRow[] = [docs[0]]
  const remaining = docs.slice(1)

  while (selected.length < topK && remaining.length > 0) {
    let bestScore = Number.NEGATIVE_INFINITY
    let bestIndex = 0

    remaining.forEach((doc, index) => {
      const relevance = Number(doc.rrfScore ?? doc.similarity ?? 0)
      const maxSimilarityToSelected = Math.max(...selected.map((selectedDoc) => contentOverlapSimilarity(doc, selectedDoc)))
      const mmrScore = lambda * relevance - (1 - lambda) * maxSimilarityToSelected

      if (mmrScore > bestScore) {
        bestScore = mmrScore
        bestIndex = index
      }
    })

    selected.push(remaining[bestIndex])
    remaining.splice(bestIndex, 1)
  }

  return selected
}

function applyPostFilters(results: SearchResult[], filters: QuestionSearchFilters): SearchResult[] {
  return results.filter((result) => {
    if (filters.topic && result.topic && result.topic !== filters.topic) return false
    if (filters.difficulty && result.difficulty && result.difficulty !== filters.difficulty) return false
    if (filters.board && result.board && result.board.toLowerCase() !== filters.board.toLowerCase()) return false
    return true
  })
}

async function fetchUnifiedConceptCandidate(
  query: string,
  filters: QuestionSearchFilters
): Promise<SearchResult | null> {
  const supabase = getSupabaseAdmin()
  const webQuery = cleanSearchText(query)
  if (!webQuery) return null

  let unifiedQuery = supabase
    .from('questions')
    .select(QUESTION_SELECT)
    .eq('resource_type', 'unified_concept')
    .textSearch('content', webQuery, { type: 'websearch', config: 'english' })
    .limit(1) as unknown as SupabaseFilterBuilder

  unifiedQuery = applySafeFilters(unifiedQuery, filters)
  const { data, error } = (await unifiedQuery) as SupabaseQueryResult

  if (error || !data?.length) return null

  const row = data[0] as RawQuestionRow
  return normalizeRow({
    ...row,
    similarity: Math.max(Number(row.similarity ?? 0), 0.72),
  })
}

function prioritizeSearchResults(results: SearchResult[], limit: number): SearchResult[] {
  const deduped = new Map<string, SearchResult>()

  for (const result of results) {
    const existing = deduped.get(result.id)
    if (!existing || result.similarity > existing.similarity) {
      deduped.set(result.id, result)
    }
  }

  return Array.from(deduped.values())
    .sort((a, b) => {
      const priorityDiff = resourcePriority(b.resource_type) - resourcePriority(a.resource_type)
      return priorityDiff || b.similarity - a.similarity
    })
    .slice(0, limit)
}

export async function searchSimilarQuestions(
  query: string,
  filters: QuestionSearchFilters = {},
  limit = 5
): Promise<SearchResult[]> {
  const pattern = detectQueryPattern(query)
  const queryData = await expandQuery(query, pattern)

  try {
    const embeddings = await generateEmbeddings(queryData)
    const searchResults = await hybridSearch(embeddings, queryData.expanded, filters, pattern)
    const fusedResults = reciprocalRankFusion(searchResults.semantic, searchResults.keyword, pattern)
    const diverseResults = applyMMR(fusedResults, 0.7, Math.max(pattern.maxChunks, limit))
    const normalized = applyPostFilters(
      diverseResults.map(normalizeRow).filter((result) => result.id && result.question_text),
      filters
    )

    if (normalized.length > 0) {
      const hasUnifiedConcept = normalized.some((result) => result.resource_type === 'unified_concept')
      const unifiedCandidate = hasUnifiedConcept ? null : await fetchUnifiedConceptCandidate(queryData.expanded, filters)
      const combined = unifiedCandidate ? [unifiedCandidate, ...normalized] : normalized
      return prioritizeSearchResults(combined, limit)
    }
  } catch (error) {
    console.error('Hybrid RAG search failed, using text fallback:', error)
  }

  const fallbackResults = await fallbackTextSearch(queryData.expanded, filters, limit)
  const unifiedCandidate = fallbackResults.some((result) => result.resource_type === 'unified_concept')
    ? null
    : await fetchUnifiedConceptCandidate(queryData.expanded, filters)
  return prioritizeSearchResults(unifiedCandidate ? [unifiedCandidate, ...fallbackResults] : fallbackResults, limit)
}
