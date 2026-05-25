export type LlmProviderName = 'gemini' | 'openai' | 'groq' | 'openai_compatible'

export type CallLlmWithFallbackOptions = {
  systemPrompt?: string
  maxTokens?: number
  dryRun?: boolean
}

type ProviderConfig = {
  name: LlmProviderName
  configured: boolean
}

const DEFAULT_PROVIDER_ORDER = 'gemini,openai,groq,openai_compatible'
const NO_LLM_PROVIDERS_MESSAGE =
  'NO_LLM_PROVIDERS_CONFIGURED: add at least GEMINI_API_KEY to .env.local'

function isManagedProvider(value: string): value is LlmProviderName {
  return value === 'gemini' || value === 'openai' || value === 'groq' || value === 'openai_compatible'
}

function getConfiguredProviders(): ProviderConfig[] {
  const requestedOrder = (process.env.AI_PROVIDER_ORDER ?? DEFAULT_PROVIDER_ORDER)
    .split(',')
    .map((value) => value.trim())
    .filter(isManagedProvider)

  const uniqueOrder = requestedOrder.length > 0 ? Array.from(new Set(requestedOrder)) : (['gemini'] as LlmProviderName[])

  return uniqueOrder.map((name) => {
    if (name === 'gemini') {
      return { name, configured: Boolean(process.env.GEMINI_API_KEY?.trim()) }
    }

    if (name === 'openai') {
      return { name, configured: Boolean(process.env.OPENAI_API_KEY?.trim()) }
    }

    if (name === 'groq') {
      return { name, configured: Boolean(process.env.GROQ_API_KEY?.trim()) }
    }

    return {
      name,
      configured: Boolean(process.env.OPENAI_COMPAT_API_KEY?.trim() && process.env.OPENAI_COMPAT_BASE_URL?.trim()),
    }
  }).filter((provider) => provider.configured)
}

export async function callLLMWithFallback(
  prompt: string,
  options: CallLlmWithFallbackOptions = {}
) {
  const configuredProviders = getConfiguredProviders()

  if (configuredProviders.length === 0) {
    throw new Error(NO_LLM_PROVIDERS_MESSAGE)
  }

  const provider = configuredProviders[0]?.name ?? 'gemini'

  if (options.dryRun) {
    return {
      result: 'dry-run-ok',
      provider,
    }
  }

  const { generateResponse } = await import('./ai-service.ts')
  const result = await generateResponse(
    prompt,
    options.systemPrompt ?? 'You are a concise production health checker.',
    {
      maxTokens: options.maxTokens ?? 64,
      operation: 'prod_readiness_llm_check',
    }
  )

  return {
    result,
    provider,
  }
}
