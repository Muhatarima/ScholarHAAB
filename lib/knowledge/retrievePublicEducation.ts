import { safeSelect, text } from '@/lib/knowledge/db'
import type { KnowledgeFilter, PublicEducationKnowledge } from '@/lib/knowledge/types'

export async function retrievePublicEducation(filter: KnowledgeFilter): Promise<PublicEducationKnowledge[]> {
  const topic = filter.topic || filter.query || ''
  const rows = await safeSelect(
    'public_education_chunks',
    'subject, chapter, topic, content, chunk_type, license',
    filter,
    6
  )
  return rows.map((row) => ({
    subject: text(row.subject, filter.subject || 'General'),
    chapter: row.chapter ? text(row.chapter) : null,
    topic: row.topic ? text(row.topic) : topic || null,
    content: text(row.content),
    chunkType: text(row.chunk_type, 'public_dataset'),
    license: text(row.license, 'unknown'),
    source: 'database' as const,
  })).filter((row) => row.content.length > 0)
}
