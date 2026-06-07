import { InferenceClient } from '@huggingface/inference'

const DEFAULT_EMBEDDING_MODEL = 'sentence-transformers/all-MiniLM-L6-v2'
const DEFAULT_GENERATION_MODELS = [
  'mistralai/Mistral-7B-Instruct-v0.3',
  'Qwen/Qwen2.5-7B-Instruct-1M',
]
const DEFAULT_OCR_MODEL = 'microsoft/trocr-large-printed'
const DEFAULT_VISION_MODEL = 'Qwen/Qwen2.5-VL-7B-Instruct'
const EMBEDDING_DIMENSIONS = 384

let client: InferenceClient | null = null

function getApiKey() {
  const key =
    process.env.HUGGINGFACE_API_KEY?.trim() || process.env.HF_TOKEN?.trim()
  if (!key) {
    throw new Error(
      'Missing HUGGINGFACE_API_KEY. Add a Hugging Face token with inference permission.'
    )
  }
  return key
}

function getClient() {
  if (!client) client = new InferenceClient(getApiKey())
  return client
}

function timeoutSignal(timeoutMs: number) {
  return AbortSignal.timeout(timeoutMs)
}

function meanPool(vectors: number[][]) {
  if (!vectors.length) return []
  const dimensions = vectors[0]?.length ?? 0
  if (!dimensions) return []
  const pooled = Array.from({ length: dimensions }, () => 0)
  for (const vector of vectors) {
    for (let index = 0; index < dimensions; index += 1) {
      pooled[index] += Number(vector[index] ?? 0)
    }
  }
  return pooled.map((value) => value / vectors.length)
}

function normalizeVector(output: unknown): number[] {
  if (
    Array.isArray(output) &&
    output.length > 0 &&
    output.every((value) => typeof value === 'number')
  ) {
    return output.map(Number)
  }

  if (
    Array.isArray(output) &&
    output.length === 1 &&
    Array.isArray(output[0])
  ) {
    return normalizeVector(output[0])
  }

  if (
    Array.isArray(output) &&
    output.length > 0 &&
    output.every(
      (value) =>
        Array.isArray(value) &&
        value.every((entry) => typeof entry === 'number')
    )
  ) {
    return meanPool(output as number[][])
  }

  throw new Error('Hugging Face returned an unexpected embedding shape')
}

function l2Normalize(vector: number[]) {
  const magnitude = Math.sqrt(
    vector.reduce((total, value) => total + value * value, 0)
  )
  return magnitude > 0 ? vector.map((value) => value / magnitude) : vector
}

export function getEmbeddingModel() {
  return process.env.HF_EMBEDDING_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL
}

export function getEmbeddingDimensions() {
  return EMBEDDING_DIMENSIONS
}

export async function createHuggingFaceEmbedding(text: string) {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) throw new Error('Cannot embed empty text')

  const endpointUrl = process.env.HF_EMBEDDING_ENDPOINT?.trim()
  const output = await getClient().featureExtraction(
    {
      inputs: normalized.slice(0, 8_000),
      model: endpointUrl ? undefined : getEmbeddingModel(),
      endpointUrl,
      provider: endpointUrl ? undefined : 'hf-inference',
      normalize: true,
      truncate: true,
    },
    {
      retry_on_error: true,
      signal: timeoutSignal(
        Number(process.env.HF_EMBEDDING_TIMEOUT_MS) || 25_000
      ),
    }
  )

  const vector = l2Normalize(normalizeVector(output))
  if (vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding model returned ${vector.length} dimensions; expected ${EMBEDDING_DIMENSIONS}`
    )
  }
  return vector
}

function generationModels() {
  const configured = [
    process.env.HF_GENERATION_MODEL,
    process.env.HF_GENERATION_FALLBACK_MODEL,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
  return Array.from(new Set([...configured, ...DEFAULT_GENERATION_MODELS]))
}

export async function generateHuggingFaceText(input: {
  system: string
  prompt: string
  maxTokens?: number
  json?: boolean
}) {
  const failures: string[] = []

  for (const model of generationModels()) {
    try {
      const response = await getClient().chatCompletion(
        {
          model,
          provider: 'auto',
          messages: [
            { role: 'system', content: input.system },
            { role: 'user', content: input.prompt },
          ],
          max_tokens: input.maxTokens ?? 1_400,
          temperature: 0.15,
          response_format: input.json ? { type: 'json_object' } : undefined,
        },
        {
          retry_on_error: true,
          signal: timeoutSignal(
            Number(process.env.HF_GENERATION_TIMEOUT_MS) || 45_000
          ),
        }
      )
      const text = response.choices[0]?.message?.content?.trim()
      if (text) return { text, model }
      failures.push(`${model}: empty response`)
    } catch (error) {
      failures.push(
        `${model}: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  throw new Error(`All Hugging Face generation models failed. ${failures.join(' | ')}`)
}

function parseJson<T>(text: string): T {
  const normalized = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
  try {
    return JSON.parse(normalized) as T
  } catch {
    const objectStart = normalized.indexOf('{')
    const objectEnd = normalized.lastIndexOf('}')
    if (objectStart >= 0 && objectEnd > objectStart) {
      return JSON.parse(normalized.slice(objectStart, objectEnd + 1)) as T
    }
    throw new Error('Hugging Face returned invalid JSON')
  }
}

export async function generateHuggingFaceJson<T>(input: {
  system: string
  prompt: string
  maxTokens?: number
}) {
  const result = await generateHuggingFaceText({ ...input, json: true })
  return { data: parseJson<T>(result.text), model: result.model }
}

async function runTrOcr(image: Buffer, mimeType: string) {
  const endpointUrl = process.env.HF_OCR_ENDPOINT?.trim()
  const imageBytes = Uint8Array.from(image).buffer
  const response = await getClient().imageToText(
    {
      inputs: new Blob([imageBytes], { type: mimeType }),
      model: endpointUrl
        ? undefined
        : process.env.HF_OCR_MODEL?.trim() || DEFAULT_OCR_MODEL,
      endpointUrl,
      provider: endpointUrl ? undefined : 'hf-inference',
      parameters: { max_new_tokens: 1_024 },
    },
    {
      retry_on_error: true,
      signal: timeoutSignal(Number(process.env.HF_OCR_TIMEOUT_MS) || 45_000),
    }
  )
  const text =
    typeof response.generated_text === 'string'
      ? response.generated_text.trim()
      : typeof response.generatedText === 'string'
        ? response.generatedText.trim()
        : ''
  if (!text) throw new Error('TrOCR returned no readable text')
  return { text, model: endpointUrl || DEFAULT_OCR_MODEL }
}

async function runVisionOcr(image: Buffer, mimeType: string) {
  const model =
    process.env.HF_VISION_MODEL?.trim() || DEFAULT_VISION_MODEL
  const dataUrl = `data:${mimeType};base64,${image.toString('base64')}`
  const response = await getClient().chatCompletion(
    {
      model,
      provider: 'auto',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: [
                'Transcribe every visible academic question exactly.',
                'Preserve numbers, formulas, units, labels, answer options, and diagram labels.',
                'Do not solve or summarize. Return only the transcription.',
              ].join(' '),
            },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      max_tokens: 1_500,
      temperature: 0,
    },
    {
      retry_on_error: true,
      signal: timeoutSignal(Number(process.env.HF_OCR_TIMEOUT_MS) || 45_000),
    }
  )
  const text = response.choices[0]?.message?.content?.trim()
  if (!text) throw new Error('Hugging Face vision model returned no text')
  return { text, model }
}

export async function extractTextWithHuggingFaceOcr(
  image: Buffer,
  mimeType: string
) {
  try {
    return await runTrOcr(image, mimeType)
  } catch (trocrError) {
    try {
      return await runVisionOcr(image, mimeType)
    } catch (visionError) {
      throw new Error(
        `Hugging Face OCR failed. TrOCR: ${
          trocrError instanceof Error ? trocrError.message : String(trocrError)
        }. Vision fallback: ${
          visionError instanceof Error ? visionError.message : String(visionError)
        }`
      )
    }
  }
}
