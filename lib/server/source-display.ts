import type { Product } from '@/lib/products'
import type { SessionContext } from '@/lib/sessionContext'
import {
  buildDisplaySources as buildDisplaySourcesBase,
  type DisplaySourceCitation,
  type SourceChunkLike,
} from '@/lib/server/answer-quality'

export type { DisplaySourceCitation, SourceChunkLike }

export function buildDisplaySources({
  product,
  query,
  answer,
  sessionContext,
  sources,
}: {
  product: Product
  query: string
  answer: string
  sessionContext?: SessionContext | null
  sources: SourceChunkLike[]
}) {
  return buildDisplaySourcesBase({
    product,
    query,
    answer,
    sessionContext,
    sources,
  }) as DisplaySourceCitation[]
}
