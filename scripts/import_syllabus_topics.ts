import { jsonlPath } from './dataset_common'
import { dedupeRows, loadInputRows, logImport, normalizeText, stableKey, upsertRows, validateSourceLicense, writeProcessed } from './knowledge_import_common'

type SyllabusRow = Record<string, unknown>
function list(value: unknown) {
  return Array.isArray(value) ? value.map(String) : normalizeText(value).split(/[;,]/).map((item) => item.trim()).filter(Boolean)
}

async function main() {
  const input = process.env.SYLLABUS_TOPICS_FILE || 'sources/syllabus_topics.jsonl'
  const raw = loadInputRows<SyllabusRow>(input)
  const accepted = dedupeRows(
    raw.filter(validateSourceLicense).map((row) => ({
      board: normalizeText(row.board),
      level: normalizeText(row.level),
      subject: normalizeText(row.subject),
      chapter: normalizeText(row.chapter),
      topic: normalizeText(row.topic),
      subtopic: normalizeText(row.subtopic),
      learning_objectives: list(row.learning_objectives || row.learningObjectives),
      specification_ref: normalizeText(row.specification_ref || row.specificationRef),
      command_words: list(row.command_words || row.commandWords),
      source_id: row.source_id || null,
    })).filter((row) => row.board && row.level && row.subject && row.topic),
    (row) => stableKey([row.board, row.level, row.subject, row.topic, row.specification_ref])
  )
  writeProcessed('processed/syllabus_topics.jsonl', accepted)
  const inserted = await upsertRows('syllabus_topics', accepted)
  logImport({ script: 'import_syllabus_topics', input: jsonlPath(input), output: 'dataset/processed/syllabus_topics.jsonl', read: raw.length, accepted: accepted.length, rejected: raw.length - accepted.length, inserted, failures: raw.length - accepted.length, notes: accepted.length ? [] : ['No licensed syllabus rows imported.'] })
}

main().catch((error) => { console.error(error); process.exit(1) })
