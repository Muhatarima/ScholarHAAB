import { getKnowledgeContext } from '@/lib/knowledge/base'
import { list, safeSelect, text } from '@/lib/knowledge/db'
import type { KnowledgeFilter, TheoryKnowledge } from '@/lib/knowledge/types'

export async function retrieveTheoryKnowledge(filter: KnowledgeFilter): Promise<TheoryKnowledge[]> {
  const topic = filter.topic || filter.query || ''
  const rows = await safeSelect(
    'theory_bank',
    'subject, chapter, topic, short_explanation, detailed_explanation, exam_keywords, common_misconceptions, misconceptions, examiner_tip',
    filter,
    6
  )
  if (rows.length) {
    return rows.map((row) => ({
      subject: text(row.subject, filter.subject || 'General'),
      chapter: row.chapter ? text(row.chapter) : null,
      topic: text(row.topic, topic),
      shortExplanation: text(row.short_explanation),
      detailedExplanation: text(row.detailed_explanation, text(row.short_explanation)),
      examKeywords: list(row.exam_keywords),
      commonMisconceptions: list(row.common_misconceptions || row.misconceptions),
      examinerTip: row.examiner_tip ? text(row.examiner_tip) : null,
      source: 'database',
    }))
  }

  const local = getKnowledgeContext(filter.subject || 'General', topic)
  return [{
    subject: filter.subject || 'General',
    chapter: null,
    topic,
    shortExplanation: local.theory,
    detailedExplanation: local.theory,
    examKeywords: local.examKeywords,
    commonMisconceptions: [local.commonMistake],
    examinerTip: local.pattern,
    source: 'local_knowledge',
  }]
}
