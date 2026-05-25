import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { resolveRequestIdentity } from '@/lib/server/auth'
import { createBkashPayment, isBkashConfigured, isBkashEnabled } from '@/lib/server/bkash'
import { insertPendingPaymentLog } from '@/lib/server/payment-log'
import { fetchWithTimeout } from '@/lib/server/http-client'
import { createRequestId, logError, logEvent } from '@/lib/server/logger'
import { getPlanByTier, isPlanTier } from '@/lib/server/payment-plans'
import { readJsonBody } from '@/lib/server/request-body'
import { getStudentProfile } from '@/lib/server/profile'
import { requireAuth } from '@/lib/auth/requireAuth'

const PAYMENT_PROVIDER_TIMEOUT_MS = Number(
  process.env.PAYMENT_PROVIDER_TIMEOUT_MS || process.env.EXTERNAL_CALL_TIMEOUT_MS || 20000
)

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_URL || 'https://scholarhaaab.com'
}

function isSslcommerzEnabled() {
  return process.env.ENABLE_SSLCOMMERZ !== 'false'
}

export async function POST(req: Request) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError

  const requestId = createRequestId()

  try {
    const cookieStore = await cookies()
    const identity = await resolveRequestIdentity(cookieStore, req.headers)

    if (!identity.isAuthenticated || !identity.authUserId) {
      return NextResponse.json({ error: 'Please log in to continue' }, { status: 401 })
    }

    const body = await readJsonBody(req)
    const tier = body.tier
    const gateway = body.gateway === 'bkash' ? 'bkash' : 'sslcommerz'
    if (!isPlanTier(tier)) {
      return NextResponse.json(
        { error: 'Invalid plan selected' },
        { status: 400, headers: { 'x-request-id': requestId } }
      )
    }

    const plan = getPlanByTier(tier)
    const app_url = getAppUrl()
    const transactionPrefix = gateway === 'bkash' ? 'BKASH' : 'TRN'
    const tran_id = `${transactionPrefix}_${Date.now()}_${identity.authUserId.substring(0, 8)}`

    await insertPendingPaymentLog({
      tranId: tran_id,
      userId: identity.authUserId,
      amount: plan.amount,
    })

    if (gateway === 'bkash') {
      if (!isBkashEnabled()) {
        return NextResponse.json(
          { error: 'bKash checkout is disabled right now' },
          { status: 400, headers: { 'x-request-id': requestId } }
        )
      }

      if (!isBkashConfigured()) {
        return NextResponse.json(
          { error: 'bKash gateway not configured' },
          { status: 500, headers: { 'x-request-id': requestId } }
        )
      }

      const payment = await createBkashPayment({
        amount: plan.amount,
        invoice: tran_id,
        tier,
        payerReference: null,
        requestId,
      })

      return NextResponse.json(
        { url: payment.checkoutUrl, gateway: 'bkash' },
        { headers: { 'x-request-id': requestId } }
      )
    }

    if (!isSslcommerzEnabled()) {
      return NextResponse.json(
        { error: 'Card / SSLCommerz checkout is disabled right now' },
        { status: 400, headers: { 'x-request-id': requestId } }
      )
    }

    const store_id = process.env.SSLCOMMERZ_STORE_ID
    const store_passwd = process.env.SSLCOMMERZ_STORE_PASSWORD
    const is_live = process.env.SSLCOMMERZ_IS_LIVE === 'true'

    if (!store_id || !store_passwd) {
      return NextResponse.json(
        { error: 'Payment gateway not configured' },
        { status: 500, headers: { 'x-request-id': requestId } }
      )
    }

    const api_url = is_live 
      ? 'https://securepay.sslcommerz.com/gwprocess/v4/api.php'
      : 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php'
    const profile = await getStudentProfile(identity.authUserId)

    const form = new URLSearchParams()
    form.append('store_id', store_id)
    form.append('store_passwd', store_passwd)
    form.append('total_amount', plan.amount.toString())
    form.append('currency', plan.currency)
    form.append('tran_id', tran_id)
    form.append('success_url', `${app_url}/api/payment/success`)
    form.append('fail_url', `${app_url}/pricing?payment=failed`)
    form.append('cancel_url', `${app_url}/pricing?payment=cancelled`)
    form.append('cus_name', profile.fullName || 'Student')
    form.append('cus_email', profile.email || 'student@scholorhaab.com')
    form.append('cus_add1', 'Dhaka')
    form.append('cus_city', 'Dhaka')
    form.append('cus_country', profile.nationality || 'Bangladesh')
    form.append('cus_phone', '01700000000')
    form.append('shipping_method', 'NO')
    form.append('product_name', `ScholarHAAB ${tier} Plan`)
    form.append('product_category', 'Subscription')
    form.append('product_profile', 'non-physical-goods')
    form.append('value_a', identity.authUserId)
    form.append('value_b', tier)

    const response = await fetchWithTimeout(api_url, {
      method: 'POST',
      body: form,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }, {
      operation: 'sslcommerz_payment_initiate',
      service: 'sslcommerz',
      requestId,
      timeoutMs: PAYMENT_PROVIDER_TIMEOUT_MS,
    })

    const data = await response.json()
    if (data.status === 'SUCCESS' && data.GatewayPageURL) {
      logEvent('info', 'payment_initiate_succeeded', {
        request_id: requestId,
        route: '/api/payment/initiate',
        user_id: identity.authUserId,
        tier,
        gateway: 'sslcommerz',
        transaction_id: tran_id,
      })
      return NextResponse.json(
        { url: data.GatewayPageURL, gateway: 'sslcommerz' },
        { headers: { 'x-request-id': requestId } }
      )
    }

    logEvent('warn', 'payment_initiate_failed', {
      request_id: requestId,
      route: '/api/payment/initiate',
      user_id: identity.authUserId,
      tier,
      gateway: 'sslcommerz',
      transaction_id: tran_id,
      provider_status: data.status ?? 'unknown',
    })
    return NextResponse.json(
      { error: 'Payment gateway failed to initialize.' },
      { status: 400, headers: { 'x-request-id': requestId } }
    )
  } catch (err) {
    logError('payment_initiate_failed', err, {
      request_id: requestId,
      route: '/api/payment/initiate',
    })
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500, headers: { 'x-request-id': requestId } }
    )
  }
}
