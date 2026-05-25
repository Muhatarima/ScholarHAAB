import { createHash } from 'node:crypto'

export type CacheIntent =
  | 'GENERAL_KNOWLEDGE'
  | 'CONCEPT_SEARCH'
  | 'PAPER_SEARCH'
  | 'TOPIC_SEARCH'
  | 'SCHOLARSHIP_SEARCH'
  | 'CONVERSATIONAL'
  | string

export function buildCacheKey(
  query: string,
  ctx: {
    board?: string | null
    level?: string | null
    subject?: string | null
    intent?: string | null
  }
) {
  const normalized = [
    query.toLowerCase().trim().replace(/\s+/g, ' '),
    ctx.board?.toLowerCase() ?? '',
    ctx.level?.toLowerCase() ?? '',
    ctx.subject?.toLowerCase() ?? '',
    ctx.intent?.toLowerCase() ?? '',
  ].join('|')

  return createHash('sha256').update(normalized).digest('hex')
}

export const CACHE_TTL_DAYS: Record<string, number> = {
  GENERAL_KNOWLEDGE: 30,
  CONCEPT_SEARCH: 14,
  PAPER_SEARCH: 7,
  TOPIC_SEARCH: 3,
  SCHOLARSHIP_SEARCH: 1,
  CONVERSATIONAL: 0,
}
