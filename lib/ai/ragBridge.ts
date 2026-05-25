import type { RagChunk } from '@/lib/ai/truthEngine'
import { searchSimilarQuestions } from '@/lib/rag/ragSystem'

export interface RagSearchResult {
  chunks: RagChunk[]
  maxSimilarity: number
  totalInDb: number
  ragAvailable: boolean
}

export async function searchRag(
  question: string,
  subject?: string,
  level?: string,
  nResults = 7,
  board?: string
): Promise<RagSearchResult> {
  try {
    const results = await searchSimilarQuestions(
      question,
      {
        subject: subject || undefined,
        level: level || undefined,
        board: board || undefined,
      },
      nResults
    )

    const chunks: RagChunk[] = results
      .map((result) => ({
        text: result.content || result.question_text || result.mark_scheme || '',
        similarity: result.similarity || 0.7,
        metadata: {
          source: result.source_url || result.local_path || '',
          subject: result.subject || subject || '',
          year: result.year || 0,
          topic: result.topic || '',
          marks: result.marks || 0,
          chunk_type: result.resource_type || 'past_paper',
          board: result.board || board || 'Cambridge',
        },
      }))
      .filter((chunk) => chunk.text.trim())

    return {
      chunks,
      maxSimilarity: Math.max(...chunks.map((chunk) => chunk.similarity), 0),
      totalInDb: chunks.length,
      ragAvailable: chunks.length > 0,
    }
  } catch (error) {
    console.error('RAG search failed:', error)
    return {
      chunks: [],
      maxSimilarity: 0,
      totalInDb: 0,
      ragAvailable: false,
    }
  }
}

export async function isRagHealthy(): Promise<boolean> {
  try {
    const results = await searchSimilarQuestions('work done physics', {}, 1)
    return Array.isArray(results)
  } catch {
    return false
  }
}
