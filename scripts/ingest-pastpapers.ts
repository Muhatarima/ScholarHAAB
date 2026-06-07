import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { PDFParse } from 'pdf-parse'
import {
  createQueryEmbedding,
  getEmbeddingDimensions,
} from '../lib/embeddings/client'

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const separator = line.indexOf('=')
    if (separator < 0) continue
    const key = line.slice(0, separator).trim()
    const value = line
      .slice(separator + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '')
    if (!(key in process.env)) process.env[key] = value
  }
}

loadLocalEnv()

type SourceRecord = Record<string, unknown>

type DocumentChunk = {
  content: string
  metadata: Record<string, unknown>
  sourceTitle: string
  sourceUrl: string | null
  sourceKind: string
}

const EMBEDDING_MODEL =
  process.env.LOCAL_EMBEDDING_MODEL?.trim() ||
  process.env.GEMINI_EMBEDDING_MODEL?.trim() ||
  'all-MiniLM-L6-v2'
const EMBEDDING_DIMENSIONS = getEmbeddingDimensions()
const CHUNK_TOKENS = 512
const OVERLAP_TOKENS = 50
const SUPPORTED_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.pdf',
  '.json',
  '.jsonl',
])

function argument(name: string, fallback?: string) {
  const index = process.argv.indexOf(name)
  return index >= 0 && process.argv[index + 1]
    ? process.argv[index + 1]
    : fallback
}

function hasFlag(name: string) {
  return process.argv.includes(name)
}

function cleanText(value: unknown) {
  return typeof value === 'string'
    ? value
        .replace(/\u0000/g, '')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    : ''
}

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function chunkText(text: string) {
  const tokens = cleanText(text).split(/\s+/).filter(Boolean)
  if (!tokens.length) return []
  const chunks: string[] = []
  const step = CHUNK_TOKENS - OVERLAP_TOKENS
  for (let start = 0; start < tokens.length; start += step) {
    const chunk = tokens.slice(start, start + CHUNK_TOKENS).join(' ').trim()
    if (chunk) chunks.push(chunk)
    if (start + CHUNK_TOKENS >= tokens.length) break
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

function humanizePathSegment(segment: string) {
  return segment
    .replace(/\.[^.]+$/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function inferPathMetadata(filePath: string) {
  const parts = path
    .normalize(filePath)
    .split(path.sep)
    .map(humanizePathSegment)
    .filter(Boolean)
  const lowerParts = parts.map((part) => part.toLowerCase())
  const metadata: Record<string, unknown> = {}

  const subjectIndex = lowerParts.findIndex((part) =>
    /\b(physics|chemistry|math|maths|mathematics)\b/.test(part)
  )
  if (subjectIndex >= 0) {
    const lowerSubject = lowerParts[subjectIndex]
    metadata.subject = lowerSubject.includes('chem')
      ? 'Chemistry'
      : lowerSubject.includes('phys')
        ? 'Physics'
        : 'Math'
  }

  const board = lowerParts.find((part) =>
    /\b(cambridge|cie|edexcel|aqa|ocr|ib)\b/.test(part)
  )
  if (board) metadata.board = humanizePathSegment(board).toUpperCase()

  const level = lowerParts.find((part) =>
    /\b(a level|alevel|as level|igcse|gcse|o level|olevel)\b/.test(part)
  )
  if (level) metadata.level = humanizePathSegment(level)

  const yearPart = lowerParts.find((part) => /\b20\d{2}\b/.test(part))
  const year = yearPart?.match(/\b(20\d{2})\b/)?.[1]
  if (year) metadata.year = Number(year)

  const genericSegments = new Set([
    'data',
    'past papers',
    'past paper',
    'papers',
    'paper',
    'mark scheme',
    'mark schemes',
    'question paper',
    'question papers',
    'physics',
    'chemistry',
    'math',
    'maths',
    'mathematics',
    'cambridge',
    'cie',
    'edexcel',
    'aqa',
    'ocr',
    'ib',
  ])
  const topic = subjectIndex >= 0 ? parts.find((part, index) => {
    if (index <= subjectIndex) return false
    const lower = lowerParts[index]
    return (
      !genericSegments.has(lower) &&
      !/\b20\d{2}\b/.test(lower) &&
      !/\b(a level|alevel|as level|igcse|gcse|o level|olevel)\b/.test(lower)
    )
  }) : null
  if (topic) metadata.topic = topic

  return metadata
}

function listInputFiles(inputPath: string) {
  const stats = fs.statSync(inputPath)
  if (stats.isFile()) return [inputPath]
  const files: string[] = []
  const visit = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name)
      if (entry.isDirectory()) visit(target)
      else if (SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        files.push(target)
      }
    }
  }
  visit(inputPath)
  return files.sort()
}

async function loadFileRecords(filePath: string): Promise<SourceRecord[]> {
  const extension = path.extname(filePath).toLowerCase()
  if (extension === '.pdf') {
    const parser = new PDFParse({ data: fs.readFileSync(filePath) })
    try {
      const result = await parser.getText()
      return [{ content: result.text, source_file: path.basename(filePath) }]
    } finally {
      await parser.destroy()
    }
  }

  const raw = fs.readFileSync(filePath, 'utf8')
  if (extension === '.txt' || extension === '.md') {
    return [{ content: raw, source_file: path.basename(filePath) }]
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

function inferMetadata(record: SourceRecord, filePath: string) {
  const pathMetadata = inferPathMetadata(filePath)
  const keys = [
    'board',
    'level',
    'subject',
    'topic',
    'subtopic',
    'chapter',
    'year',
    'session',
    'paper',
    'paper_code',
    'question_number',
    'marks',
    'resource_type',
  ]
  const metadata = Object.fromEntries(
    keys
      .filter(
        (key) =>
          record[key] !== null &&
          record[key] !== undefined &&
          record[key] !== ''
      )
      .map((key) => [key, record[key]])
  )
  for (const [key, value] of Object.entries(pathMetadata)) {
    if (metadata[key] === null || metadata[key] === undefined || metadata[key] === '') {
      metadata[key] = value
    }
  }
  metadata.source_file =
    cleanText(record.source_file ?? record.source_filename ?? record.local_path) ||
    path.basename(filePath)
  return metadata
}

async function prepareChunks(inputPath: string) {
  const files = listInputFiles(inputPath)
  const chunks: DocumentChunk[] = []
  for (const filePath of files) {
    const records = await loadFileRecords(filePath)
    records.forEach((record, recordIndex) => {
      const metadata = inferMetadata(record, filePath)
      const sourceTitle =
        cleanText(record.source_title ?? record.title ?? metadata.source_file) ||
        path.basename(filePath)
      const sourceUrl = cleanText(record.source_url) || null
      const sourceKind =
        cleanText(record.resource_type ?? record.paper_type) || 'past_paper'
      chunkText(sourceText(record)).forEach((content, chunkIndex) => {
        chunks.push({
          content,
          metadata: { ...metadata, record_index: recordIndex, chunk_index: chunkIndex },
          sourceTitle,
          sourceUrl,
          sourceKind,
        })
      })
    })
  }
  return { files, chunks }
}

async function main() {
  const inputPath = path.resolve(
    argument('--input', 'data/past-papers') as string
  )
  const limit = Number(argument('--limit', '0'))
  const batchSize = Math.max(1, Number(argument('--batch-size', '16')))
  const prepared = await prepareChunks(inputPath)
  const chunks =
    Number.isFinite(limit) && limit > 0
      ? prepared.chunks.slice(0, limit)
      : prepared.chunks

  console.log(
    JSON.stringify(
      {
        input: inputPath,
        files: prepared.files.length,
        chunks: chunks.length,
        chunkTokens: CHUNK_TOKENS,
        overlapTokens: OVERLAP_TOKENS,
        embeddingModel: EMBEDDING_MODEL,
        embeddingDimensions: EMBEDDING_DIMENSIONS,
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
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required'
    )
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  for (let index = 0; index < chunks.length; index += batchSize) {
    const batch = chunks.slice(index, index + batchSize)
    const embeddings = await Promise.all(
      batch.map((chunk) => createQueryEmbedding(chunk.content))
    )

    const rows = batch.map((chunk, batchIndex) => {
      const embedding = embeddings[batchIndex]
      if (embedding.vector.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(
          `Expected ${EMBEDDING_DIMENSIONS} dimensions, received ${embedding.vector.length}`
        )
      }
      const contentHash = hash(
        `${chunk.metadata.source_file}:${chunk.metadata.record_index}:${chunk.metadata.chunk_index}:${chunk.content}`
      )
      return {
        content: chunk.content,
        embedding: embedding.vector,
        metadata: chunk.metadata,
        source_title: chunk.sourceTitle,
        source_url: chunk.sourceUrl,
        source_kind: chunk.sourceKind,
        embedding_model: `${embedding.provider}:${EMBEDDING_MODEL}`,
        content_hash: contentHash,
        updated_at: new Date().toISOString(),
      }
    })

    const { error } = await supabase
      .from('documents')
      .upsert(rows, { onConflict: 'content_hash' })
    if (error) throw error
    console.log(`Uploaded ${Math.min(index + batch.length, chunks.length)}/${chunks.length}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
