import { spawn } from 'node:child_process'
import path from 'node:path'

export type QueryEmbeddingResult = {
  dimensions: number
  provider: 'minilm-api' | 'local-python' | 'gemini'
  vector: number[]
}

const EMBEDDING_DIMENSIONS = 384
const DEFAULT_GEMINI_EMBEDDING_MODEL = 'gemini-embedding-001'

function normalizeVector(vector: number[]) {
  const magnitude = Math.sqrt(vector.reduce((total, value) => total + value * value, 0))
  return magnitude > 0 ? vector.map((value) => value / magnitude) : vector
}

function assertEmbedding(vector: unknown): number[] {
  if (!Array.isArray(vector) || !vector.every((value) => typeof value === 'number')) {
    throw new Error('Embedding provider returned an invalid vector.')
  }
  if (vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding provider returned ${vector.length} dimensions; expected ${EMBEDDING_DIMENSIONS}.`
    )
  }
  return normalizeVector(vector)
}

async function embedWithMiniLmApi(text: string): Promise<QueryEmbeddingResult | null> {
  const url = process.env.MINILM_EMBEDDING_API_URL?.trim()
  if (!url) return null

  const response = await fetch(url, {
    body: JSON.stringify({ text }),
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.MINILM_EMBEDDING_API_KEY
        ? { Authorization: `Bearer ${process.env.MINILM_EMBEDDING_API_KEY}` }
        : {}),
    },
    method: 'POST',
  })
  const payload = (await response.json()) as { embedding?: unknown; vector?: unknown; error?: string }
  if (!response.ok) throw new Error(payload.error || `MiniLM embedding API failed: ${response.status}`)

  return {
    dimensions: EMBEDDING_DIMENSIONS,
    provider: 'minilm-api',
    vector: assertEmbedding(payload.embedding ?? payload.vector),
  }
}

function runPythonEmbedder(text: string): Promise<QueryEmbeddingResult> {
  const python = process.env.LOCAL_EMBEDDING_PYTHON_BIN?.trim() || 'python'
  const script =
    process.env.LOCAL_EMBEDDING_SCRIPT?.trim() ||
    path.join(process.cwd(), 'scripts', 'embed-query.py')

  return new Promise((resolve, reject) => {
    const child = spawn(python, [script], {
      cwd: process.cwd(),
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })
    let stdout = ''
    let stderr = ''

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `Local embedding script exited with code ${code}.`))
        return
      }
      try {
        const parsed = JSON.parse(stdout) as { embedding?: unknown }
        resolve({
          dimensions: EMBEDDING_DIMENSIONS,
          provider: 'local-python',
          vector: assertEmbedding(parsed.embedding),
        })
      } catch (error) {
        reject(error)
      }
    })
    child.stdin.end(text)
  })
}

async function embedWithLocalPython(text: string): Promise<QueryEmbeddingResult | null> {
  if (process.env.LOCAL_EMBEDDING_ENABLED !== 'true') return null
  if (process.env.VERCEL === '1' && process.env.ALLOW_PYTHON_ON_VERCEL !== 'true') return null
  return runPythonEmbedder(text)
}

function geminiEmbeddingValues(payload: unknown) {
  const direct = (payload as { embedding?: { values?: unknown } })?.embedding?.values
  if (Array.isArray(direct)) return direct

  const first = (payload as { embeddings?: Array<{ values?: unknown }> })?.embeddings?.[0]?.values
  return first
}

async function embedWithGemini(text: string): Promise<QueryEmbeddingResult | null> {
  const key = process.env.GEMINI_API_KEY?.trim()
  if (!key) return null
  const model = process.env.GEMINI_EMBEDDING_MODEL?.trim() || DEFAULT_GEMINI_EMBEDDING_MODEL
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent`,
    {
      body: JSON.stringify({
        content: { parts: [{ text }] },
        output_dimensionality: EMBEDDING_DIMENSIONS,
      }),
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key,
      },
      method: 'POST',
    }
  )
  const payload = await response.json()
  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload && 'error' in payload
        ? JSON.stringify((payload as { error?: unknown }).error)
        : `Gemini embedding failed: ${response.status}`
    throw new Error(message)
  }

  return {
    dimensions: EMBEDDING_DIMENSIONS,
    provider: 'gemini',
    vector: assertEmbedding(geminiEmbeddingValues(payload)),
  }
}

export async function createQueryEmbedding(text: string): Promise<QueryEmbeddingResult> {
  const input = text.replace(/\s+/g, ' ').trim()
  if (!input) throw new Error('Cannot embed empty text.')

  const failures: string[] = []
  for (const embedder of [embedWithMiniLmApi, embedWithLocalPython, embedWithGemini]) {
    try {
      const result = await embedder(input.slice(0, 8_000))
      if (result) return result
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error))
      console.error('query_embedding_failed', {
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  throw new Error(
    `No embedding provider worked. Configure MINILM_EMBEDDING_API_URL for exact MiniLM retrieval, or GEMINI_API_KEY for the deployable fallback. ${failures.join(' | ')}`
  )
}

export function getEmbeddingDimensions() {
  return EMBEDDING_DIMENSIONS
}
