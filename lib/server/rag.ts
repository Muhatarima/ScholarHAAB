import type { Product } from '@/lib/products'

export type RagChunk = {
  id: string
  content: string
  sourceTitle: string
  sourceUrl: string | null
  sourceQuality: string | null
  tier: string
  lastChecked: string | null
  score: number
}

export async function retrieveRagContext(product: Product, message: string) {
  void product
  void message

  return {
    enabled: false,
    chunks: [] as RagChunk[],
  }
}
