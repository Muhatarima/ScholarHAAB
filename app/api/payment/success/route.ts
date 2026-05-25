import { NextResponse } from 'next/server'
import { createRequestId, logError } from '@/lib/server/logger'
import { requireAuth } from '@/lib/auth/requireAuth'

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_URL || 'https://scholarhaaab.com'
}

export async function POST(req: Request) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError

  const requestId = createRequestId()

  try {
    const data = (await req.formData()) as unknown as globalThis.FormData
    const status = data.get('status')
    
    const app_url = getAppUrl()

    if (status === 'VALID' || status === 'SUCCESS') {
      const response = NextResponse.redirect(`${app_url}/pricing?payment=success`, 303)
      response.headers.set('x-request-id', requestId)
      return response
    }

    const response = NextResponse.redirect(`${app_url}/pricing?payment=failed`, 303)
    response.headers.set('x-request-id', requestId)
    return response
  } catch (err) {
    logError('payment_success_redirect_failed', err, {
      request_id: requestId,
      route: '/api/payment/success',
    })
    const response = NextResponse.redirect('/pricing?payment=error', 303)
    response.headers.set('x-request-id', requestId)
    return response
  }
}
