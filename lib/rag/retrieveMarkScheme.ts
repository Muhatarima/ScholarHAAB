import type { SearchResult } from '@/lib/rag/ragSystem'

export type RetrievedMarkScheme = {
  answerText: string | null
  markPoints: string[]
  sourcePdfUrl: string | null
}

export function retrieveMarkSchemeFromResult(result: SearchResult | null | undefined): RetrievedMarkScheme {
  if (!result) {
    return {
      answerText: null,
      markPoints: [],
      sourcePdfUrl: null,
    }
  }

  return {
    answerText: result.mark_scheme?.trim() || null,
    markPoints: Array.isArray(result.mark_scheme_points)
      ? result.mark_scheme_points.map((point) => String(point).trim()).filter(Boolean)
      : [],
    sourcePdfUrl: result.source_url ?? null,
  }
}
