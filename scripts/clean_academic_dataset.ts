import { jsonlPath, readJsonl, writeJsonl } from './dataset_common'
import { logImport, normalizeText, stableKey } from './knowledge_import_common'

const FILES = [
  'processed/formula_bank.jsonl',
  'processed/theory_bank.jsonl',
  'processed/syllabus_topics.jsonl',
  'processed/concept_graph.jsonl',
  'processed/misconceptions.jsonl',
  'processed/command_words.jsonl',
  'processed/public_education_chunks.jsonl',
]

function cleanRow(row: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === 'string' ? normalizeText(value) : value]))
}

async function main() {
  let read = 0
  let accepted = 0
  for (const file of FILES) {
    const rows = readJsonl<Record<string, unknown>>(jsonlPath(file)).map(cleanRow)
    read += rows.length
    const seen = new Set<string>()
    const deduped = rows.filter((row) => {
      const key = stableKey([row.board, row.level, row.subject, row.topic, row.formula || row.content || row.short_explanation || row.misconception || row.command_word || row.concept])
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    accepted += deduped.length
    writeJsonl(jsonlPath(file), deduped)
  }
  logImport({ script: 'clean_academic_dataset', input: 'dataset/processed/*.jsonl', read, accepted, rejected: read - accepted, inserted: 0, failures: 0, notes: ['Cleaned whitespace and removed duplicate processed rows.'] })
}

main().catch((error) => { console.error(error); process.exit(1) })
