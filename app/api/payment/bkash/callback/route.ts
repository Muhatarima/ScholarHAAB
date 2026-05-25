import { NextResponse } from 'next/server'
import { activatePaidSubscription } from '@/lib/server/payment-subscriptions'
import {
  resolveBkashPayment,
  isCompletedBkashPayment,
  isBkashConfigured,
} from '@/lib/server/bkash'
import { normalizeBkashStatus } from '@/lib/server/payment-gateway-utils'
import { createRequestId, logError, logEvent } from '@/lib/server/logger'
import { getPaymentLog, getPaymentLogStatus, updatePaymentLog } from '@/lib/server/payment-log'
import { getPlanByTier, isPlanTier } from '@/lib/server/payment-plans'
import { requireAuth } from '@/lib/auth/requireAuth'

function getAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_URL || 'https://scholarhaaab.com').replace(/\/+$/, '')
}

async function readCallbackParams(req: Request) {
  const url = new URL(req.url)
  const search = url.searchParams
  let getFormValue: ((key: string) => string | null) | null = null

  if (req.method === 'POST') {
    try {
      const formData = (await req.formData()) as unknown as {
        get(name: string): FormDataEntryValue | null
      }
      getFormValue = (key: string) => {
        const value = formData.get(key)
        return typeof value === 'string' ? value : null
      }
    } catch {
      getFormValue = null
    }
  }

  const getValue = (key: string) => {
    const searchValue = search.get(key)
    if (searchValue) {
      return searchValue
    }

    return getFormValue?.(key) ?? null
  }

  return {
    invoice: getValue('invoice'),
    tier: getValue('tier'),
    paymentId: getValue('paymentID') || getValue('paymentId'),
    status: getValue('status'),
  }
}

function redirectToPricing(state: 'success' | 'failed' | 'cancelled' | 'error') {
  return NextResponse.redirect(`${getAppUrl()}/pricing?payment=${state}&gateway=bkash`, 303)
}

async function handleBkashCallback(req: Request) {
  const requestId = createRequestId()

  try {
    if (!isBkashConfigured()) {
      const response = redirectToPricing('error')
      response.headers.set('x-request-id', requestId)
      return response
    }

    const { invoice, tier: rawTier, paymentId, status } = await readCallbackParams(req)
    const normalizedStatus = normalizeBkashStatus(status)

    if (!invoice) {
      const response = redirectToPricing('error')
      response.headers.set('x-request-id', requestId)
      return response
    }

    if (normalizedStatus === 'cancel') {
      await updatePaymentLog(invoice, { status: 'cancelled' })
      const response = redirectToPricing('cancelled')
      response.headers.set('x-request-id', requestId)
      return response
    }

    if (normalizedStatus === 'failure') {
      await updatePaymentLog(invoice, { status: 'failed' })
      const response = redirectToPricing('failed')
      response.headers.set('x-request-id', requestId)
      return response
    }

    if (!paymentId || !rawTier || !isPlanTier(rawTier)) {
      const response = redirectToPricing('error')
      response.headers.set('x-request-id', requestId)
      return response
    }

    const existingStatus = await getPaymentLogStatus(invoice)
    if (existingStatus === 'success') {
      const response = redirectToPricing('success')
      response.headers.set('x-request-id', requestId)
      return response
    }

    const paymentLog = await getPaymentLog(invoice)
    const loggedAmount = Number(paymentLog?.amount)
    if (!paymentLog?.user_id || !Number.isFinite(loggedAmount)) {
      const response = redirectToPricing('error')
      response.headers.set('x-request-id', requestId)
      return response
    }

    const plan = getPlanByTier(rawTier)
    if (loggedAmount < plan.amount) {
      await updatePaymentLog(invoice, { status: 'amount_mismatch', valId: paymentId })
      const response = redirectToPricing('failed')
      response.headers.set('x-request-id', requestId)
      return response
    }

    const settledPayment = await resolveBkashPayment({
      paymentId,
      requestId,
    })

    if (!isCompletedBkashPayment(settledPayment)) {
      await updatePaymentLog(invoice, { status: 'pending_verification', valId: paymentId })
      const response = redirectToPricing('failed')
      response.headers.set('x-request-id', requestId)
      return response
    }

    const settledAmount = Number(settledPayment.amount)
    if (!Number.isFinite(settledAmount) || settledAmount < plan.amount) {
      await updatePaymentLog(invoice, { status: 'amount_mismatch', valId: paymentId })
      const response = redirectToPricing('failed')
      response.headers.set('x-request-id', requestId)
      return response
    }

    const invoiceFromBkash = String(settledPayment.merchantInvoiceNumber ?? '')
    if (invoiceFromBkash && invoiceFromBkash !== invoice) {
      await updatePaymentLog(invoice, { status: 'invoice_mismatch', valId: paymentId })
      const response = redirectToPricing('failed')
      response.headers.set('x-request-id', requestId)
      return response
    }

    const providerSubscriptionId =
      typeof settledPayment.trxID === 'string' && settledPayment.trxID.trim()
        ? settledPayment.trxID
        : paymentId

    const { error: subError } = await activatePaidSubscription({
      userId: paymentLog.user_id,
      tier: rawTier,
      provider: 'bkash',
      providerSubscriptionId,
    })

    if (subError) {
      throw subError
    }

    await updatePaymentLog(invoice, { status: 'success', valId: providerSubscriptionId })

    logEvent('info', 'bkash_payment_succeeded', {
      request_id: requestId,
      route: '/api/payment/bkash/callback',
      invoice,
      payment_id: paymentId,
      trx_id: providerSubscriptionId,
      tier: rawTier,
      user_id: paymentLog.user_id,
    })

    const response = redirectToPricing('success')
    response.headers.set('x-request-id', requestId)
    return response
  } catch (error) {
    logError('bkash_callback_failed', error, {
      request_id: requestId,
      route: '/api/payment/bkash/callback',
    })
    const response = redirectToPricing('error')
    response.headers.set('x-request-id', requestId)
    return response
  }
}

export async function GET(req: Request) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError

  return handleBkashCallback(req)
}

export async function POST(req: Request) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError

  return handleBkashCallback(req)
}
