import type { SearchResult } from '@/lib/rag/ragSystem'

export type RetrievalStatus = 'verified' | 'partial' | 'ai_reasoning'

export function hasRealSource(result: SearchResult | null | undefined) {
  return Boolean(
    result?.source_url ||
      (result?.board && result?.level && result?.subject && result?.year && result?.question_number)
  )
}

export function hasMarkScheme(result: SearchResult | null | undefined) {
  return Boolean(
    result?.mark_scheme?.trim() ||
      (Array.isArray(result?.mark_scheme_points) && result.mark_scheme_points.length > 0)
  )
}

export function calculateConfidence(result: SearchResult | null | undefined): {
  status: RetrievalStatus
  confidence: number
  warning?: string
} {
  if (!result) {
    return {
      status: 'ai_reasoning',
      confidence: 0,
      warning: 'No exact past paper match found. This is AI reasoning. Verify before exam.',
    }
  }

  const confidence = Math.round(Math.max(0, Math.min(1, result.similarity || 0)) * 100)
  if (confidence >= 80 && hasRealSource(result) && hasMarkScheme(result)) {
    return { status: 'verified', confidence }
  }

  if (confidence >= 50 && hasRealSource(result)) {
    return {
      status: 'partial',
      confidence,
      warning: 'Partial past paper match found. AI reasoning is applied; verify before exam.',
    }
  }

  return {
    status: 'ai_reasoning',
    confidence,
    warning: 'No exact past paper match found. This is AI reasoning. Verify before exam.',
  }
}
