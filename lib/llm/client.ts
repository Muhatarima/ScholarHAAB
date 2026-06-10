type LlmProvider = 'groq' | 'gemini'

type GenerateTextInput = {
  json?: boolean
  maxTokens?: number
  prompt: string
  requestId?: string
  system?: string
  temperature?: number
}

export type LlmTextResult = {
  model: string
  provider: LlmProvider
  text: string
}

const DEFAULT_PROVIDER_ORDER: LlmProvider[] = ['gemini', 'groq']
const DEFAULT_GROQ_MODELS = ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile']
const DEFAULT_GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash-lite', 'gemini-2.0-flash']

function configuredProviderOrder() {
  const raw = process.env.LLM_PROVIDER_ORDER || process.env.AI_PROVIDER_ORDER
  const order = (raw ? raw.split(',') : DEFAULT_PROVIDER_ORDER)
    .map((provider) => provider.trim().toLowerCase())
    .filter((provider): provider is LlmProvider => provider === 'groq' || provider === 'gemini')

  return (order.length ? order : DEFAULT_PROVIDER_ORDER).filter((provider) => {
    if (provider === 'groq') return Boolean(process.env.GROQ_API_KEY?.trim())
    return Boolean(process.env.GEMINI_API_KEY?.trim())
  })
}

function geminiModels() {
  return Array.from(
    new Set(
      [
        process.env.GEMINI_MODEL,
        process.env.GEMINI_FALLBACK_MODEL,
        ...DEFAULT_GEMINI_MODELS,
      ]
        .flatMap((value) => value?.split(',') ?? [])
        .map((value) => value.trim())
        .filter(Boolean)
    )
  )
}

function groqModels() {
  return Array.from(
    new Set(
      [
        process.env.GROQ_MODEL,
        process.env.GROQ_FALLBACK_MODEL,
        ...DEFAULT_GROQ_MODELS,
      ]
        .flatMap((value) => value?.split(',') ?? [])
        .map((value) => value.trim())
        .filter(Boolean)
    )
  )
}

function timeoutMs() {
  const parsed = Number(process.env.LLM_TIMEOUT_MS || process.env.AI_PROVIDER_TIMEOUT_MS)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30_000
}

function maxTokens(input?: number) {
  const parsed = Number(input ?? process.env.LLM_MAX_TOKENS)
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.round(parsed), 8_192) : 1_200
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchJson(url: string, init: RequestInit, requestId?: string) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs())
  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    const text = await response.text()
    let payload: unknown = text
    try {
      payload = text ? JSON.parse(text) : null
    } catch {
      payload = text
    }

    if (!response.ok) {
      const message =
        typeof payload === 'object' && payload && 'error' in payload
          ? JSON.stringify((payload as { error?: unknown }).error)
          : text || response.statusText
      const error = new Error(message) as Error & { status?: number }
      error.status = response.status
      throw error
    }

    return payload
  } catch (error) {
    console.error('llm_fetch_failed', {
      message: error instanceof Error ? error.message : String(error),
      requestId,
    })
    throw error
  } finally {
    clearTimeout(timer)
  }
}

async function withRetry<T>(label: string, requestId: string | undefined, work: () => Promise<T>) {
  const attempts = Math.max(1, Number(process.env.LLM_RETRY_ATTEMPTS || 2))
  let lastError: unknown

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await work()
    } catch (error) {
      lastError = error
      const status = (error as { status?: number })?.status
      const retryable = !status || [408, 409, 425, 429, 500, 502, 503, 504].includes(status)
      console.error('llm_request_failed', {
        attempt,
        label,
        message: error instanceof Error ? error.message : String(error),
        requestId,
        status,
      })
      if (!retryable || attempt === attempts) break
      await sleep(500 * 2 ** (attempt - 1))
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

function groqText(payload: unknown) {
  return (
    (payload as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message
      ?.content ?? ''
  ).trim()
}

function geminiText(payload: unknown) {
  return (
    (payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
      .candidates?.[0]?.content?.parts ?? []
  )
    .map((part) => part.text ?? '')
    .join('')
    .trim()
}

async function callGroq(input: GenerateTextInput): Promise<LlmTextResult> {
  let lastError: unknown

  for (const model of groqModels()) {
    try {
      const payload = await fetchJson(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          body: JSON.stringify({
            max_tokens: maxTokens(input.maxTokens),
            messages: [
              { role: 'system', content: input.system || 'You are a helpful academic tutor.' },
              { role: 'user', content: input.prompt },
            ],
            model,
            response_format: input.json ? { type: 'json_object' } : undefined,
            temperature: input.temperature ?? 0.15,
          }),
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
          method: 'POST',
        },
        input.requestId
      )
      const text = groqText(payload)
      if (!text) throw new Error(`${model} returned an empty response.`)
      return { model, provider: 'groq', text }
    } catch (error) {
      lastError = error
      console.error('groq_model_failed', {
        message: error instanceof Error ? error.message : String(error),
        model,
        requestId: input.requestId,
      })
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Groq failed.')
}

async function callGemini(input: GenerateTextInput): Promise<LlmTextResult> {
  let lastError: unknown

  for (const model of geminiModels()) {
    try {
      const payload = await fetchJson(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          body: JSON.stringify({
            contents: [{ parts: [{ text: input.prompt }] }],
            generationConfig: {
              maxOutputTokens: maxTokens(input.maxTokens),
              responseMimeType: input.json ? 'application/json' : 'text/plain',
              temperature: input.temperature ?? 0.15,
            },
            systemInstruction: {
              parts: [{ text: input.system || 'You are a helpful academic tutor.' }],
            },
          }),
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': process.env.GEMINI_API_KEY || '',
          },
          method: 'POST',
        },
        input.requestId
      )
      const text = geminiText(payload)
      if (!text) throw new Error(`${model} returned an empty response.`)
      return { model, provider: 'gemini', text }
    } catch (error) {
      lastError = error
      console.error('gemini_model_failed', {
        message: error instanceof Error ? error.message : String(error),
        model,
        requestId: input.requestId,
      })
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Gemini failed.')
}

export async function generateText(input: GenerateTextInput): Promise<LlmTextResult> {
  const providers = configuredProviderOrder()
  if (!providers.length) {
    throw new Error('No LLM provider configured. Add GROQ_API_KEY or GEMINI_API_KEY.')
  }

  const failures: string[] = []
  for (const provider of providers) {
    try {
      return await withRetry(`llm:${provider}`, input.requestId, () =>
        provider === 'groq' ? callGroq(input) : callGemini(input)
      )
    } catch (error) {
      failures.push(`${provider}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  throw new Error(`All LLM providers failed. ${failures.join(' | ')}`)
}

export function parseJsonObject<T>(text: string): T {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')

  try {
    return JSON.parse(cleaned) as T
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as T
    }
    throw new Error('The LLM did not return valid JSON.')
  }
}

export async function generateJson<T>(input: GenerateTextInput): Promise<LlmTextResult & { data: T }> {
  const result = await generateText({ ...input, json: true })
  try {
    return { ...result, data: parseJsonObject<T>(result.text) }
  } catch (error) {
    console.error('llm_json_parse_failed', {
      message: error instanceof Error ? error.message : String(error),
      model: result.model,
      provider: result.provider,
      requestId: input.requestId,
    })

    const repaired = await generateText({
      json: true,
      maxTokens: input.maxTokens,
      prompt: [
        'The previous response was not valid JSON.',
        'Original task:',
        input.prompt.slice(0, 6_000),
        '',
        'Malformed response:',
        result.text.slice(0, 8_000),
        '',
        'Return one valid JSON object only. No markdown, no comments, no extra text.',
      ].join('\n'),
      requestId: input.requestId,
      system:
        'You repair malformed model output into strict JSON that matches the original requested schema.',
      temperature: 0,
    })

    return { ...repaired, data: parseJsonObject<T>(repaired.text) }
  }
}

export async function extractTextFromImage(input: {
  base64: string
  mimeType: string
  requestId?: string
}) {
  if (!process.env.GEMINI_API_KEY?.trim()) {
    throw new Error('Image OCR requires GEMINI_API_KEY.')
  }

  let lastError: unknown
  for (const model of geminiModels()) {
    try {
      const payload = await fetchJson(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text:
                      'Extract the readable academic question text from this image. Preserve numbers, equations, units, labels, and answer choices. Return only the extracted text.',
                  },
                  {
                    inline_data: {
                      data: input.base64,
                      mime_type: input.mimeType || 'image/png',
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              maxOutputTokens: 1_200,
              temperature: 0,
            },
          }),
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': process.env.GEMINI_API_KEY || '',
          },
          method: 'POST',
        },
        input.requestId
      )
      const text = geminiText(payload)
      if (!text) throw new Error(`${model} returned no OCR text.`)
      return { model, provider: 'gemini' as const, text }
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Gemini image OCR failed.')
}
