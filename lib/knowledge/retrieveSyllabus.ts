import { list, safeSelect, text } from '@/lib/knowledge/db'
import type { KnowledgeFilter, SyllabusKnowledge } from '@/lib/knowledge/types'

export async function retrieveSyllabusKnowledge(filter: KnowledgeFilter): Promise<SyllabusKnowledge[]> {
  const topic = filter.topic || filter.query || ''
  const rows = await safeSelect(
    'syllabus_topics',
    'board, level, subject, chapter, topic, learning_objectives, specification_ref, command_words',
    filter,
    8
  )
  return rows.map((row) => ({
    board: text(row.board, filter.board || ''),
    level: text(row.level, filter.level || ''),
    subject: text(row.subject, filter.subject || ''),
    chapter: row.chapter ? text(row.chapter) : null,
    topic: text(row.topic, topic),
    learningObjectives: list(row.learning_objectives),
    specificationRef: row.specification_ref ? text(row.specification_ref) : null,
    commandWords: list(row.command_words),
    source: 'database',
  }))
}
