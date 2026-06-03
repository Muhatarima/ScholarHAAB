import { jsonlPath } from './dataset_common'
import { dedupeRows, loadInputRows, logImport, normalizeText, stableKey, upsertRows, validateSourceLicense, writeProcessed } from './knowledge_import_common'

type TheoryRow = Record<string, unknown>
function list(value: unknown) {
  return Array.isArray(value) ? value.map(String) : normalizeText(value).split(/[;,]/).map((item) => item.trim()).filter(Boolean)
}

async function main() {
  const input = process.env.THEORY_BANK_FILE || 'sources/theory_bank.jsonl'
  const raw = loadInputRows<TheoryRow>(input)
  const accepted = dedupeRows(
    raw.filter(validateSourceLicense).map((row) => ({
      board: normalizeText(row.board || 'General'),
      level: normalizeText(row.level || 'General'),
      subject: normalizeText(row.subject),
      chapter: normalizeText(row.chapter),
      topic: normalizeText(row.topic),
      subtopic: normalizeText(row.subtopic),
      short_explanation: normalizeText(row.short_explanation || row.shortExplanation),
      detailed_explanation: normalizeText(row.detailed_explanation || row.detailedExplanation),
      exam_keywords: list(row.exam_keywords || row.examKeywords),
      common_misconceptions: list(row.common_misconceptions || row.commonMisconceptions || row.misconceptions),
      examiner_tip: normalizeText(row.examiner_tip || row.examinerTip),
      source_id: row.source_id || null,
    })).filter((row) => row.subject && row.topic && (row.short_explanation || row.detailed_explanation)),
    (row) => stableKey([row.board, row.level, row.subject, row.topic, row.short_explanation])
  )
  writeProcessed('processed/theory_bank.jsonl', accepted)
  const inserted = await upsertRows('theory_bank', accepted)
  logImport({ script: 'import_theory_bank', input: jsonlPath(input), output: 'dataset/processed/theory_bank.jsonl', read: raw.length, accepted: accepted.length, rejected: raw.length - accepted.length, inserted, failures: raw.length - accepted.length, notes: accepted.length ? [] : ['No licensed theory rows imported.'] })
}

main().catch((error) => { console.error(error); process.exit(1) })
