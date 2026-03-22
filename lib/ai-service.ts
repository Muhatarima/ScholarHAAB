type Provider = 'gemini' | 'openai' | 'openai_compatible'

const DEFAULT_MAX_TOKENS = 480
const DEFAULT_TEMPERATURE = 0.2
const DEFAULT_PROVIDER_ORDER = 'gemini,openai,openai_compatible'

function isProvider(value: string): value is Provider {
  return value === 'gemini' || value === 'openai' || value === 'openai_compatible'
}

function getProviderOrder(): Provider[] {
  const raw = process.env.AI_PROVIDER_ORDER ?? DEFAULT_PROVIDER_ORDER
  const parsed = raw
    .split(',')
    .map((item) => item.trim())
    .filter(isProvider)

  return parsed.length > 0 ? parsed : ['gemini']
}

function getMaxTokens(requested?: number): number {
  if (typeof requested === 'number' && Number.isFinite(requested)) {
    return requested
  }

  const fromEnv = Number(process.env.AI_DEFAULT_MAX_TOKENS)
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return fromEnv
  }

  return DEFAULT_MAX_TOKENS
}

function extractGeminiText(data: unknown): string {
  const candidate = (data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
    ?.candidates?.[0]
  const parts = candidate?.content?.parts ?? []
  const text = parts.map((part) => part.text ?? '').join('').trim()

  if (!text) {
    throw new Error('Gemini returned an empty response')
  }

  return text
}

function extractOpenAIText(data: unknown): string {
  const outputText = (data as { output_text?: string })?.output_text?.trim()
  if (outputText) {
    return outputText
  }

  const output = (data as {
    output?: Array<{
      content?: Array<{ type?: string; text?: string }>
    }>
  })?.output

  const text = output
    ?.flatMap((item) => item.content ?? [])
    .filter((item) => item.type === 'output_text' || item.text)
    .map((item) => item.text ?? '')
    .join('')
    .trim()

  if (!text) {
    throw new Error('OpenAI returned an empty response')
  }

  return text
}

function extractOpenAICompatibleText(data: unknown): string {
  const text = (data as {
    choices?: Array<{ message?: { content?: string } }>
  })?.choices?.[0]?.message?.content?.trim()

  if (!text) {
    throw new Error('OpenAI-compatible provider returned an empty response')
  }

  return text
}

function getGeminiModel(): string {
  return process.env.GEMINI_MODEL ?? 'gemini-2.0-flash'
}

function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL ?? 'gpt-5-nano'
}

function getOpenAICompatibleModel(): string {
  return process.env.OPENAI_COMPAT_MODEL ?? 'llama-3.1-8b-instant'
}

async function callGemini(prompt: string, systemPrompt: string, maxTokens: number): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY')
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${getGeminiModel()}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: DEFAULT_TEMPERATURE,
          candidateCount: 1,
        },
      }),
    }
  )

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.error?.message ?? 'Gemini request failed')
  }

  return extractGeminiText(data)
}

async function callOpenAI(prompt: string, systemPrompt: string, maxTokens: number): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY')
  }

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: getOpenAIModel(),
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      max_output_tokens: maxTokens,
    }),
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.error?.message ?? 'OpenAI request failed')
  }

  return extractOpenAIText(data)
}

async function callOpenAICompatible(prompt: string, systemPrompt: string, maxTokens: number): Promise<string> {
  const apiKey = process.env.OPENAI_COMPAT_API_KEY
  const baseUrl = process.env.OPENAI_COMPAT_BASE_URL

  if (!apiKey || !baseUrl) {
    throw new Error('Missing OPENAI_COMPAT_API_KEY or OPENAI_COMPAT_BASE_URL')
  }

  const normalizedBaseUrl = baseUrl.replace(/\/$/, '')
  const res = await fetch(`${normalizedBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: getOpenAICompatibleModel(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      max_tokens: maxTokens,
      temperature: DEFAULT_TEMPERATURE,
    }),
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.error?.message ?? 'OpenAI-compatible request failed')
  }

  return extractOpenAICompatibleText(data)
}

async function callProvider(
  provider: Provider,
  prompt: string,
  systemPrompt: string,
  maxTokens: number
): Promise<string> {
  if (provider === 'gemini') {
    return callGemini(prompt, systemPrompt, maxTokens)
  }

  if (provider === 'openai') {
    return callOpenAI(prompt, systemPrompt, maxTokens)
  }

  return callOpenAICompatible(prompt, systemPrompt, maxTokens)
}

export async function generateResponse(
  prompt: string,
  systemPrompt: string,
  maxTokens?: number
): Promise<string> {
  const providerOrder = getProviderOrder()
  const resolvedMaxTokens = getMaxTokens(maxTokens)
  const failures: string[] = []

  for (const provider of providerOrder) {
    try {
      return await callProvider(provider, prompt, systemPrompt, resolvedMaxTokens)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      failures.push(`${provider}: ${message}`)
      console.error(`${provider} failed:`, error)
    }
  }

  throw new Error(`All AI providers failed. ${failures.join(' | ')}`)
}
