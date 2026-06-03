import { PaperManifestItem, ensureDatasetDirs, jsonlPath, readJsonl, writeJson } from './dataset_common'

type CoverageBucket = Record<string, number>

function add(bucket: CoverageBucket, key: string | number | null | undefined) {
  const value = String(key ?? 'unknown')
  bucket[value] = (bucket[value] ?? 0) + 1
}

function groupMissing(items: PaperManifestItem[]) {
  const missingByBoard: CoverageBucket = {}
  const missingByLevel: CoverageBucket = {}
  const missingBySubject: CoverageBucket = {}
  const missingByYear: CoverageBucket = {}

  for (const item of items) {
    if (['downloaded', 'skipped_existing'].includes(item.download_status)) continue
    add(missingByBoard, item.board)
    add(missingByLevel, item.level)
    add(missingBySubject, item.subject)
    add(missingByYear, item.year)
  }

  return { missingByBoard, missingByLevel, missingBySubject, missingByYear }
}

async function main() {
  ensureDatasetDirs()
  const manifest = readJsonl<PaperManifestItem>(jsonlPath('manifests/papers_manifest.jsonl'))
  const totalExpected = manifest.length
  const totalFound = manifest.filter((item) => item.allowed_status === 'allowed').length
  const totalDownloaded = manifest.filter((item) => ['downloaded', 'skipped_existing'].includes(item.download_status)).length
  const totalParsed = manifest.filter((item) => item.parse_status === 'parsed').length
  const totalInserted = manifest.filter((item) => item.db_status === 'inserted').length
  const missingMarkSchemes = manifest.filter((item) => item.paper_type === 'ms' && !['downloaded', 'skipped_existing'].includes(item.download_status))
  const missingQuestionPapers = manifest.filter((item) => item.paper_type === 'qp' && !['downloaded', 'skipped_existing'].includes(item.download_status))

  const report = {
    generated_at: new Date().toISOString(),
    honesty_notice: totalExpected === 0
      ? 'No approved source manifest entries exist yet. Coverage is 0 and no collection claims are permitted.'
      : totalDownloaded < totalExpected
        ? 'Coverage is incomplete. Do not claim complete dataset.'
        : 'Downloaded coverage equals manifest expectation; still verify parse/db counts before claiming readiness.',
    total_expected: totalExpected,
    total_found: totalFound,
    total_downloaded: totalDownloaded,
    total_parsed: totalParsed,
    total_inserted: totalInserted,
    coverage_percentage: totalExpected ? Number(((totalDownloaded / totalExpected) * 100).toFixed(2)) : 0,
    parse_percentage: totalExpected ? Number(((totalParsed / totalExpected) * 100).toFixed(2)) : 0,
    insert_percentage: totalExpected ? Number(((totalInserted / totalExpected) * 100).toFixed(2)) : 0,
    ...groupMissing(manifest),
    missing_mark_schemes: missingMarkSchemes.length,
    missing_question_papers: missingQuestionPapers.length,
    failed_items: manifest.filter((item) => ['failed', 'blocked', 'not_downloaded'].includes(item.download_status)),
  }

  writeJson(jsonlPath('reports/coverage_report.json'), report)
  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
