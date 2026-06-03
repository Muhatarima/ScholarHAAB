import { jsonlPath } from './dataset_common'
import { dedupeRows, loadInputRows, logImport, normalizeText, stableKey, upsertRows, validateSourceLicense, writeProcessed } from './knowledge_import_common'

type FormulaRow = Record<string, unknown>

async function main() {
  const input = process.env.FORMULA_BANK_FILE || 'sources/formula_bank.jsonl'
  const raw = loadInputRows<FormulaRow>(input)
  const accepted = dedupeRows(
    raw.filter(validateSourceLicense).map((row) => ({
      board: normalizeText(row.board || 'General'),
      level: normalizeText(row.level || 'General'),
      subject: normalizeText(row.subject),
      chapter: normalizeText(row.chapter),
      topic: normalizeText(row.topic),
      subtopic: normalizeText(row.subtopic),
      formula: normalizeText(row.formula),
      variables: row.variables && typeof row.variables === 'object' ? row.variables : {},
      units: normalizeText(row.units),
      meaning: normalizeText(row.meaning),
      when_to_use: normalizeText(row.when_to_use || row.whenToUse),
      common_mistakes: normalizeText(row.common_mistakes || row.commonMistakes),
      example: normalizeText(row.example),
      source_id: row.source_id || null,
    })).filter((row) => row.subject && row.topic && row.formula),
    (row) => stableKey([row.board, row.level, row.subject, row.topic, row.formula])
  )
  writeProcessed('processed/formula_bank.jsonl', accepted)
  const inserted = await upsertRows('formula_bank', accepted)
  logImport({ script: 'import_formula_bank', input: jsonlPath(input), output: 'dataset/processed/formula_bank.jsonl', read: raw.length, accepted: accepted.length, rejected: raw.length - accepted.length, inserted, failures: raw.length - accepted.length, notes: accepted.length ? [] : ['No licensed formula rows imported.'] })
}

main().catch((error) => { console.error(error); process.exit(1) })
