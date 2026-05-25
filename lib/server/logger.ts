import { randomUUID } from 'node:crypto'

export type LogLevel = 'info' | 'warn' | 'error'

type LogContext = Record<string, unknown>

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      error_name: error.name,
      error_message: error.message,
    }
  }

  return {
    error_message: String(error),
  }
}

export function createRequestId() {
  return randomUUID()
}

export function logEvent(level: LogLevel, message: string, context: LogContext = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  }

  const line = JSON.stringify(payload)
  if (level === 'error') {
    console.error(line)
    return
  }

  if (level === 'warn') {
    console.warn(line)
    return
  }

  console.info(line)
}

export function logError(message: string, error: unknown, context: LogContext = {}) {
  logEvent('error', message, {
    ...context,
    ...serializeError(error),
  })
}
