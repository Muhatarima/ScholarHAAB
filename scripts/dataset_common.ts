import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

export const DATASET_ROOT = path.resolve(process.cwd(), 'dataset')

export type PaperType = 'qp' | 'ms' | 'er' | 'syllabus' | 'textbook_allowed' | 'formula' | 'theory'
export type LicenseStatus = 'permitted' | 'user_provided' | 'blocked' | 'unknown'
export type AllowedStatus = 'allowed' | 'blocked' | 'needs_review'
export type SourceType =
  | 'past_paper'
  | 'mark_scheme'
  | 'syllabus'
  | 'formula'
  | 'theory'
  | 'concept_graph'
  | 'misconception'
  | 'public_dataset'
  | 'manual'

export type AcademicSource = {
  url: string
  source_name: string
  board: string
  level: string
  subject: string
  year: number | null
  paper_code: string
  paper_type: PaperType
  license_status: LicenseStatus
  allowed_status: AllowedStatus
  notes: string
  local_path?: string
  source_type?: SourceType
  license?: string
}

export type DownloadLog = {
  board: string
  level: string
  subject: string
  year: number | null
  paper_code: string
  paper_type: PaperType
  url: string
  status: 'downloaded' | 'skipped_existing' | 'blocked' | 'failed'
  checksum: string | null
  filepath: string | null
  error: string | null
  timestamp: string
}

export type PaperManifestItem = AcademicSource & {
  filepath: string | null
  checksum: string | null
  download_status: string
  parse_status: string
  db_status: string
}

export function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true })
}

export function ensureDatasetDirs() {
  [
    'raw/cambridge/o-level',
    'raw/cambridge/a-level',
    'raw/edexcel/o-level',
    'raw/edexcel/a-level',
    'sources',
    'cleaned',
    'processed',
    'manifests',
    'logs',
    'failed',
    'extracted_text',
    'chunks',
    'embeddings',
    'reports',
  ].forEach((dir) => ensureDir(path.join(DATASET_ROOT, dir)))
}

export function readJson<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) return fallback
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T
}

export function licenseAllowed(value: unknown) {
  const text = String(value ?? '').toLowerCase()
  if (!text || text === 'unknown' || text.includes('review')) return false
  return [
    'cc0',
    'cc-by',
    'cc by',
    'creative commons',
    'mit',
    'apache',
    'public domain',
    'user_provided',
    'user provided',
    'permitted',
    'open government',
  ].some((allowed) => text.includes(allowed))
}

export function jsonlPath(relativePath: string) {
  return path.join(DATASET_ROOT, relativePath)
}

export function readJsonl<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) return []
  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T)
}

export function appendJsonl(filePath: string, value: unknown) {
  ensureDir(path.dirname(filePath))
  fs.appendFileSync(filePath, `${JSON.stringify(value)}\n`, 'utf8')
}

export function writeJsonl(filePath: string, values: unknown[]) {
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, values.map((value) => JSON.stringify(value)).join('\n') + (values.length ? '\n' : ''), 'utf8')
}

export function writeJson(filePath: string, value: unknown) {
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8')
}

export function sha256File(filePath: string) {
  const hash = crypto.createHash('sha256')
  hash.update(fs.readFileSync(filePath))
  return hash.digest('hex')
}

export function sanitizeSegment(value: string | number | null | undefined) {
  return String(value ?? 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown'
}

export function targetPdfPath(source: AcademicSource) {
  return path.join(
    DATASET_ROOT,
    'raw',
    sanitizeSegment(source.board),
    sanitizeSegment(source.level),
    sanitizeSegment(source.subject),
    sanitizeSegment(source.year ?? 'unknown'),
    sanitizeSegment(source.paper_code),
    `${sanitizeSegment(source.paper_type)}.pdf`
  )
}

export function sourceKey(source: AcademicSource) {
  return [
    source.board,
    source.level,
    source.subject,
    source.year ?? 'unknown',
    source.paper_code,
    source.paper_type,
    source.url,
  ].map(String).join('|').toLowerCase()
}

export function isPermitted(source: AcademicSource) {
  return source.allowed_status === 'allowed' && ['permitted', 'user_provided'].includes(source.license_status)
}

export function inferBoardLevelPath(board: string, level: string) {
  const boardKey = sanitizeSegment(board).includes('edexcel') ? 'edexcel' : 'cambridge'
  const levelKey = sanitizeSegment(level).includes('a-level') || sanitizeSegment(level).includes('a-level') ? 'a-level' : 'o-level'
  return { boardKey, levelKey }
}

export function loadSourceInput(filePath: string): AcademicSource[] {
  if (!fs.existsSync(filePath)) return []
  const raw = fs.readFileSync(filePath, 'utf8')
  const parsed = JSON.parse(raw) as unknown
  if (!Array.isArray(parsed)) throw new Error(`Source input must be an array: ${filePath}`)
  return parsed.map((item) => item as AcademicSource)
}
