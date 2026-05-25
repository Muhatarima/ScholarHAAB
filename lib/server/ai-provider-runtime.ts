import { logEvent } from './logger.ts'

export type ManagedProvider = 'gemini' | 'openai' | 'groq' | 'openai_compatible'

type RetryArgs<T> = {
  provider: ManagedProvider
  requestId: string
  operation: string
  handler: () => Promise<T>
}

type RateLimitState = {
  count: number
  resetAt: number
}

const rateLimitState = new Map<string, RateLimitState>()
const RETRYABLE_STATUS_CODES = new Set([408, 409, 425, 429, 500, 502, 503, 504])

function getDefaultRateLimitWindowMs() {
  return Number(process.env.AI_PROVIDER_RATE_LIMIT_WINDOW_MS || 60_000)
}

function getDefaultRateLimitMaxRequests() {
  return Number(process.env.AI_PROVIDER_RATE_LIMIT_MAX_REQUESTS || 24)
}

function getDefaultRetryCount() {
  return Number(process.env.AI_PROVIDER_RETRY_COUNT || 1)
}

function getDefaultRetryBackoffMs() {
  return Number(process.env.AI_PROVIDER_RETRY_BACKOFF_MS || 400)
}

export class AiServiceError extends Error {
  readonly code: string
  readonly provider?: ManagedProvider
  readonly retryable: boolean
  readonly statusCode?: number

  constructor(
    message: string,
    options: {
      code: string
      provider?: ManagedProvider
      retryable?: boolean
      statusCode?: number
      name?: string
    }
  ) {
    super(message)
    this.name = options.name ?? 'AiServiceError'
    this.code = options.code
    this.provider = options.provider
    this.retryable = options.retryable ?? false
    this.statusCode = options.statusCode
  }
}

export class AiValidationError extends AiServiceError {
  constructor(message: string) {
    super(message, { code: 'ai_validation_error', name: 'AiValidationError' })
  }
}

export class AiConfigurationError extends AiServiceError {
  constructor(provider: ManagedProvider, message: string) {
    super(message, {
      code: 'ai_configuration_error',
      name: 'AiConfigurationError',
      provider,
    })
  }
}

export class AiProviderRateLimitError extends AiServiceError {
  readonly resetAt: number

  constructor(provider: ManagedProvider, userKey: string, resetAt: number) {
    super(`Provider ${provider} is rate limited for ${userKey}`, {
      code: 'ai_provider_rate_limit',
      name: 'AiProviderRateLimitError',
      provider,
    })
    this.resetAt = resetAt
  }
}

export class AiProviderHttpError extends AiServiceError {
  constructor(provider: ManagedProvider, statusCode: number, message: string) {
    super(message, {
      code: 'ai_provider_http_error',
      name: 'AiProviderHttpError',
      provider,
      retryable: RETRYABLE_STATUS_CODES.has(statusCode),
      statusCode,
    })
  }
}

export class AiNetworkError extends AiServiceError {
  constructor(provider: ManagedProvider, message: string) {
    super(message, {
      code: 'ai_network_error',
      name: 'AiNetworkError',
      provider,
      retryable: true,
    })
  }
}

export class AiProviderChainError extends AiServiceError {
  readonly failures: string[]

  constructor(message: string, failures: string[]) {
    super(message, {
      code: 'ai_provider_chain_error',
      name: 'AiProviderChainError',
    })
    this.failures = failures
  }
}

export function isManagedProvider(value: string): value is ManagedProvider {
  return value === 'gemini' || value === 'openai' || value === 'groq' || value === 'openai_compatible'
}

export function isProviderConfigured(provider: ManagedProvider) {
  if (provider === 'gemini') {
    return Boolean(process.env.GEMINI_API_KEY?.trim())
  }

  if (provider === 'openai') {
    return Boolean(process.env.OPENAI_API_KEY?.trim())
  }

  if (provider === 'groq') {
    return Boolean(process.env.GROQ_API_KEY?.trim())
  }

  return Boolean(
    process.env.OPENAI_COMPAT_API_KEY?.trim() && process.env.OPENAI_COMPAT_BASE_URL?.trim()
  )
}

function isFinitePositive(value: number) {
  return Number.isFinite(value) && value > 0
}

function getProviderEnvPrefix(provider: ManagedProvider) {
  if (provider === 'openai_compatible') {
    return 'OPENAI_COMPAT'
  }

  return provider.toUpperCase()
}

function getProviderRetryCount(provider: ManagedProvider) {
  const value = Number(process.env[`${getProviderEnvPrefix(provider)}_RETRY_COUNT`])
  return isFinitePositive(value) ? value : getDefaultRetryCount()
}

function getProviderBackoffMs(provider: ManagedProvider, attempt: number) {
  const value = Number(process.env[`${getProviderEnvPrefix(provider)}_RETRY_BACKOFF_MS`])
  const base = isFinitePositive(value) ? value : getDefaultRetryBackoffMs()
  return base * (attempt + 1)
}

function getProviderRateLimitMaxRequests(provider: ManagedProvider) {
  const value = Number(process.env[`${getProviderEnvPrefix(provider)}_RATE_LIMIT_MAX_REQUESTS`])
  return isFinitePositive(value) ? value : getDefaultRateLimitMaxRequests()
}

function sanitizeUserKey(userKey?: string | null) {
  const normalized = (userKey ?? 'anonymous').trim()
  return normalized || 'anonymous'
}

function cleanupRateLimitState(now: number) {
  for (const [key, value] of rateLimitState.entries()) {
    if (value.resetAt <= now) {
      rateLimitState.delete(key)
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function buildRateLimitKey(provider: ManagedProvider, userKey: string) {
  return `${provider}:${userKey}`
}

function normalizeProviderError(provider: ManagedProvider, error: unknown) {
  if (error instanceof AiServiceError) {
    return error
  }

  if (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)) {
    return new AiNetworkError(provider, error.message)
  }

  if (error instanceof Error && /fetch failed|network|econn|enotfound|socket|timed out/i.test(error.message)) {
    return new AiNetworkError(provider, error.message)
  }

  return new AiServiceError(error instanceof Error ? error.message : String(error), {
    code: 'ai_unknown_provider_error',
    name: 'AiServiceError',
    provider,
  })
}

export function assertProviderRateLimit(
  provider: ManagedProvider,
  userKey: string | null | undefined,
  requestId: string
) {
  const now = Date.now()
  cleanupRateLimitState(now)

  const normalizedUserKey = sanitizeUserKey(userKey)
  const key = buildRateLimitKey(provider, normalizedUserKey)
  const existing = rateLimitState.get(key)

  if (!existing || existing.resetAt <= now) {
    rateLimitState.set(key, {
      count: 1,
      resetAt: now + getDefaultRateLimitWindowMs(),
    })
    return
  }

  if (existing.count >= getProviderRateLimitMaxRequests(provider)) {
    logEvent('warn', 'ai_provider_rate_limit_hit', {
      request_id: requestId,
      provider,
      user_key: normalizedUserKey,
      reset_at: new Date(existing.resetAt).toISOString(),
    })
    throw new AiProviderRateLimitError(provider, normalizedUserKey, existing.resetAt)
  }

  existing.count += 1
  rateLimitState.set(key, existing)
}

export async function runProviderWithRetry<T>({
  provider,
  requestId,
  operation,
  handler,
}: RetryArgs<T>): Promise<T> {
  const retryCount = getProviderRetryCount(provider)

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      return await handler()
    } catch (error) {
      const normalized = normalizeProviderError(provider, error)
      if (!normalized.retryable || attempt >= retryCount) {
        throw normalized
      }

      const delayMs = getProviderBackoffMs(provider, attempt)
      logEvent('warn', 'ai_provider_retry_scheduled', {
        request_id: requestId,
        provider,
        operation,
        attempt: attempt + 1,
        retry_in_ms: delayMs,
        error_code: normalized.code,
        error_message: normalized.message,
      })
      await sleep(delayMs)
    }
  }

  throw new AiServiceError(`Retry loop exhausted for ${provider}`, {
    code: 'ai_retry_loop_exhausted',
    name: 'AiServiceError',
    provider,
  })
}

export function buildTextStream(text: string, chunkSize = 180) {
  const encoder = new TextEncoder()
  const safeChunkSize = Math.max(32, chunkSize)

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      for (let index = 0; index < text.length; index += safeChunkSize) {
        controller.enqueue(encoder.encode(text.slice(index, index + safeChunkSize)))
        await Promise.resolve()
      }

      controller.close()
    },
  })
}

function getProviderStatus(provider: ManagedProvider) {
  return isProviderConfigured(provider) ? 'configured' : 'missing_env'
}

export function getAiProviderHealthSnapshot(providerOrder: ManagedProvider[]) {
  const configuredProviders = providerOrder.filter(isProviderConfigured)

  return {
    ready: configuredProviders.length > 0,
    timeout_ms: Number(process.env.AI_PROVIDER_TIMEOUT_MS || process.env.EXTERNAL_CALL_TIMEOUT_MS || 20_000),
    retry_count: getDefaultRetryCount(),
    rate_limit_window_ms: getDefaultRateLimitWindowMs(),
    rate_limit_max_requests: getDefaultRateLimitMaxRequests(),
    provider_order: providerOrder,
    configured_providers: configuredProviders,
    missing_providers: providerOrder.filter((provider) => !isProviderConfigured(provider)),
    streaming: 'supported',
    providers: Object.fromEntries(
      providerOrder.map((provider) => [provider, getProviderStatus(provider)])
    ),
  }
}

export function resetAiProviderRuntimeForTests() {
  rateLimitState.clear()
}
