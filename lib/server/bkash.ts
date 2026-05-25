import { fetchWithTimeout } from '@/lib/server/http-client'
import { createRequestId, logError, logEvent } from '@/lib/server/logger'
import { buildBkashCallbackUrl, trimTrailingSlash } from '@/lib/server/payment-gateway-utils'

type BkashConfig = {
  appKey: string
  appSecret: string
  username: string
  password: string
  baseUrl: string
  tokenGrantPath: string
  createPaymentPath: string
  executePaymentPath: string
  queryPaymentPath: string
}

type BkashToken = {
  id_token: string
}

type BkashPaymentResponse = Record<string, unknown> & {
  paymentID?: string
  paymentId?: string
  bkashURL?: string
  bkashUrl?: string
  trxID?: string
  transactionStatus?: string
  amount?: string
  merchantInvoiceNumber?: string
}

const BKASH_TIMEOUT_MS = Number(
  process.env.PAYMENT_PROVIDER_TIMEOUT_MS || process.env.EXTERNAL_CALL_TIMEOUT_MS || 30000
)

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required bKash env: ${name}`)
  }

  return value
}

export function isBkashEnabled() {
  return process.env.ENABLE_BKASH !== 'false'
}

export function isBkashConfigured() {
  return [
    'BKASH_BASE_URL',
    'BKASH_APP_KEY',
    'BKASH_APP_SECRET',
    'BKASH_USERNAME',
    'BKASH_PASSWORD',
  ].every((key) => Boolean(process.env[key]?.trim()))
}

export function getBkashConfig(): BkashConfig {
  return {
    appKey: getRequiredEnv('BKASH_APP_KEY'),
    appSecret: getRequiredEnv('BKASH_APP_SECRET'),
    username: getRequiredEnv('BKASH_USERNAME'),
    password: getRequiredEnv('BKASH_PASSWORD'),
    baseUrl: trimTrailingSlash(getRequiredEnv('BKASH_BASE_URL')),
    tokenGrantPath: process.env.BKASH_TOKEN_GRANT_PATH?.trim() || '/tokenized/checkout/token/grant',
    createPaymentPath: process.env.BKASH_CREATE_PAYMENT_PATH?.trim() || '/tokenized/checkout/create',
    executePaymentPath: process.env.BKASH_EXECUTE_PAYMENT_PATH?.trim() || '/tokenized/checkout/execute',
    queryPaymentPath: process.env.BKASH_QUERY_PAYMENT_PATH?.trim() || '/tokenized/checkout/payment/status',
  }
}

function toBkashUrl(baseUrl: string, path: string) {
  return `${trimTrailingSlash(baseUrl)}${path.startsWith('/') ? path : `/${path}`}`
}

async function parseBkashJson(response: Response, operation: string) {
  const text = await response.text()
  let data: Record<string, unknown>

  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {}
  } catch {
    throw new Error(`${operation} returned non-JSON response`)
  }

  if (!response.ok) {
    const message =
      typeof data.errorMessage === 'string'
        ? data.errorMessage
        : typeof data.statusMessage === 'string'
          ? data.statusMessage
          : `HTTP ${response.status}`
    throw new Error(`${operation} failed: ${message}`)
  }

  return data
}

async function grantBkashToken(requestId: string): Promise<BkashToken> {
  const config = getBkashConfig()
  const response = await fetchWithTimeout(
    toBkashUrl(config.baseUrl, config.tokenGrantPath),
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        username: config.username,
        password: config.password,
      },
      body: JSON.stringify({
        app_key: config.appKey,
        app_secret: config.appSecret,
      }),
    },
    {
      operation: 'bkash_grant_token',
      service: 'bkash',
      requestId,
      timeoutMs: BKASH_TIMEOUT_MS,
    }
  )

  const data = await parseBkashJson(response, 'bkash_grant_token')
  if (typeof data.id_token !== 'string' || !data.id_token.trim()) {
    throw new Error('bkash_grant_token failed: id_token missing in response')
  }

  return {
    id_token: data.id_token,
  }
}

async function bkashRequest<T extends Record<string, unknown>>({
  requestId,
  operation,
  path,
  body,
}: {
  requestId?: string
  operation: string
  path: string
  body: Record<string, unknown>
}) {
  const resolvedRequestId = requestId ?? createRequestId()
  const config = getBkashConfig()
  const token = await grantBkashToken(resolvedRequestId)
  const response = await fetchWithTimeout(
    toBkashUrl(config.baseUrl, path),
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: token.id_token,
        'X-App-Key': config.appKey,
      },
      body: JSON.stringify(body),
    },
    {
      operation,
      service: 'bkash',
      requestId: resolvedRequestId,
      timeoutMs: BKASH_TIMEOUT_MS,
    }
  )

  return (await parseBkashJson(response, operation)) as T
}

export async function createBkashPayment({
  amount,
  invoice,
  payerReference,
  tier,
  requestId,
}: {
  amount: number
  invoice: string
  payerReference?: string | null
  tier: string
  requestId?: string
}) {
  const config = getBkashConfig()
  const data = await bkashRequest<BkashPaymentResponse>({
    requestId,
    operation: 'bkash_create_payment',
    path: config.createPaymentPath,
    body: {
      mode: '0011',
      payerReference: payerReference || undefined,
      callbackURL: buildBkashCallbackUrl(invoice, tier),
      amount: String(amount),
      currency: 'BDT',
      intent: 'sale',
      merchantInvoiceNumber: invoice,
    },
  })

  const paymentId =
    typeof data.paymentID === 'string'
      ? data.paymentID
      : typeof data.paymentId === 'string'
        ? data.paymentId
        : null
  const checkoutUrl =
    typeof data.bkashURL === 'string'
      ? data.bkashURL
      : typeof data.bkashUrl === 'string'
        ? data.bkashUrl
        : null

  if (!paymentId || !checkoutUrl) {
    throw new Error('bkash_create_payment failed: paymentID or bkashURL missing')
  }

  logEvent('info', 'bkash_create_payment_succeeded', {
    request_id: requestId,
    payment_id: paymentId,
    merchant_invoice: invoice,
  })

  return {
    paymentId,
    checkoutUrl,
    raw: data,
  }
}

export async function executeBkashPayment({
  paymentId,
  requestId,
}: {
  paymentId: string
  requestId?: string
}) {
  const config = getBkashConfig()
  return bkashRequest<BkashPaymentResponse>({
    requestId,
    operation: 'bkash_execute_payment',
    path: config.executePaymentPath,
    body: {
      paymentID: paymentId,
    },
  })
}

export async function queryBkashPayment({
  paymentId,
  requestId,
}: {
  paymentId: string
  requestId?: string
}) {
  const config = getBkashConfig()
  return bkashRequest<BkashPaymentResponse>({
    requestId,
    operation: 'bkash_query_payment',
    path: config.queryPaymentPath,
    body: {
      paymentID: paymentId,
    },
  })
}

export function isCompletedBkashPayment(response: BkashPaymentResponse | null | undefined) {
  const status = String(response?.transactionStatus ?? '').toLowerCase()
  return status === 'completed'
}

export async function resolveBkashPayment({
  paymentId,
  requestId,
}: {
  paymentId: string
  requestId?: string
}) {
  try {
    const executed = await executeBkashPayment({ paymentId, requestId })
    if (isCompletedBkashPayment(executed)) {
      return executed
    }
  } catch (error) {
    logError('bkash_execute_payment_failed', error, {
      request_id: requestId,
      payment_id: paymentId,
    })
  }

  return queryBkashPayment({ paymentId, requestId })
}
