import { getKnowledgeContext } from '@/lib/knowledge/base'
import { safeSelect, text } from '@/lib/knowledge/db'
import type { FormulaKnowledge, KnowledgeFilter } from '@/lib/knowledge/types'

export async function retrieveFormulaKnowledge(filter: KnowledgeFilter): Promise<FormulaKnowledge[]> {
  const topic = filter.topic || filter.query || ''
  const rows = await safeSelect(
    'formula_bank',
    'subject, topic, formula, variables, units, meaning, when_to_use, common_mistakes, example',
    filter,
    6
  )
  if (rows.length) {
    return rows.map((row) => ({
      formula: text(row.formula),
      subject: text(row.subject, filter.subject || 'General'),
      topic: text(row.topic, topic),
      variables: typeof row.variables === 'object' && row.variables ? row.variables as Record<string, unknown> : {},
      units: row.units ? text(row.units) : null,
      meaning: text(row.meaning),
      whenToUse: row.when_to_use ? text(row.when_to_use) : null,
      commonMistake: text(row.common_mistakes, 'Check units before substitution.'),
      example: row.example ? text(row.example) : null,
      source: 'database',
    }))
  }

  const local = getKnowledgeContext(filter.subject || 'General', topic)
  if (!local.formula) return []
  return [{
    formula: local.formula,
    subject: filter.subject || 'General',
    topic,
    variables: {},
    units: local.units || null,
    meaning: local.meaning || local.theory,
    whenToUse: local.pattern,
    commonMistake: local.commonMistake,
    example: null,
    source: 'local_knowledge',
  }]
}
