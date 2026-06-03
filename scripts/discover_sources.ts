import fs from 'node:fs'
import path from 'node:path'
import {
  AcademicSource,
  DATASET_ROOT,
  ensureDatasetDirs,
  isPermitted,
  jsonlPath,
  loadSourceInput,
  sourceKey,
  writeJsonl,
} from './dataset_common'

type RobotsStatus = 'allowed_by_robots' | 'blocked_by_robots' | 'robots_unavailable' | 'local_file'

function normalizeSource(source: AcademicSource): AcademicSource {
  const url = String(source.url ?? '').trim()
  if (!url) throw new Error('Source url/local path is required')

  return {
    url,
    source_name: source.source_name || 'user-provided-source',
    board: source.board || 'unknown',
    level: source.level || 'unknown',
    subject: source.subject || 'unknown',
    year: typeof source.year === 'number' ? source.year : null,
    paper_code: source.paper_code || 'unknown',
    paper_type: source.paper_type || 'qp',
    license_status: source.license_status || 'unknown',
    allowed_status: source.allowed_status || 'needs_review',
    notes: source.notes || '',
    local_path: source.local_path,
  }
}

async function robotsCheck(source: AcademicSource): Promise<{ status: RobotsStatus; notes: string }> {
  if (source.url.startsWith('file://') || source.local_path) {
    return { status: 'local_file', notes: 'Local/user-provided file; user must have rights.' }
  }

  try {
    const parsed = new URL(source.url)
    const robotsUrl = `${parsed.protocol}//${parsed.host}/robots.txt`
    const response = await fetch(robotsUrl, { signal: AbortSignal.timeout(5000) })
    if (!response.ok) return { status: 'robots_unavailable', notes: `robots.txt unavailable: HTTP ${response.status}` }

    const body = await response.text()
    const pathName = parsed.pathname
    const disallowLines = body
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /^disallow:/i.test(line))
      .map((line) => line.split(':').slice(1).join(':').trim())
      .filter(Boolean)

    const blocked = disallowLines.some((rule) => rule !== '/' && pathName.startsWith(rule))
    return {
      status: blocked ? 'blocked_by_robots' : 'allowed_by_robots',
      notes: blocked ? 'robots.txt appears to disallow this path.' : 'robots.txt did not block this path.',
    }
  } catch (error) {
    return {
      status: 'robots_unavailable',
      notes: error instanceof Error ? error.message : 'Could not check robots.txt.',
    }
  }
}

async function main() {
  ensureDatasetDirs()
  const inputFile = process.env.DATASET_SOURCE_FILE || path.join(DATASET_ROOT, 'manifests', 'source_input.json')
  const rawSources = fs.existsSync(inputFile) ? loadSourceInput(inputFile) : []
  const discovered: AcademicSource[] = []
  const blocked: AcademicSource[] = []
  const seen = new Set<string>()

  for (const rawSource of rawSources) {
    const source = normalizeSource(rawSource)
    const robots = await robotsCheck(source)
    const permitted = isPermitted(source) && robots.status !== 'blocked_by_robots'
    const enriched: AcademicSource = {
      ...source,
      allowed_status: permitted ? 'allowed' : source.allowed_status === 'blocked' ? 'blocked' : 'needs_review',
      notes: [source.notes, robots.status, robots.notes].filter(Boolean).join(' | '),
    }

    const key = sourceKey(enriched)
    if (seen.has(key)) continue
    seen.add(key)

    if (permitted) discovered.push(enriched)
    else blocked.push({
      ...enriched,
      allowed_status: enriched.allowed_status === 'allowed' ? 'needs_review' : enriched.allowed_status,
      notes: `${enriched.notes} | SOURCE_BLOCKED_OR_NOT_PERMITTED`,
    })
  }

  writeJsonl(jsonlPath('manifests/sources_manifest.jsonl'), [...discovered, ...blocked])
  writeJsonl(jsonlPath('failed/source_blocked_or_not_permitted.jsonl'), blocked)

  console.log(JSON.stringify({
    inputFile,
    allowedSources: discovered.length,
    blockedOrNeedsReview: blocked.length,
    manifest: 'dataset/manifests/sources_manifest.jsonl',
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
