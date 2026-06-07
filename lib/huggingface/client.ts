const DEFAULT_EMBEDDING_MODEL = 'sentence-transformers/all-MiniLM-L6-v2'
const DEFAULT_GENERATION_MODELS = ['google/flan-t5-large', 'microsoft/phi-2']
const DEFAULT_OCR_MODEL = 'microsoft/trocr-large-printed'
const EMBEDDING_DIMENSIONS = 384
const DEFAULT_HF_INFERENCE_BASE_URL = 'https://router.huggingface.co/hf-inference/models'

type GenerateTextInput = {
  fallbackText?: string
  json?: boolean
  maxTokens?: number
  prompt: string
  system?: string
}

type GenerateJsonInput<T> = GenerateTextInput & {
  fallbackData?: T
}

type TextResult = {
  errors: string[]
  fromFallback: boolean
  model: string
  text: string
}

function getApiKey() {
  const key = process.env.HUGGINGFACE_API_KEY?.trim() || process.env.HF_TOKEN?.trim()
  if (!key) {
    throw new Error('Missing HUGGINGFACE_API_KEY.')
  }
  return key
}

export function getEmbeddingModel() {
  return process.env.HF_EMBEDDING_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL
}

export function getEmbeddingDimensions() {
  return EMBEDDING_DIMENSIONS
}

function generationModels() {
  const configured = [
    process.env.HF_GENERATION_MODELS,
    process.env.HF_GENERATION_MODEL,
    process.env.HF_GENERATION_FALLBACK_MODEL,
  ]
    .flatMap((value) => value?.split(',') ?? [])
    .map((value) => value.trim())
    .filter(Boolean)

  const models = configured.length ? configured : DEFAULT_GENERATION_MODELS
  return Array.from(new Set(models))
}

function getHfInferenceBaseUrl() {
  return (process.env.HF_INFERENCE_BASE_URL?.trim() || DEFAULT_HF_INFERENCE_BASE_URL).replace(
    /\/+$/,
    ''
  )
}

function getModelEndpoint(model: string, pipelineTask?: string) {
  const encodedModel = model
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')
  const suffix = pipelineTask ? `/pipeline/${encodeURIComponent(pipelineTask)}` : ''
  return `${getHfInferenceBaseUrl()}/${encodedModel}${suffix}`
}

function demoFallbackEnabled() {
  return process.env.HF_ENABLE_DEMO_FALLBACK !== 'false'
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryableStatus(status: number) {
  return [408, 409, 425, 429, 500, 502, 503, 504].includes(status)
}

function compactPrompt(input: GenerateTextInput) {
  const system = input.system?.trim()
  const prompt = input.prompt.trim()
  return [
    system ? `Instruction:\n${system}` : '',
    `Task:\n${prompt}`,
    input.json
      ? 'Return only valid JSON. Do not wrap it in markdown.'
      : 'Answer clearly and step by step.',
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 12_000)
}

function parseJson(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1))
    }
    throw new Error('The model did not return valid JSON.')
  }
}

function flattenNumbers(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null
  if (value.every((entry) => typeof entry === 'number')) {
    return value.map(Number)
  }
  const nested = value
    .map((entry) => flattenNumbers(entry))
    .filter((entry): entry is number[] => Array.isArray(entry) && entry.length > 0)
  if (!nested.length) return null
  const dimensions = nested[0].length
  const pooled = Array.from({ length: dimensions }, () => 0)
  for (const vector of nested) {
    for (let index = 0; index < dimensions; index += 1) {
      pooled[index] += Number(vector[index] ?? 0)
    }
  }
  return pooled.map((value) => value / nested.length)
}

function normalizeVector(vector: number[]) {
  const magnitude = Math.sqrt(vector.reduce((total, value) => total + value * value, 0))
  return magnitude > 0 ? vector.map((value) => value / magnitude) : vector
}

function extractGeneratedText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) {
    return value.map(extractGeneratedText).find(Boolean) ?? ''
  }
  if (!value || typeof value !== 'object') return ''
  const object = value as Record<string, unknown>
  for (const key of ['generated_text', 'generatedText', 'summary_text', 'translation_text']) {
    if (typeof object[key] === 'string' && object[key].trim()) {
      return object[key].trim()
    }
  }
  return ''
}

async function requestHfJson(
  model: string,
  payload: unknown,
  timeoutMs: number,
  contentType = 'application/json',
  pipelineTask?: string
) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(
      getModelEndpoint(model, pipelineTask),
      {
        body: contentType === 'application/json' ? JSON.stringify(payload) : (payload as BodyInit),
        headers: {
          Authorization: `Bearer ${getApiKey()}`,
          'Content-Type': contentType,
        },
        method: 'POST',
        signal: controller.signal,
      }
    )
    const text = await response.text()
    let data: unknown = text
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text
    }

    if (!response.ok) {
      const message =
        typeof data === 'object' && data && 'error' in data
          ? String((data as { error?: unknown }).error)
          : text || response.statusText
      const error = new Error(message) as Error & {
        retryable?: boolean
        status?: number
      }
      error.status = response.status
      error.retryable = isRetryableStatus(response.status)
      throw error
    }

    if (data && typeof data === 'object' && 'error' in data) {
      throw new Error(String((data as { error?: unknown }).error))
    }

    return data
  } finally {
    clearTimeout(timeout)
  }
}

async function withBackoff<T>(
  label: string,
  operation: () => Promise<T>,
  attempts = Number(process.env.HF_RETRY_ATTEMPTS || 3)
) {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      const retryable = (error as { retryable?: boolean })?.retryable !== false
      console.warn('huggingface_request_failed', {
        attempt,
        label,
        message: error instanceof Error ? error.message : String(error),
      })
      if (!retryable || attempt === attempts) break
      await sleep(Math.min(8_000, 600 * 2 ** (attempt - 1)))
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

export async function createHuggingFaceEmbedding(text: string) {
  const input = text.replace(/\s+/g, ' ').trim()
  if (!input) throw new Error('Cannot embed empty text.')

  const data = await withBackoff('embedding', () =>
    requestHfJson(
      getEmbeddingModel(),
      {
        inputs: input.slice(0, 8_000),
        options: { wait_for_model: true, use_cache: true },
      },
      Number(process.env.HF_EMBEDDING_TIMEOUT_MS || 30_000),
      'application/json',
      'feature-extraction'
    )
  )

  const vector = flattenNumbers(data)
  if (!vector?.length) {
    throw new Error('Hugging Face returned an empty embedding.')
  }
  const normalized = normalizeVector(vector)
  if (normalized.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding model returned ${normalized.length} dimensions; expected ${EMBEDDING_DIMENSIONS}.`
    )
  }
  return normalized
}

function localFallbackText(input: GenerateTextInput, errors: string[]) {
  if (input.fallbackText?.trim()) return input.fallbackText.trim()
  return [
    'The AI model is temporarily busy. Please try again later.',
    '',
    'What I can confirm right now:',
    '- Your request reached the server successfully.',
    '- Retrieval and source matching were attempted before generation.',
    '- No UNSUPPORTED fallback was used.',
    errors.length ? `Diagnostic: ${errors[0]}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export async function generateHuggingFaceText(
  input: GenerateTextInput
): Promise<TextResult> {
  const prompt = compactPrompt(input)
  const errors: string[] = []

  for (const model of generationModels()) {
    try {
      const data = await withBackoff(`generation:${model}`, () =>
        requestHfJson(
          model,
          {
            inputs: prompt,
            options: { wait_for_model: true, use_cache: true },
            parameters: {
              do_sample: false,
              max_new_tokens: input.maxTokens ?? 700,
              return_full_text: false,
              temperature: 0.2,
            },
          },
          Number(process.env.HF_GENERATION_TIMEOUT_MS || 45_000)
        )
      )
      const text = extractGeneratedText(data)
      if (text) return { errors, fromFallback: false, model, text }
      errors.push(`${model}: empty response`)
    } catch (error) {
      errors.push(`${model}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  console.error('huggingface_generation_unavailable', { errors })
  if (!demoFallbackEnabled()) {
    throw new Error('Hugging Face is temporarily unavailable. Please try again later.')
  }
  return {
    errors,
    fromFallback: true,
    model: 'local-demo-fallback',
    text: localFallbackText(input, errors),
  }
}

export async function generateHuggingFaceJson<T>(input: GenerateJsonInput<T>) {
  const fallbackText =
    input.fallbackData === undefined ? input.fallbackText : JSON.stringify(input.fallbackData)
  const result = await generateHuggingFaceText({
    ...input,
    fallbackText,
    json: true,
  })

  try {
    return { data: parseJson(result.text) as T, model: result.model, fromFallback: result.fromFallback }
  } catch (error) {
    if (input.fallbackData !== undefined) {
      return { data: input.fallbackData, model: 'local-demo-fallback', fromFallback: true }
    }
    throw error
  }
}

export async function extractTextWithHuggingFaceOcr(image: Buffer, mimeType: string) {
  const model = process.env.HF_OCR_MODEL?.trim() || DEFAULT_OCR_MODEL
  try {
    const data = await withBackoff('ocr', () =>
      requestHfJson(
        model,
        image,
        Number(process.env.HF_OCR_TIMEOUT_MS || 45_000),
        mimeType || 'application/octet-stream'
      )
    )
    const text = extractGeneratedText(data)
    if (text) return { model, text }
    throw new Error('OCR returned no readable text.')
  } catch (error) {
    console.error('huggingface_ocr_failed', {
      message: error instanceof Error ? error.message : String(error),
    })
    throw new Error('Could not read that image clearly. Please upload a sharper image or type the question.')
  }
}
