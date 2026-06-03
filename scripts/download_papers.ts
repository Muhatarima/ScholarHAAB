import fs from 'node:fs'
import path from 'node:path'
import {
  AcademicSource,
  DownloadLog,
  appendJsonl,
  ensureDir,
  ensureDatasetDirs,
  isPermitted,
  jsonlPath,
  readJsonl,
  sha256File,
  targetPdfPath,
} from './dataset_common'

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function downloadHttp(url: string, filepath: string) {
  let lastError: unknown
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(20000) })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const contentType = response.headers.get('content-type') ?? ''
      if (!contentType.includes('pdf') && !url.toLowerCase().endsWith('.pdf')) {
        throw new Error(`Refusing non-PDF response: ${contentType || 'unknown content-type'}`)
      }
      const buffer = Buffer.from(await response.arrayBuffer())
      ensureDir(path.dirname(filepath))
      fs.writeFileSync(filepath, buffer)
      return
    } catch (error) {
      lastError = error
      await sleep(1000 * attempt)
    }
  }
  throw lastError
}

function logAttempt(source: AcademicSource, entry: Omit<DownloadLog, 'board' | 'level' | 'subject' | 'year' | 'paper_code' | 'paper_type' | 'url' | 'timestamp'>) {
  const log: DownloadLog = {
    board: source.board,
    level: source.level,
    subject: source.subject,
    year: source.year,
    paper_code: source.paper_code,
    paper_type: source.paper_type,
    url: source.url,
    timestamp: new Date().toISOString(),
    ...entry,
  }
  appendJsonl(jsonlPath('logs/download_attempts.jsonl'), log)
  if (log.status === 'failed' || log.status === 'blocked') {
    appendJsonl(jsonlPath('failed/download_failures.jsonl'), log)
  }
}

async function downloadSource(source: AcademicSource) {
  if (!isPermitted(source)) {
    logAttempt(source, {
      status: 'blocked',
      checksum: null,
      filepath: null,
      error: 'SOURCE_BLOCKED_OR_NOT_PERMITTED',
    })
    return
  }

  const filepath = targetPdfPath(source)
  if (fs.existsSync(filepath)) {
    logAttempt(source, {
      status: 'skipped_existing',
      checksum: sha256File(filepath),
      filepath,
      error: null,
    })
    return
  }

  try {
    if (source.local_path || source.url.startsWith('file://')) {
      const localPath = source.local_path || new URL(source.url).pathname
      if (!localPath || !fs.existsSync(localPath)) throw new Error(`Local source missing: ${localPath}`)
      ensureDir(path.dirname(filepath))
      fs.copyFileSync(localPath, filepath)
    } else {
      await downloadHttp(source.url, filepath)
    }
    logAttempt(source, {
      status: 'downloaded',
      checksum: sha256File(filepath),
      filepath,
      error: null,
    })
  } catch (error) {
    logAttempt(source, {
      status: 'failed',
      checksum: null,
      filepath: null,
      error: error instanceof Error ? error.message : 'Unknown download error',
    })
  }
}

async function main() {
  ensureDatasetDirs()
  const sources = readJsonl<AcademicSource>(jsonlPath('manifests/sources_manifest.jsonl'))
  for (const source of sources) {
    await downloadSource(source)
    await sleep(Number(process.env.DATASET_DOWNLOAD_DELAY_MS ?? 750))
  }
  console.log(JSON.stringify({ sources: sources.length, log: 'dataset/logs/download_attempts.jsonl' }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
