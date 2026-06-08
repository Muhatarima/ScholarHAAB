import { runExplainPipeline, type RagSource } from '@/lib/rag/pipelines'
import type { RagMetadata } from '@/lib/rag/retrieve'

export type AcademicSource = RagSource

export type AcademicAnswer = {
  answer: string
  confidence: 'VERIFIED' | 'PARTIAL' | 'GENERAL_KNOWLEDGE'
  confidenceScore: number
  confidenceBadge: string
  sources: AcademicSource[]
  retrievalMode: 'hybrid' | 'keyword' | 'none'
  model: string
}

export async function generateAcademicAnswer(input: {
  question: string
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
  filters?: RagMetadata
  requestId: string
  userId: string
}) {
  const result = await runExplainPipeline({
    query: input.question,
    subject:
      typeof input.filters?.subject === 'string'
        ? input.filters.subject
        : null,
    topic:
      typeof input.filters?.topic === 'string' ? input.filters.topic : null,
    history: input.history,
    requestId: input.requestId,
  })

  return {
    answer: result.answer,
    confidence:
      result.confidenceLabel.toLowerCase().includes('source-backed')
        ? ('VERIFIED' as const)
        : result.confidenceLabel.toLowerCase().includes('general') ||
            result.confidenceLabel.toLowerCase().includes('study chat')
          ? ('GENERAL_KNOWLEDGE' as const)
        : ('PARTIAL' as const),
    confidenceScore: result.confidenceScore,
    confidenceBadge: result.confidenceLabel,
    sources: result.sources,
    retrievalMode: result.retrievalMode as AcademicAnswer['retrievalMode'],
    model: result.model,
  } satisfies AcademicAnswer
}
