import { AcademicSource, ensureDatasetDirs, jsonlPath, loadSourceInput, writeJsonl } from './dataset_common'
import { logImport, normalizeText, validateSourceLicense } from './knowledge_import_common'

async function main() {
  ensureDatasetDirs()
  const inputFile = process.env.KNOWLEDGE_SOURCE_FILE || jsonlPath('sources/public_sources.json')
  const rows = loadSourceInput(inputFile)
  const accepted: AcademicSource[] = []
  const rejected: AcademicSource[] = []

  for (const row of rows) {
    const sourceType = normalizeText(row.source_type || row.paper_type || 'public_dataset')
    if (!validateSourceLicense(row as unknown as Record<string, unknown>) || !sourceType) rejected.push(row)
    else accepted.push({ ...row, source_type: sourceType as AcademicSource['source_type'] })
  }

  writeJsonl(jsonlPath('manifests/public_dataset_sources.jsonl'), accepted)
  writeJsonl(jsonlPath('failed/public_dataset_review_required.jsonl'), rejected)
  logImport({
    script: 'discover_public_datasets',
    input: inputFile,
    output: 'dataset/manifests/public_dataset_sources.jsonl',
    read: rows.length,
    accepted: accepted.length,
    rejected: rejected.length,
    inserted: 0,
    failures: rejected.length,
    notes: accepted.length ? [] : ['No permitted public dataset source supplied. Nothing was imported.'],
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
