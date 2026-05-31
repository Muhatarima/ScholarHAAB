export const DEFAULT_GEMINI_MODEL = 'gemini-flash-lite-latest'

const FALLBACK_GEMINI_MODELS = [
  DEFAULT_GEMINI_MODEL,
  'gemini-flash-latest',
]

export function getGeminiModelCandidates() {
  const configured = process.env.GEMINI_MODEL?.trim()
  return Array.from(new Set([configured, ...FALLBACK_GEMINI_MODELS].filter(Boolean) as string[]))
}

export function getPrimaryGeminiModel() {
  return getGeminiModelCandidates()[0] ?? DEFAULT_GEMINI_MODEL
}

export function getGeminiTimeoutMs() {
  return Number(process.env.GEMINI_TIMEOUT_MS || process.env.AI_PROVIDER_TIMEOUT_MS || 25_000)
}

export async function withGeminiTimeout<T>(
  promise: Promise<T>,
  timeoutMs = getGeminiTimeoutMs()
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`Gemini timed out after ${timeoutMs}ms`)), timeoutMs)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

export function getGeminiErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error)
  } catch {
    return 'Unknown Gemini error'
  }
}
