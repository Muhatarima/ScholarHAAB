import { createClient } from '@supabase/supabase-js'
import crypto from 'node:crypto'
import { ensureDatasetDirs, jsonlPath, readJsonl, writeJsonl } from './dataset_common'

type TaggedQuestion = {
  text: string
  board: string
  level: string
  subject: string
  topic?: string | null
  chapter?: string | null
  year: number | null
  paper_code: string
  paper_type: string
  question_number: string | null
  marks: number | null
  checksum: string | null
  source_file_path: string
  source_url: string
}

type Chunk = TaggedQuestion & {
  chunk_id: string
  chunk_text: string
  embedding: number[] | null
  embedding_status: 'embedded' | 'skipped_no_key' | 'failed'
  error?: string
}

function chunkText(text: string, maxLength = 1200) {
  const chunks: string[] = []
  let rest = text.trim()
  while (rest.length > maxLength) {
    const cut = Math.max(rest.lastIndexOf('\n', maxLength), rest.lastIndexOf(' ', maxLength))
    chunks.push(rest.slice(0, cut > 200 ? cut : maxLength).trim())
    rest = rest.slice(cut > 200 ? cut : maxLength).trim()
  }
  if (rest) chunks.push(rest)
  return chunks
}

async function embedText(text: string): Promise<number[]> {
  const apiKey = process.env.HUGGINGFACE_API_KEY?.trim()
  if (!apiKey) throw new Error('HUGGINGFACE_API_KEY missing')

  const response = await fetch(
    'https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ inputs: text.slice(0, 8000), options: { wait_for_model: true } }),
      signal: AbortSignal.timeout(12000),
    }
  )
  const data = await response.json()
  if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : `HTTP ${response.status}`)
  if (Array.isArray(data) && Array.isArray(data[0])) return data[0].map(Number)
  if (Array.isArray(data)) return data.map(Number)
  throw new Error('Unexpected embedding shape')
}

async function uploadChunks(chunks: Chunk[]) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return { uploaded: 0, skipped: chunks.length, reason: 'Supabase service credentials missing' }

  const supabase = createClient(url, key, { auth: { persistSession: false } })
  const rows = chunks
    .filter((chunk) => chunk.embedding)
    .map((chunk) => ({
      question_id: null,
      content: chunk.chunk_text,
      embedding: chunk.embedding,
      metadata: {
        board: chunk.board,
        level: chunk.level,
        subject: chunk.subject,
        topic: chunk.topic,
        chapter: chunk.chapter,
        year: chunk.year,
        paper_code: chunk.paper_code,
        paper_type: chunk.paper_type,
        question_number: chunk.question_number,
        marks: chunk.marks,
        source_file_path: chunk.source_file_path,
        source_url: chunk.source_url,
        checksum: chunk.checksum,
      },
      checksum: crypto.createHash('sha256').update(chunk.chunk_text).digest('hex'),
    }))

  if (!rows.length) return { uploaded: 0, skipped: chunks.length, reason: 'No embedded rows' }
  const { error } = await supabase.from('question_chunks').upsert(rows, { onConflict: 'checksum' })
  if (error) throw error
  return { uploaded: rows.length, skipped: chunks.length - rows.length, reason: null }
}

async function main() {
  ensureDatasetDirs()
  const questions = readJsonl<TaggedQuestion>(jsonlPath('processed/tagged_questions.jsonl'))
  const chunks: Chunk[] = []

  for (const question of questions) {
    const parts = chunkText(question.text)
    for (let index = 0; index < parts.length; index += 1) {
      const chunkTextValue = parts[index]
      const chunk_id = crypto
        .createHash('sha256')
        .update(`${question.checksum ?? question.source_file_path}:${question.question_number}:${index}:${chunkTextValue}`)
        .digest('hex')
      try {
        const embedding = process.env.HUGGINGFACE_API_KEY ? await embedText(chunkTextValue) : null
        chunks.push({
          ...question,
          chunk_id,
          chunk_text: chunkTextValue,
          embedding,
          embedding_status: embedding ? 'embedded' : 'skipped_no_key',
        })
      } catch (error) {
        chunks.push({
          ...question,
          chunk_id,
          chunk_text: chunkTextValue,
          embedding: null,
          embedding_status: 'failed',
          error: error instanceof Error ? error.message : 'Embedding failed',
        })
      }
    }
  }

  writeJsonl(jsonlPath('chunks/question_chunks.jsonl'), chunks)
  const upload = await uploadChunks(chunks)
  console.log(JSON.stringify({
    chunks: chunks.length,
    embedded: chunks.filter((chunk) => chunk.embedding_status === 'embedded').length,
    failed: chunks.filter((chunk) => chunk.embedding_status === 'failed').length,
    upload,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
