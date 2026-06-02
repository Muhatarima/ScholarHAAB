import { getKnowledgeContext } from '@/lib/knowledge/base'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'

export type FormulaRetrieval = {
  formula: string
  topic: string
  subject: string
  meaning: string
  units?: string | null
  commonMistake: string
  source: 'formula_bank' | 'local_knowledge'
}

export async function retrieveFormula(query: string, subject = 'General', topic = query): Promise<FormulaRetrieval[]> {
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('formula_bank')
      .select('subject, topic, formula, meaning, units, common_mistakes')
      .ilike('topic', `%${topic}%`)
      .limit(5)
    if (!error && data?.length) {
      return data.map((row) => ({
        formula: String(row.formula ?? ''),
        topic: String(row.topic ?? topic),
        subject: String(row.subject ?? subject),
        meaning: String(row.meaning ?? ''),
        units: row.units ? String(row.units) : null,
        commonMistake: String(row.common_mistakes ?? 'Check units and substitutions.'),
        source: 'formula_bank',
      }))
    }
  } catch {
    // Local knowledge fallback below.
  }

  const knowledge = getKnowledgeContext(subject, topic)
  return knowledge.formula
    ? [{
        formula: knowledge.formula,
        topic,
        subject,
        meaning: knowledge.theory,
        units: null,
        commonMistake: knowledge.commonMistake,
        source: 'local_knowledge',
      }]
    : []
}
