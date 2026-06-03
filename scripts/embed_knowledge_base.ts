import { createClient } from '@supabase/supabase-js'
import { jsonlPath, readJsonl, writeJsonl } from './dataset_common'
import { logImport, normalizeText } from './knowledge_import_common'

const FILES = [
  ['formula_bank', 'processed/formula_bank.jsonl', (row: Record<string, unknown>) => `${row.subject} ${row.topic} ${row.formula} ${row.meaning}`],
  ['theory_bank', 'processed/theory_bank.jsonl', (row: Record<string, unknown>) => `${row.subject} ${row.topic} ${row.short_explanation} ${row.detailed_explanation}`],
  ['syllabus_topics', 'processed/syllabus_topics.jsonl', (row: Record<string, unknown>) => `${row.subject} ${row.topic} ${row.learning_objectives}`],
  ['misconception_bank', 'processed/misconceptions.jsonl', (row: Record<string, unknown>) => `${row.subject} ${row.topic} ${row.misconception} ${row.correction}`],
  ['public_education_chunks', 'processed/public_education_chunks.jsonl', (row: Record<string, unknown>) => `${row.subject} ${row.topic} ${row.content}`],
] as const

async function embed(text: string) {
  const token = process.env.HUGGINGFACE_API_KEY
  if (!token) return null
  const response = await fetch('https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputs: text }),
  })
  if (!response.ok) throw new Error(`HuggingFace embedding failed: ${response.status}`)
  const json = await response.json()
  const vector = Array.isArray(json?.[0]) ? json[0] : json
  return Array.isArray(vector) ? vector.map(Number) : null
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabase = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null
  let read = 0
  let embedded = 0
  const failures: string[] = []

  for (const [table, file, textOf] of FILES) {
    const rows = readJsonl<Record<string, unknown>>(jsonlPath(file))
    read += rows.length
    const output = []
    for (const row of rows) {
      try {
        const vector = await embed(normalizeText(textOf(row)))
        output.push({ ...row, embedding: vector })
        if (vector) embedded += 1
      } catch (error) {
        failures.push(`${table}: ${error instanceof Error ? error.message : 'embedding failed'}`)
        output.push(row)
      }
    }
    writeJsonl(jsonlPath(`embeddings/${table}.jsonl`), output)
    if (supabase && output.length) await supabase.from(table).upsert(output)
  }

  logImport({
    script: 'embed_knowledge_base',
    input: 'dataset/processed/*.jsonl',
    output: 'dataset/embeddings/*.jsonl',
    read,
    accepted: embedded,
    rejected: read - embedded,
    inserted: embedded,
    failures: failures.length,
    notes: failures.length ? failures : ['No embedding failures. If HUGGINGFACE_API_KEY is absent, embeddings remain null.'],
  })
}

main().catch((error) => { console.error(error); process.exit(1) })
