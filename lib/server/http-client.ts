import { createRequestId, logError, logEvent } from './logger.ts'

type FetchMeta = {
  operation: string
  service: string
  timeoutMs?: number
  requestId?: string
}

const DEFAULT_EXTERNAL_TIMEOUT_MS = Number(process.env.EXTERNAL_CALL_TIMEOUT_MS || 20000)

function resolveTimeoutMs(timeoutMs?: number) {
  if (typeof timeoutMs === 'number' && Number.isFinite(timeoutMs) && timeoutMs > 0) {
    return timeoutMs
  }

  return DEFAULT_EXTERNAL_TIMEOUT_MS
}

function toTarget(input: RequestInfo | URL) {
  try {
    const raw =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url
    const url = new URL(raw)
    url.search = ''
    return `${url.origin}${url.pathname}`
  } catch {
    return typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
  }
}

function buildTimeoutError(operation: string, timeoutMs: number) {
  const error = new Error(`${operation} timed out after ${timeoutMs}ms`)
  error.name = 'TimeoutError'
  return error
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  meta: FetchMeta
) {
  const requestId = meta.requestId ?? createRequestId()
  const timeoutMs = resolveTimeoutMs(meta.timeoutMs)
  const controller = new AbortController()
  const startedAt = Date.now()
  const timeout = setTimeout(() => {
    controller.abort(buildTimeoutError(meta.operation, timeoutMs))
  }, timeoutMs)

  if (init.signal) {
    init.signal.addEventListener(
      'abort',
      () => {
        controller.abort(init.signal?.reason)
      },
      { once: true }
    )
  }

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    })

    logEvent('info', 'external_call_completed', {
      request_id: requestId,
      service: meta.service,
      operation: meta.operation,
      target: toTarget(input),
      duration_ms: Date.now() - startedAt,
      status_code: response.status,
    })

    return response
  } catch (error) {
    logError('external_call_failed', error, {
      request_id: requestId,
      service: meta.service,
      operation: meta.operation,
      target: toTarget(input),
      duration_ms: Date.now() - startedAt,
    })
    throw error
  } finally {
    clearTimeout(timeout)
  }
}
