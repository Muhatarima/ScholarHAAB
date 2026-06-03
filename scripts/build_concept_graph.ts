import { jsonlPath } from './dataset_common'
import { dedupeRows, loadInputRows, logImport, normalizeText, stableKey, upsertRows, validateSourceLicense, writeProcessed } from './knowledge_import_common'

type ConceptRow = Record<string, unknown>
function list(value: unknown) {
  return Array.isArray(value) ? value.map(String) : normalizeText(value).split(/[;,]/).map((item) => item.trim()).filter(Boolean)
}

async function main() {
  const input = process.env.CONCEPT_GRAPH_FILE || 'sources/concept_graph.jsonl'
  const raw = loadInputRows<ConceptRow>(input)
  const accepted = dedupeRows(
    raw.filter(validateSourceLicense).map((row) => ({
      board: normalizeText(row.board || 'General'),
      level: normalizeText(row.level || 'General'),
      subject: normalizeText(row.subject),
      concept: normalizeText(row.concept || row.topic),
      prerequisite_concepts: list(row.prerequisite_concepts || row.prerequisiteConcepts),
      dependent_concepts: list(row.dependent_concepts || row.dependentConcepts),
      related_topics: list(row.related_topics || row.relatedTopics),
      difficulty: normalizeText(row.difficulty || 'core'),
      source_id: row.source_id || null,
    })).filter((row) => row.subject && row.concept),
    (row) => stableKey([row.board, row.level, row.subject, row.concept])
  )
  writeProcessed('processed/concept_graph.jsonl', accepted)
  const inserted = await upsertRows('concept_graph', accepted)
  logImport({ script: 'build_concept_graph', input: jsonlPath(input), output: 'dataset/processed/concept_graph.jsonl', read: raw.length, accepted: accepted.length, rejected: raw.length - accepted.length, inserted, failures: raw.length - accepted.length, notes: accepted.length ? [] : ['No licensed concept graph rows imported.'] })
}

main().catch((error) => { console.error(error); process.exit(1) })
