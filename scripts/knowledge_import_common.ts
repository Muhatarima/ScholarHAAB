import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import {
  DATASET_ROOT,
  appendJsonl,
  ensureDatasetDirs,
  jsonlPath,
  licenseAllowed,
  readJson,
  readJsonl,
  writeJson,
  writeJsonl,
} from './dataset_common'

export type ImportSummary = {
  script: string
  input: string
  output?: string
  read: number
  accepted: number
  rejected: number
  inserted: number
  failures: number
  notes: string[]
}

export function normalizeText(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

export function stableKey(values: unknown[]) {
  return values.map((value) => normalizeText(value).toLowerCase()).join('|')
}

export function dedupeRows<T>(rows: T[], key: (row: T) => string) {
  const seen = new Set<string>()
  return rows.filter((row) => {
    const rowKey = key(row)
    if (seen.has(rowKey)) return false
    seen.add(rowKey)
    return true
  })
}

export function loadInputRows<T>(relativePath: string) {
  const filePath = path.join(DATASET_ROOT, relativePath)
  if (!fs.existsSync(filePath)) return [] as T[]
  if (filePath.endsWith('.jsonl')) return readJsonl<T>(filePath)
  const parsed = readJson<unknown>(filePath, [])
  return Array.isArray(parsed) ? (parsed as T[]) : []
}

export function validateSourceLicense(row: Record<string, unknown>) {
  const allowedStatus = normalizeText(row.allowed_status || row.allowedStatus || 'needs_review').toLowerCase()
  const license = normalizeText(row.license || row.license_status || row.licenseStatus || 'unknown')
  return allowedStatus === 'allowed' && licenseAllowed(license)
}

export function logImport(summary: ImportSummary) {
  appendJsonl(jsonlPath('logs/knowledge_imports.jsonl'), {
    ...summary,
    timestamp: new Date().toISOString(),
  })
  writeJson(jsonlPath(`reports/${summary.script}.json`), summary)
  console.log(JSON.stringify(summary, null, 2))
}

export async function upsertRows(table: string, rows: Record<string, unknown>[], conflictTarget?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || rows.length === 0) return 0
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const request = supabase.from(table).upsert(rows, conflictTarget ? { onConflict: conflictTarget } : undefined)
  const { error } = await request
  if (error) throw error
  return rows.length
}

export function writeProcessed(relativePath: string, rows: unknown[]) {
  ensureDatasetDirs()
  writeJsonl(jsonlPath(relativePath), rows)
}
