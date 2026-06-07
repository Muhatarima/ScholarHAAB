import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { PDFParse } from 'pdf-parse'

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return

  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const separatorIndex = line.indexOf('=')
    if (separatorIndex === -1) continue
    const key = line.slice(0, separatorIndex).trim()
    const value = line
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '')
    if (!(key in process.env)) process.env[key] = value
  }
}

loadLocalEnv()

type SourceRecord = Record<string, unknown>

type PreparedChunk = {
  id: string
  content: string
  metadata: Record<string, unknown>
  tier: string
  retrieval_priority: number
  source_url: string | null
  source_title: string
  source_domain: string | null
  source_kind: string
  source_quality: string
  last_checked: string
  embedding: number[]
  embedding_model: string
  embedding_dimensions: number
  content_hash: string
}

const EMBEDDING_MODEL =
  process.env.GEMINI_EMBEDDING_MODEL?.trim() || 'gemini-embedding-001'
const EMBEDDING_DIMENSIONS =
  Number(process.env.GEMINI_EMBEDDING_DIMENSIONS) || 768
const TARGET_CHARS = 2_048
const OVERLAP_CHARS = Math.round(TARGET_CHARS * 0.2)

function arg(name: string, fallback?: string) {
  const index = process.argv.indexOf(name)
  return index >= 0 && process.argv[index + 1]
    ? process.argv[index + 1]
    : fallback
}

function hasFlag(name: string) {
  return process.argv.includes(name)
}

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function cleanText(value: unknown) {
  return typeof value === 'string'
    ? value.replace(/\u0000/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
    : ''
}

function safeDomain(value: string | null) {
  if (!value) return null
  try {
    return new URL(value).hostname
  } catch {
    return null
  }
}

function chunkText(text: string) {
  const normalized = cleanText(text)
  if (!normalized) return []
  if (normalized.length <= TARGET_CHARS) return [normalized]

  const chunks: string[] = []
  let start = 0
  while (start < normalized.length) {
    let end = Math.min(start + TARGET_CHARS, normalized.length)
    if (end < normalized.length) {
      const naturalBreak = Math.max(
        normalized.lastIndexOf('\n', end),
        normalized.lastIndexOf('. ', end),
        normalized.lastIndexOf(' ', end)
      )
      if (naturalBreak > start + TARGET_CHARS * 0.6) {
        end = naturalBreak + 1
      }
    }

    const chunk = normalized.slice(start, end).trim()
    if (chunk) chunks.push(chunk)
    if (end >= normalized.length) break
    start = Math.max(end - OVERLAP_CHARS, start + 1)
  }
  return chunks
}

function sourceText(record: SourceRecord) {
  const question = cleanText(
    record.question_text ?? record.question ?? record.content ?? record.text
  )
  const answer = cleanText(
    record.answer_summary ?? record.answer ?? record.mark_scheme ?? record.solution
  )
  return [question, answer ? `Answer or mark scheme:\n${answer}` : '']
    .filter(Boolean)
    .join('\n\n')
}

function collectRecords(value: unknown, output: SourceRecord[] = []) {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectRecords(entry, output))
    return output
  }

  if (!value || typeof value !== 'object') return output
  const record = value as SourceRecord
  if (sourceText(record)) {
    output.push(record)
    return output
  }

  Object.values(record).forEach((entry) => collectRecords(entry, output))
  return output
}

async function loadRecords(inputPath: string) {
  const extension = path.extname(inputPath).toLowerCase()
  if (extension === '.pdf') {
    const parser = new PDFParse({ data: fs.readFileSync(inputPath) })
    try {
      const result = await parser.getText()
      return [{ content: result.text, source_file: path.basename(inputPath) }]
    } finally {
      await parser.destroy()
    }
  }

  const raw = fs.readFileSync(inputPath, 'utf8')
  if (extension === '.txt' || extension === '.md') {
    return [{ content: raw, source_file: path.basename(inputPath) }]
  }

  if (extension === '.jsonl') {
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as SourceRecord)
  }

  return collectRecords(JSON.parse(raw))
}

function metadataFor(record: SourceRecord, inputPath: string) {
  const keys = [
    'board',
    'level',
    'subject',
    'topic',
    'sub_topic',
    'chapter',
    'year',
    'paper',
    'paper_code',
    'paper_type',
    'question_number',
    'marks',
    'resource_type',
  ]
  const metadata = Object.fromEntries(
    keys
      .filter((key) => record[key] !== null && record[key] !== undefined && record[key] !== '')
      .map((key) => [key, record[key]])
  )
  metadata.source_file =
    cleanText(record.source_file ?? record.source_filename ?? record.local_path) ||
    path.basename(inputPath)
  metadata.source_url = cleanText(record.source_url) || null
  return metadata
}

async function embedDocument(text: string, title: string) {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) throw new Error('GEMINI_API_KEY is required')

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        content: { parts: [{ text }] },
        task_type: 'RETRIEVAL_DOCUMENT',
        title: title.slice(0, 500),
        output_dimensionality: EMBEDDING_DIMENSIONS,
      }),
      signal: AbortSignal.timeout(20_000),
    }
  )
  const payload = (await response.json()) as {
    embedding?: { values?: number[] }
    error?: { message?: string }
  }
  if (!response.ok) {
    throw new Error(
      `Embedding failed (${response.status}): ${payload.error?.message || 'unknown error'}`
    )
  }
  const values = payload.embedding?.values
  if (!Array.isArray(values) || values.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Expected ${EMBEDDING_DIMENSIONS} embedding values`)
  }
  return values
}

async function main() {
  const inputPath = path.resolve(
    arg('--input', 'data/cleaned_chunks.jsonl') as string
  )
  const limit = Number(arg('--limit', '0'))
  const batchSize = Math.max(1, Number(arg('--batch-size', '25')))
  const records = await loadRecords(inputPath)
  const selected =
    Number.isFinite(limit) && limit > 0 ? records.slice(0, limit) : records

  console.log(
    JSON.stringify(
      {
        input: inputPath,
        records: selected.length,
        model: EMBEDDING_MODEL,
        dimensions: EMBEDDING_DIMENSIONS,
        targetChunkTokensApprox: TARGET_CHARS / 4,
        overlapPercent: 20,
        dryRun: hasFlag('--dry-run'),
      },
      null,
      2
    )
  )

  if (hasFlag('--dry-run')) return

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for ingestion'
    )
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const prepared: PreparedChunk[] = []
  for (let recordIndex = 0; recordIndex < selected.length; recordIndex += 1) {
    const record = selected[recordIndex]
    const metadata = metadataFor(record, inputPath)
    const sourceTitle =
      cleanText(record.title ?? record.source_title ?? metadata.source_file) ||
      `Past paper source ${recordIndex + 1}`
    const sourceUrl = cleanText(record.source_url) || null
    const sourceKind =
      cleanText(record.resource_type ?? record.paper_type) || 'past_paper'

    for (const [chunkIndex, content] of chunkText(sourceText(record)).entries()) {
      const contentHash = hash(
        `${sourceUrl ?? metadata.source_file}:${chunkIndex}:${content}`
      )
      const embedding = await embedDocument(content, sourceTitle)
      prepared.push({
        id: contentHash,
        content,
        metadata: { ...metadata, chunk_index: chunkIndex },
        tier: 'past_paper',
        retrieval_priority: sourceKind.includes('mark') ? 90 : 60,
        source_url: sourceUrl,
        source_title: sourceTitle,
        source_domain: safeDomain(sourceUrl),
        source_kind: sourceKind,
        source_quality: record.answer_ready ? 'answer_ready' : 'extracted',
        last_checked: new Date().toISOString().slice(0, 10),
        embedding,
        embedding_model: EMBEDDING_MODEL,
        embedding_dimensions: EMBEDDING_DIMENSIONS,
        content_hash: contentHash,
      })
    }

    if ((recordIndex + 1) % 10 === 0 || recordIndex + 1 === selected.length) {
      console.log(`Embedded ${recordIndex + 1}/${selected.length} records`)
    }
  }

  for (let index = 0; index < prepared.length; index += batchSize) {
    const batch = prepared.slice(index, index + batchSize)
    const { error } = await supabase
      .from('rag_documents')
      .upsert(batch, { onConflict: 'id' })
    if (error) throw error
    console.log(`Uploaded ${Math.min(index + batch.length, prepared.length)}/${prepared.length} chunks`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
