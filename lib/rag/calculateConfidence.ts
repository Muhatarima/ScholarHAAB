import type { SearchResult } from '@/lib/rag/ragSystem'

export type SolverConfidence = 'VERIFIED' | 'PARTIAL_MATCH' | 'AI_REASONING'

export function calculateConfidence(results: SearchResult[]) {
  const best = results[0]
  const score = best ? Math.round(best.similarity * 100) : 0

  if (score >= 80) {
    return {
      badge: 'VERIFIED',
      explanation: 'Verified from Cambridge/Edexcel past papers',
      score,
      status: 'VERIFIED' as SolverConfidence,
      tone: 'green' as const,
    }
  }

  if (score >= 50) {
    return {
      badge: 'PARTIAL MATCH',
      explanation: 'Similar past-paper context found; AI reasoning adapted',
      score,
      status: 'PARTIAL_MATCH' as SolverConfidence,
      tone: 'amber' as const,
    }
  }

  return {
    badge: 'AI REASONING',
    explanation: 'No exact past paper match found. Verify before exam.',
    score,
    status: 'AI_REASONING' as SolverConfidence,
    tone: 'amber' as const,
  }
}
