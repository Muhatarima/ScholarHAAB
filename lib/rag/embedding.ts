const DEFAULT_EMBEDDING_MODEL = 'gemini-embedding-001'
const DEFAULT_EMBEDDING_DIMENSIONS = 768
const DEFAULT_EMBEDDING_TIMEOUT_MS = 15_000

export type EmbeddingTask = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY'

function getGeminiApiKey() {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY for RAG embeddings')
  }
  return apiKey
}

export function getEmbeddingModel() {
  return process.env.GEMINI_EMBEDDING_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL
}

export function getEmbeddingDimensions() {
  const configured = Number(process.env.GEMINI_EMBEDDING_DIMENSIONS)
  return Number.isInteger(configured) && configured >= 128 && configured <= 3072
    ? configured
    : DEFAULT_EMBEDDING_DIMENSIONS
}

export async function createGeminiEmbedding(
  text: string,
  task: EmbeddingTask,
  title?: string
) {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) {
    throw new Error('Cannot embed empty text')
  }

  const model = getEmbeddingModel()
  const dimensions = getEmbeddingDimensions()
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': getGeminiApiKey(),
      },
      body: JSON.stringify({
        content: {
          parts: [{ text: normalized.slice(0, 16_000) }],
        },
        task_type: task,
        title: task === 'RETRIEVAL_DOCUMENT' && title ? title.slice(0, 500) : undefined,
        output_dimensionality: dimensions,
      }),
      signal: AbortSignal.timeout(
        Number(process.env.RAG_EMBEDDING_TIMEOUT_MS) || DEFAULT_EMBEDDING_TIMEOUT_MS
      ),
    }
  )

  const payload = (await response.json()) as {
    embedding?: { values?: number[] }
    error?: { message?: string }
  }

  if (!response.ok) {
    throw new Error(
      `Gemini embedding failed (${response.status}): ${
        payload.error?.message || 'unknown provider error'
      }`
    )
  }

  const vector = payload.embedding?.values
  if (!Array.isArray(vector) || vector.length !== dimensions) {
    throw new Error(
      `Gemini embedding returned ${vector?.length ?? 0} dimensions; expected ${dimensions}`
    )
  }

  return vector.map(Number)
}
