import { jsonlPath, readJsonl, writeJsonl } from './dataset_common'
import { logImport, normalizeText, upsertRows, validateSourceLicense } from './knowledge_import_common'

type HuggingFaceSource = Record<string, unknown> & {
  source_name?: string
  source_url?: string
  license?: string
  subject?: string
  level?: string
  board?: string
  content?: string
  topic?: string
}

async function main() {
  const input = process.env.HF_DATASET_MANIFEST || jsonlPath('manifests/huggingface_sources.jsonl')
  const rows = readJsonl<HuggingFaceSource>(input)
  const chunks = rows
    .filter(validateSourceLicense)
    .map((row) => ({
      source_id: row.source_id ?? null,
      board: normalizeText(row.board || 'General'),
      level: normalizeText(row.level || 'General'),
      subject: normalizeText(row.subject || 'General'),
      chapter: normalizeText(row.chapter || ''),
      topic: normalizeText(row.topic || ''),
      content: normalizeText(row.content || row.notes || ''),
      chunk_type: 'huggingface_public_dataset',
      license: normalizeText(row.license || 'unknown'),
    }))
    .filter((row) => row.content.length > 0)

  writeJsonl(jsonlPath('processed/public_education_chunks.jsonl'), chunks)
  const inserted = await upsertRows('public_education_chunks', chunks)
  logImport({
    script: 'import_huggingface_datasets',
    input,
    output: 'dataset/processed/public_education_chunks.jsonl',
    read: rows.length,
    accepted: chunks.length,
    rejected: rows.length - chunks.length,
    inserted,
    failures: rows.length - chunks.length,
    notes: chunks.length ? [] : ['No compatible Hugging Face/public dataset rows supplied.'],
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
