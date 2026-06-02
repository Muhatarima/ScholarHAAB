import { getKnowledgeContext } from '@/lib/knowledge/base'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'

export type TheoryRetrieval = {
  subject: string
  chapter?: string | null
  topic: string
  shortExplanation: string
  detailedExplanation: string
  examKeywords: string[]
  misconceptions: string[]
  source: 'theory_bank' | 'local_knowledge'
}

export async function retrieveTheory(query: string, subject = 'General', topic = query): Promise<TheoryRetrieval[]> {
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('theory_bank')
      .select('subject, chapter, topic, short_explanation, detailed_explanation, exam_keywords, misconceptions')
      .or(`topic.ilike.%${topic}%,short_explanation.ilike.%${query}%`)
      .limit(5)
    if (!error && data?.length) {
      return data.map((row) => ({
        subject: String(row.subject ?? subject),
        chapter: row.chapter ? String(row.chapter) : null,
        topic: String(row.topic ?? topic),
        shortExplanation: String(row.short_explanation ?? ''),
        detailedExplanation: String(row.detailed_explanation ?? row.short_explanation ?? ''),
        examKeywords: Array.isArray(row.exam_keywords) ? row.exam_keywords.map(String) : [],
        misconceptions: Array.isArray(row.misconceptions) ? row.misconceptions.map(String) : [],
        source: 'theory_bank',
      }))
    }
  } catch {
    // Local knowledge fallback below.
  }

  const knowledge = getKnowledgeContext(subject, topic)
  return [{
    subject,
    chapter: null,
    topic,
    shortExplanation: knowledge.theory,
    detailedExplanation: knowledge.theory,
    examKeywords: knowledge.examKeywords,
    misconceptions: [knowledge.commonMistake],
    source: 'local_knowledge',
  }]
}
