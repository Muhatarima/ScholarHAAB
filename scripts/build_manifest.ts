import fs from 'node:fs'
import {
  AcademicSource,
  DownloadLog,
  PaperManifestItem,
  ensureDatasetDirs,
  isPermitted,
  jsonlPath,
  readJsonl,
  targetPdfPath,
  writeJsonl,
} from './dataset_common'

function latestDownload(downloads: DownloadLog[], source: AcademicSource) {
  return downloads
    .filter((item) =>
      item.url === source.url &&
      item.board === source.board &&
      item.level === source.level &&
      item.subject === source.subject &&
      item.paper_code === source.paper_code &&
      item.paper_type === source.paper_type
    )
    .at(-1)
}

function parseStatusFor(filepath: string | null) {
  if (!filepath) return 'not_parsed'
  const parsedQuestions = readJsonl<Record<string, unknown>>(jsonlPath('extracted_text/questions.jsonl'))
  const parsedMarkSchemes = readJsonl<Record<string, unknown>>(jsonlPath('extracted_text/mark_schemes.jsonl'))
  const found = [...parsedQuestions, ...parsedMarkSchemes].some((row) => row.source_file_path === filepath)
  return found ? 'parsed' : 'not_parsed'
}

async function main() {
  ensureDatasetDirs()
  const sources = readJsonl<AcademicSource>(jsonlPath('manifests/sources_manifest.jsonl'))
  const downloads = readJsonl<DownloadLog>(jsonlPath('logs/download_attempts.jsonl'))

  const manifest: PaperManifestItem[] = sources.map((source) => {
    const latest = latestDownload(downloads, source)
    const expectedPath = targetPdfPath(source)
    const filepath = latest?.filepath ?? (fs.existsSync(expectedPath) ? expectedPath : null)
    return {
      ...source,
      filepath,
      checksum: latest?.checksum ?? null,
      download_status: latest?.status ?? (isPermitted(source) ? 'not_downloaded' : 'blocked'),
      parse_status: parseStatusFor(filepath),
      db_status: 'not_inserted',
    }
  })

  writeJsonl(jsonlPath('manifests/papers_manifest.jsonl'), manifest)
  console.log(JSON.stringify({
    sources: sources.length,
    manifestItems: manifest.length,
    downloaded: manifest.filter((item) => ['downloaded', 'skipped_existing'].includes(item.download_status)).length,
    manifest: 'dataset/manifests/papers_manifest.jsonl',
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
