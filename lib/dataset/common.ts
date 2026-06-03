import fs from 'node:fs'
import path from 'node:path'

export type PaperManifestItem = {
  board: string
  level: string
  subject: string
  year: number
  paper_type: string
  local_path?: string
  source_url?: string
}

export function datasetRoot() {
  return path.resolve(process.cwd(), 'dataset')
}

export function jsonlPath(name: string) {
  return path.join(datasetRoot(), 'processed', `${name}.jsonl`)
}

export function reportsDir() {
  return path.join(datasetRoot(), 'reports')
}

export function readJsonl<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) return []
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean)
  const rows: T[] = []
  for (const line of lines) {
    try {
      rows.push(JSON.parse(line) as T)
    } catch {
      // skip malformed line
    }
  }
  return rows
}

export function writeJson(filePath: string, value: unknown) {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8')
}
