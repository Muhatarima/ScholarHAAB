import { NextResponse } from 'next/server'
import { getPaymentLogStatus, updatePaymentLog } from '@/lib/server/payment-log'
import { fetchWithTimeout } from '@/lib/server/http-client'
import { createRequestId, logError, logEvent } from '@/lib/server/logger'
import { activatePaidSubscription } from '@/lib/server/payment-subscriptions'
import { getPlanByTier, isPlanTier } from '@/lib/server/payment-plans'
import { requireAuth } from '@/lib/auth/requireAuth'

const PAYMENT_PROVIDER_TIMEOUT_MS = Number(
  process.env.PAYMENT_PROVIDER_TIMEOUT_MS || process.env.EXTERNAL_CALL_TIMEOUT_MS || 20000
)

export async function POST(req: Request) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError

  const requestId = createRequestId()

  try {
    const data = (await req.formData()) as unknown as globalThis.FormData
    const tran_id = data.get('tran_id') as string | null
    const val_id = data.get('val_id') as string | null
    const status = data.get('status') as string | null
    const user_id = data.get('value_a') as string | null
    const tierValue = data.get('value_b')
    const tier = typeof tierValue === 'string' && isPlanTier(tierValue) ? tierValue : null
    
    // Ignore invalid/failed requests early
    if (!tran_id || !val_id || !user_id || !tier || (status !== 'VALID' && status !== 'VALIDATED')) {
      return NextResponse.json(
        { error: 'Invalid IPN data' },
        { status: 400, headers: { 'x-request-id': requestId } }
      )
    }

    const existingStatus = await getPaymentLogStatus(tran_id)
    if (existingStatus === 'success') {
      return NextResponse.json(
        { success: true, alreadyProcessed: true },
        { headers: { 'x-request-id': requestId } }
      )
    }

    const store_id = process.env.SSLCOMMERZ_STORE_ID
    const store_passwd = process.env.SSLCOMMERZ_STORE_PASSWORD
    const is_live = process.env.SSLCOMMERZ_IS_LIVE === 'true'

    if (!store_id || !store_passwd) {
      return NextResponse.json(
        { error: 'Configuration Error' },
        { status: 500, headers: { 'x-request-id': requestId } }
      )
    }

    const validation_url = is_live
      ? `https://securepay.sslcommerz.com/validator/api/validationserverAPI.php?val_id=${val_id}&store_id=${store_id}&store_passwd=${store_passwd}&format=json`
      : `https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php?val_id=${val_id}&store_id=${store_id}&store_passwd=${store_passwd}&format=json`

    // CRITICAL: Validate with SSLCommerz Server directly before activating subscription
    const validation = await fetchWithTimeout(validation_url, {}, {
      operation: 'sslcommerz_payment_validate',
      service: 'sslcommerz',
      requestId,
      timeoutMs: PAYMENT_PROVIDER_TIMEOUT_MS,
    })
    const result = await validation.json()

    if (result.status !== 'VALID' && result.status !== 'VALIDATED') {
      await updatePaymentLog(tran_id, { status: 'invalid_ipn', valId: val_id })
      return NextResponse.json(
        { error: 'Dangerous: Invalid payment validation' },
        { status: 400, headers: { 'x-request-id': requestId } }
      )
    }

    const expectedAmount = getPlanByTier(tier).amount
    const validatedAmount = Number(result.amount)
    if (!Number.isFinite(validatedAmount) || validatedAmount < expectedAmount) {
      await updatePaymentLog(tran_id, { status: 'amount_mismatch', valId: val_id })
      return NextResponse.json(
        { error: 'Amount mismatch' },
        { status: 400, headers: { 'x-request-id': requestId } }
      )
    }

    const { error: subError } = await activatePaidSubscription({
      userId: user_id,
      tier,
      provider: 'sslcommerz',
      providerSubscriptionId: val_id,
    })

    if (subError) {
      logError('payment_ipn_subscription_insert_failed', subError, {
        request_id: requestId,
        route: '/api/payment/ipn',
        transaction_id: tran_id,
        user_id,
      })
      return NextResponse.json(
        { error: 'Failed to insert subscription' },
        { status: 500, headers: { 'x-request-id': requestId } }
      )
    }

    await updatePaymentLog(tran_id, { status: 'success', valId: val_id })

    logEvent('info', 'payment_ipn_succeeded', {
      request_id: requestId,
      route: '/api/payment/ipn',
      transaction_id: tran_id,
      user_id,
      tier,
      validated_amount: validatedAmount,
    })
    return NextResponse.json({ success: true }, { headers: { 'x-request-id': requestId } })
  } catch (err) {
    logError('payment_ipn_failed', err, {
      request_id: requestId,
      route: '/api/payment/ipn',
    })
    return NextResponse.json(
      { error: 'IPN webhook error' },
      { status: 500, headers: { 'x-request-id': requestId } }
    )
  }
}
