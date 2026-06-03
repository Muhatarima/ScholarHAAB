import { jsonlPath } from './dataset_common'
import { dedupeRows, loadInputRows, logImport, normalizeText, stableKey, upsertRows, validateSourceLicense, writeProcessed } from './knowledge_import_common'

type MisconceptionRow = Record<string, unknown>

async function main() {
  const input = process.env.MISCONCEPTION_BANK_FILE || 'sources/misconceptions.jsonl'
  const raw = loadInputRows<MisconceptionRow>(input)
  const accepted = dedupeRows(
    raw.filter(validateSourceLicense).map((row) => ({
      board: normalizeText(row.board || 'General'),
      level: normalizeText(row.level || 'General'),
      subject: normalizeText(row.subject),
      topic: normalizeText(row.topic),
      misconception: normalizeText(row.misconception),
      correction: normalizeText(row.correction),
      exam_warning: normalizeText(row.exam_warning || row.examWarning),
      example: normalizeText(row.example),
      source_id: row.source_id || null,
    })).filter((row) => row.subject && row.topic && row.misconception && row.correction),
    (row) => stableKey([row.board, row.level, row.subject, row.topic, row.misconception])
  )
  writeProcessed('processed/misconceptions.jsonl', accepted)
  const inserted = await upsertRows('misconception_bank', accepted)
  logImport({ script: 'build_misconception_bank', input: jsonlPath(input), output: 'dataset/processed/misconceptions.jsonl', read: raw.length, accepted: accepted.length, rejected: raw.length - accepted.length, inserted, failures: raw.length - accepted.length, notes: accepted.length ? [] : ['No licensed misconception rows imported.'] })
}

main().catch((error) => { console.error(error); process.exit(1) })
