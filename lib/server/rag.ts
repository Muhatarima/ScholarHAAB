import type { Product } from '@/lib/products'
import { searchAbroadDocumentCasesWithDb } from '@/lib/server/abroad-document-cases'
import { searchAbroadGuidanceWithDb } from '@/lib/server/abroad-guidance'
import { searchAbroadScholarshipsWithDb } from '@/lib/server/abroad'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'

type RagChunk = {
  id: string
  content: string
  sourceTitle: string
  sourceUrl: string | null
  sourceQuality: string | null
  tier: string
  lastChecked: string | null
}

function isMissingRagError(error: unknown): boolean {
  const code = (error as { code?: string })?.code
  const message = String((error as { message?: string })?.message ?? '')
  return code === '42P01' || code === 'PGRST205' || /rag_documents|search_rag_documents/i.test(message)
}

function trimContext(content: string, maxChars = 440) {
  const compact = content.replace(/\s+/g, ' ').trim()
  if (compact.length <= maxChars) {
    return compact
  }

  return `${compact.slice(0, maxChars - 3).trim()}...`
}

function sanitizeSearchQuery(query: string) {
  return query
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function retrieveRagContext(product: Product, message: string) {
  if (product !== 'abroad') {
    return {
      enabled: false,
      chunks: [] as RagChunk[],
    }
  }

  const searchQuery = sanitizeSearchQuery(message)
  if (searchQuery.length < 6) {
    return {
      enabled: false,
      chunks: [] as RagChunk[],
    }
  }

  const scholarshipMatches = (await searchAbroadScholarshipsWithDb(message, 4)).matches
  const scholarshipChunks = scholarshipMatches.slice(0, 2).map((row) => ({
    id: row.id,
    content: `${row.title}. Provider: ${row.provider ?? 'Unknown provider'}. Country: ${row.jurisdiction ?? 'Unknown'}. Degree levels: ${row.degreeLevels.join(', ') || 'Not specified'}. Fields: ${row.fieldsOfStudy.join(', ') || 'Not specified'}. Funding: ${row.fundingType ?? 'Unknown'}${row.fundingAmountText ? ` (${row.fundingAmountText})` : ''}. Deadline: ${row.deadlineAnnual ?? 'Check official page'}. Notes: ${row.deadlineNotes ?? 'None'}. Match reasons: ${row.matchReasons.join(', ') || 'general fit'}. ${row.caution ?? ''}`.trim(),
    sourceTitle: row.title,
    sourceUrl: row.officialUrl,
    sourceQuality: row.authenticityStatus,
    tier: 'tier0_structured_match',
    lastChecked: row.lastChecked,
  }))

  const guidanceMatches = (await searchAbroadGuidanceWithDb(message, 4)).matches
  const guidanceChunks = guidanceMatches.slice(0, 2).map((row) => ({
    id: row.id,
    content: trimContext(row.content),
    sourceTitle: row.title,
    sourceUrl: row.sourceUrl,
    sourceQuality: row.sourceKind,
    tier: 'tier0_guidance_match',
    lastChecked: row.lastChecked,
  }))

  const documentCaseMatches = await searchAbroadDocumentCasesWithDb(message, 2)
  const documentCaseChunks = documentCaseMatches.slice(0, 1).map((row) => ({
    id: row.id,
    content: row.outputText,
    sourceTitle: `${row.rubricType} reference case`,
    sourceUrl: null,
    sourceQuality: row.qualityBand,
    tier: 'tier0_document_case',
    lastChecked: null,
  }))

  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { data, error } = await supabaseAdmin
      .from('rag_documents')
      .select(
        'id, content, source_title, source_url, source_quality, tier, last_checked, retrieval_priority'
      )
      .in('tier', ['tier1_official', 'tier2_internal_live'])
      .textSearch('fts', searchQuery, {
        type: 'websearch',
        config: 'english',
      })
      .order('retrieval_priority', { ascending: false })
      .limit(4)

    if (error) {
      throw error
    }

    const chunks =
      (data as
        | Array<{
            id: string
            content: string
            source_title: string | null
            source_url: string | null
            source_quality: string | null
            tier: string
            last_checked: string | null
          }>
        | null) ?? []

    const ragChunks = chunks.map((row) => ({
        id: row.id,
        content: trimContext(row.content),
        sourceTitle: row.source_title || 'Official source',
        sourceUrl: row.source_url,
        sourceQuality: row.source_quality,
        tier: row.tier,
        lastChecked: row.last_checked,
      }))

    return {
      enabled:
        scholarshipChunks.length > 0 ||
        guidanceChunks.length > 0 ||
        documentCaseChunks.length > 0 ||
        ragChunks.length > 0,
      chunks: [...scholarshipChunks, ...guidanceChunks, ...documentCaseChunks, ...ragChunks].slice(0, 4),
    }
  } catch (error) {
    if (isMissingRagError(error)) {
      return {
        enabled:
          scholarshipChunks.length > 0 ||
          guidanceChunks.length > 0 ||
          documentCaseChunks.length > 0,
        chunks: [...scholarshipChunks, ...guidanceChunks, ...documentCaseChunks].slice(0, 4),
      }
    }

    throw error
  }
}
