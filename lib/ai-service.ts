import { fetchWithTimeout } from './server/http-client.ts'
import { getGeminiModelCandidates } from './ai/geminiConfig.ts'
import { checkGeminiQuota, estimateTokenCount, scheduleLLMUsageLog } from './server/llm-usage.ts'
import { createRequestId, logError, logEvent } from './server/logger.ts'
import {
  AiConfigurationError,
  AiServiceError,
  AiProviderChainError,
  AiProviderHttpError,
  AiValidationError,
  assertProviderRateLimit,
  buildTextStream,
  getAiProviderHealthSnapshot,
  isProviderConfigured,
  isManagedProvider,
  resetAiProviderRuntimeForTests,
  runProviderWithRetry,
  type ManagedProvider as Provider,
} from './server/ai-provider-runtime.ts'

export type AiInputPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }

export type AiRequestOptions = {
  maxTokens?: number
  requestId?: string
  userKey?: string | null
  operation?: string
  streamChunkSize?: number
  fallbackTextOnError?: string
}

type ResolvedRequestOptions = {
  maxTokens: number
  requestId: string
  userKey: string
  operation: string
  streamChunkSize: number
  fallbackTextOnError: string
}

type ProviderCallResult = {
  text: string
  model: string
  inputTokens: number
  outputTokens: number
}

const DEFAULT_MAX_TOKENS = 480
const DEFAULT_TEMPERATURE = 0.05
const DEFAULT_PROVIDER_ORDER = 'gemini,openai,groq,openai_compatible'
const DEFAULT_FALLBACK_STREAM_TEXT =
  'I hit a temporary response problem. Please try again in a moment.'
const NO_LLM_PROVIDERS_MESSAGE =
  'NO_LLM_PROVIDERS_CONFIGURED: add at least GEMINI_API_KEY to .env.local'

function getAiTimeoutMs() {
  return Number(process.env.AI_PROVIDER_TIMEOUT_MS || process.env.EXTERNAL_CALL_TIMEOUT_MS || 25_000)
}

function getDefaultStreamChunkSize() {
  return Number(process.env.AI_STREAM_CHUNK_SIZE || 180)
}

function getProviderOrder() {
  const raw = process.env.AI_PROVIDER_ORDER ?? DEFAULT_PROVIDER_ORDER
  const parsed = raw.split(',').map((item) => item.trim()).filter(isManagedProvider)
  return parsed.length > 0 ? parsed : (['gemini'] satisfies Provider[])
}

function getConfiguredProviderOrder() {
  return getProviderOrder().filter(isProviderConfigured)
}

function getMaxTokens(requested?: number) {
  if (typeof requested === 'number' && Number.isFinite(requested) && requested > 0) {
    return requested
  }

  const fromEnv = Number(process.env.AI_DEFAULT_MAX_TOKENS)
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return fromEnv
  }

  return DEFAULT_MAX_TOKENS
}

function sanitizeText(value: string, label: string) {
  const normalized = value.trim()
  if (!normalized) {
    throw new AiValidationError(`${label} is required`)
  }

  return normalized
}

function sanitizeUserKey(userKey?: string | null) {
  const normalized = (userKey ?? 'anonymous').trim()
  return normalized || 'anonymous'
}

function normalizeRequestOptions(
  maxTokensOrOptions?: number | AiRequestOptions,
  operation = 'ai_generate_text'
): ResolvedRequestOptions {
  const options =
    typeof maxTokensOrOptions === 'number' ? { maxTokens: maxTokensOrOptions } : maxTokensOrOptions ?? {}

  return {
    maxTokens: getMaxTokens(options.maxTokens),
    requestId: options.requestId?.trim() || createRequestId(),
    userKey: sanitizeUserKey(options.userKey),
    operation: options.operation?.trim() || operation,
    streamChunkSize: Math.max(32, options.streamChunkSize ?? getDefaultStreamChunkSize()),
    fallbackTextOnError: options.fallbackTextOnError?.trim() || DEFAULT_FALLBACK_STREAM_TEXT,
  }
}

function hasInlineDataPart(parts: AiInputPart[]) {
  return parts.some((part) => 'inlineData' in part)
}

function hasExtractedAttachmentText(parts: AiInputPart[]) {
  return parts.some(
    (part) => 'text' in part && /^attachment extracted text:/i.test(part.text.trim())
  )
}

function flattenTextParts(parts: AiInputPart[]) {
  return parts
    .filter((part): part is { text: string } => 'text' in part)
    .map((part) => part.text.trim())
    .filter(Boolean)
    .join('\n\n')
}

function buildTextOnlyFallbackPrompt(parts: AiInputPart[]) {
  const textContent = flattenTextParts(parts)
  if (!textContent) {
    return null
  }

  if (!hasInlineDataPart(parts)) {
    return textContent
  }

  if (!hasExtractedAttachmentText(parts)) {
    return null
  }

  return [
    'Fallback mode note: a file was attached in the original request.',
    'This backup provider only received the extracted text and prompt that were already available in the request.',
    '',
    textContent,
  ].join('\n')
}

function ensureMultipartInput(parts: AiInputPart[], systemPrompt: string) {
  sanitizeText(systemPrompt, 'System prompt')
  if (!Array.isArray(parts) || parts.length === 0) {
    throw new AiValidationError('At least one input part is required')
  }
}

function extractGeminiText(data: unknown) {
  const candidate = (data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
    ?.candidates?.[0]
  const parts = candidate?.content?.parts ?? []
  const text = parts.map((part) => part.text ?? '').join('').trim()

  if (!text) {
    throw new AiProviderHttpError('gemini', 502, 'Gemini returned an empty response')
  }

  return text
}

function extractOpenAIText(data: unknown) {
  const outputText = (data as { output_text?: string })?.output_text?.trim()
  if (outputText) {
    return outputText
  }

  const output = (data as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> })?.output
  const text = output
    ?.flatMap((item) => item.content ?? [])
    .filter((item) => item.type === 'output_text' || Boolean(item.text))
    .map((item) => item.text ?? '')
    .join('')
    .trim()

  if (!text) {
    throw new AiProviderHttpError('openai', 502, 'OpenAI returned an empty response')
  }

  return text
}

function extractOpenAICompatibleText(data: unknown, provider: Provider) {
  const text = (data as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]?.message?.content?.trim()

  if (!text) {
    throw new AiProviderHttpError(provider, 502, `${provider} returned an empty response`)
  }

  return text
}

function normalizeUsageCount(value: unknown) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric < 0) {
    return null
  }

  return Math.max(0, Math.round(numeric))
}

function estimatePromptTokens(prompt: string, systemPrompt: string) {
  return estimateTokenCount([systemPrompt, prompt].filter(Boolean).join('\n\n'))
}

function estimateMultipartPromptTokens(parts: AiInputPart[], systemPrompt: string) {
  const text = [systemPrompt, flattenTextParts(parts)].filter(Boolean).join('\n\n')
  const inlineAttachmentCount = parts.filter((part) => 'inlineData' in part).length
  return estimateTokenCount(text) + inlineAttachmentCount * 256
}

function getOpenAIModel() {
  return process.env.OPENAI_MODEL ?? 'gpt-5-nano'
}

function getGroqModel() {
  return process.env.GROQ_MODEL ?? 'llama-3.1-8b-instant'
}

function getOpenAICompatibleModel() {
  return process.env.OPENAI_COMPAT_MODEL ?? 'llama-3.1-8b-instant'
}

function ensureProviderConfigured(provider: Provider) {
  if (provider === 'gemini' && !process.env.GEMINI_API_KEY) {
    throw new AiConfigurationError(provider, 'Missing GEMINI_API_KEY')
  }

  if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
    throw new AiConfigurationError(provider, 'Missing OPENAI_API_KEY')
  }

  if (provider === 'groq' && !process.env.GROQ_API_KEY) {
    throw new AiConfigurationError(provider, 'Missing GROQ_API_KEY')
  }

  if (
    provider === 'openai_compatible' &&
    (!process.env.OPENAI_COMPAT_API_KEY || !process.env.OPENAI_COMPAT_BASE_URL)
  ) {
    throw new AiConfigurationError(provider, 'Missing OPENAI_COMPAT_API_KEY or OPENAI_COMPAT_BASE_URL')
  }
}

async function parseResponsePayload(response: Response, provider: Provider) {
  const text = await response.text()
  if (!text) {
    throw new AiProviderHttpError(provider, response.status || 502, `${provider} returned an empty payload`)
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new AiProviderHttpError(provider, response.status || 502, `${provider} returned invalid JSON`)
  }
}

function extractProviderErrorMessage(provider: Provider, payload: unknown, fallback: string) {
  if (provider === 'gemini') {
    return (payload as { error?: { message?: string } })?.error?.message ?? fallback
  }

  if (provider === 'openai') {
    return (payload as { error?: { message?: string } })?.error?.message ?? fallback
  }

  return (payload as { error?: { message?: string } })?.error?.message ?? fallback
}

function throwIfProviderFailed(provider: Provider, response: Response, payload: unknown, fallback: string) {
  if (response.ok) {
    return
  }

  const message = extractProviderErrorMessage(provider, payload, fallback)
  throw new AiProviderHttpError(provider, response.status, message)
}

async function callGeminiParts(
  parts: AiInputPart[],
  systemPrompt: string,
  maxTokens: number,
  requestId: string
) : Promise<ProviderCallResult> {
  let lastError: unknown = null

  for (const model of getGeminiModelCandidates()) {
    try {
      const response = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ parts }],
            generationConfig: {
              maxOutputTokens: maxTokens,
              temperature: DEFAULT_TEMPERATURE,
              topP: 0.8,
              topK: 20,
              candidateCount: 1,
            },
          }),
        },
        { operation: 'gemini_generate_content', service: 'gemini', timeoutMs: getAiTimeoutMs(), requestId }
      )
      const payload = await parseResponsePayload(response, 'gemini')
      throwIfProviderFailed('gemini', response, payload, 'Gemini request failed')
      const text = extractGeminiText(payload)
      if (!text.trim()) {
        throw new AiProviderHttpError('gemini', 502, `${model} returned an empty response`)
      }
      const usage = (payload as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } }).usageMetadata

      return {
        text,
        model,
        inputTokens: normalizeUsageCount(usage?.promptTokenCount) ?? estimateMultipartPromptTokens(parts, systemPrompt),
        outputTokens: normalizeUsageCount(usage?.candidatesTokenCount) ?? estimateTokenCount(text),
      }
    } catch (error) {
      lastError = error
      console.error(`Gemini error (${model}):`, error)
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Gemini request failed for all configured models')
}

async function callGemini(prompt: string, systemPrompt: string, maxTokens: number, requestId: string) {
  return callGeminiParts([{ text: prompt }], systemPrompt, maxTokens, requestId)
}

async function callOpenAI(
  prompt: string,
  systemPrompt: string,
  maxTokens: number,
  requestId: string
): Promise<ProviderCallResult> {
  const model = getOpenAIModel()
  const response = await fetchWithTimeout(
    'https://api.openai.com/v1/responses',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        input: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }],
        max_output_tokens: maxTokens,
      }),
    },
    { operation: 'openai_responses', service: 'openai', timeoutMs: getAiTimeoutMs(), requestId }
  )
  const payload = await parseResponsePayload(response, 'openai')
  throwIfProviderFailed('openai', response, payload, 'OpenAI request failed')
  const text = extractOpenAIText(payload)
  const usage = (payload as { usage?: { input_tokens?: number; output_tokens?: number } }).usage

  return {
    text,
    model,
    inputTokens: normalizeUsageCount(usage?.input_tokens) ?? estimatePromptTokens(prompt, systemPrompt),
    outputTokens: normalizeUsageCount(usage?.output_tokens) ?? estimateTokenCount(text),
  }
}

async function callGroq(
  prompt: string,
  systemPrompt: string,
  maxTokens: number,
  requestId: string
): Promise<ProviderCallResult> {
  const model = getGroqModel()
  const response = await fetchWithTimeout(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: DEFAULT_TEMPERATURE,
      }),
    },
    { operation: 'groq_chat_completions', service: 'groq', timeoutMs: getAiTimeoutMs(), requestId }
  )
  const payload = await parseResponsePayload(response, 'groq')
  throwIfProviderFailed('groq', response, payload, 'Groq request failed')
  const text = extractOpenAICompatibleText(payload, 'groq')
  const usage = (payload as { usage?: { prompt_tokens?: number; completion_tokens?: number } }).usage

  return {
    text,
    model,
    inputTokens: normalizeUsageCount(usage?.prompt_tokens) ?? estimatePromptTokens(prompt, systemPrompt),
    outputTokens: normalizeUsageCount(usage?.completion_tokens) ?? estimateTokenCount(text),
  }
}

async function callOpenAICompatible(
  prompt: string,
  systemPrompt: string,
  maxTokens: number,
  requestId: string
): Promise<ProviderCallResult> {
  const normalizedBaseUrl = process.env.OPENAI_COMPAT_BASE_URL?.replace(/\/$/, '')
  const model = getOpenAICompatibleModel()
  const response = await fetchWithTimeout(
    `${normalizedBaseUrl}/chat/completions`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_COMPAT_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: DEFAULT_TEMPERATURE,
      }),
    },
    {
      operation: 'openai_compatible_chat_completions',
      service: 'openai_compatible',
      timeoutMs: getAiTimeoutMs(),
      requestId,
    }
  )
  const payload = await parseResponsePayload(response, 'openai_compatible')
  throwIfProviderFailed('openai_compatible', response, payload, 'OpenAI-compatible request failed')
  const text = extractOpenAICompatibleText(payload, 'openai_compatible')
  const usage = (payload as { usage?: { prompt_tokens?: number; completion_tokens?: number } }).usage

  return {
    text,
    model,
    inputTokens: normalizeUsageCount(usage?.prompt_tokens) ?? estimatePromptTokens(prompt, systemPrompt),
    outputTokens: normalizeUsageCount(usage?.completion_tokens) ?? estimateTokenCount(text),
  }
}

async function callProvider(
  provider: Provider,
  prompt: string,
  systemPrompt: string,
  maxTokens: number,
  requestId: string
): Promise<ProviderCallResult> {
  if (provider === 'gemini') {
    return callGemini(prompt, systemPrompt, maxTokens, requestId)
  }

  if (provider === 'openai') {
    return callOpenAI(prompt, systemPrompt, maxTokens, requestId)
  }

  if (provider === 'groq') {
    return callGroq(prompt, systemPrompt, maxTokens, requestId)
  }

  return callOpenAICompatible(prompt, systemPrompt, maxTokens, requestId)
}

async function callProviderFromParts(
  provider: Provider,
  parts: AiInputPart[],
  systemPrompt: string,
  maxTokens: number,
  requestId: string
) : Promise<ProviderCallResult> {
  if (provider === 'gemini') {
    return callGeminiParts(parts, systemPrompt, maxTokens, requestId)
  }

  const prompt = buildTextOnlyFallbackPrompt(parts)
  if (!prompt) {
    throw new AiValidationError(`${provider} cannot handle file-only parts without extracted text`)
  }

  return callProvider(provider, prompt, systemPrompt, maxTokens, requestId)
}

async function callProviderWithResilience(
  provider: Provider,
  userKey: string,
  requestId: string,
  operation: string,
  handler: () => Promise<ProviderCallResult>
) {
  ensureProviderConfigured(provider)
  assertProviderRateLimit(provider, userKey, requestId)
  return runProviderWithRetry({ provider, requestId, operation, handler })
}

function buildFailureMessage(provider: Provider, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return `${provider}: ${message}`
}

function validatePromptInput(prompt: string, systemPrompt: string) {
  return {
    prompt: sanitizeText(prompt, 'Prompt'),
    systemPrompt: sanitizeText(systemPrompt, 'System prompt'),
  }
}

export async function generateResponse(prompt: string, systemPrompt: string, maxTokensOrOptions?: number | AiRequestOptions) {
  const { prompt: safePrompt, systemPrompt: safeSystemPrompt } = validatePromptInput(prompt, systemPrompt)
  const options = normalizeRequestOptions(maxTokensOrOptions)
  const failures: string[] = []
  const providers = getConfiguredProviderOrder()

  if (providers.length === 0) {
    throw new AiServiceError(NO_LLM_PROVIDERS_MESSAGE, {
      code: 'ai_no_configured_providers',
      name: 'AiServiceError',
    })
  }

  for (const provider of providers) {
    if (provider === 'gemini' && !(await checkGeminiQuota())) {
      failures.push('gemini: blocked by quota safeguard')
      continue
    }

    try {
      const result = await callProviderWithResilience(provider, options.userKey, options.requestId, options.operation, () =>
        callProvider(provider, safePrompt, safeSystemPrompt, options.maxTokens, options.requestId)
      )
      scheduleLLMUsageLog({
        provider,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      })
      return result.text
    } catch (error) {
      failures.push(buildFailureMessage(provider, error))
      logError('ai_provider_failed', error, { request_id: options.requestId, provider, operation: options.operation })
    }
  }

  throw new AiProviderChainError(`All AI providers failed. ${failures.join(' | ')}`, failures)
}

export async function generateResponseFromParts(
  parts: AiInputPart[],
  systemPrompt: string,
  maxTokensOrOptions?: number | AiRequestOptions
) {
  ensureMultipartInput(parts, systemPrompt)
  const options = normalizeRequestOptions(maxTokensOrOptions, 'ai_generate_multipart')
  const safeSystemPrompt = sanitizeText(systemPrompt, 'System prompt')
  const failures: string[] = []
  const providers = getConfiguredProviderOrder()

  if (providers.length === 0) {
    throw new AiServiceError(NO_LLM_PROVIDERS_MESSAGE, {
      code: 'ai_no_configured_providers',
      name: 'AiServiceError',
    })
  }

  for (const provider of providers) {
    if (provider === 'gemini' && !(await checkGeminiQuota())) {
      failures.push('gemini: blocked by quota safeguard')
      continue
    }

    try {
      const result = await callProviderWithResilience(provider, options.userKey, options.requestId, options.operation, () =>
        callProviderFromParts(provider, parts, safeSystemPrompt, options.maxTokens, options.requestId)
      )
      scheduleLLMUsageLog({
        provider,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      })
      return result.text
    } catch (error) {
      failures.push(buildFailureMessage(provider, error))
      logError('ai_provider_multipart_failed', error, {
        request_id: options.requestId,
        provider,
        operation: options.operation,
      })
    }
  }

  throw new AiProviderChainError(`All AI providers failed for multipart input. ${failures.join(' | ')}`, failures)
}

export async function generateResponseStream(
  prompt: string,
  systemPrompt: string,
  maxTokensOrOptions?: number | AiRequestOptions
) {
  const options = normalizeRequestOptions(maxTokensOrOptions, 'ai_generate_stream')

  try {
    const text = await generateResponse(prompt, systemPrompt, options)
    return buildTextStream(text, options.streamChunkSize)
  } catch (error) {
    logError('ai_stream_generation_failed', error, {
      request_id: options.requestId,
      operation: options.operation,
    })
    return buildTextStream(options.fallbackTextOnError, options.streamChunkSize)
  }
}

export function getAiServiceHealth() {
  return getAiProviderHealthSnapshot(getProviderOrder())
}

export function resetAiServiceForTests() {
  resetAiProviderRuntimeForTests()
  logEvent('info', 'ai_service_test_reset')
}
