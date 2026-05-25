import { handleProductChat } from '@/lib/server/chat-api'
import { createRequestId, logError } from '@/lib/server/logger'
import { requireAuth } from '@/lib/auth/requireAuth'

export async function POST(req: Request) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError

  const requestId = createRequestId()

  try {
    const response = await handleProductChat(req, {
      requestId,
      product: 'qbank',
    })
    response.headers.set('x-request-id', requestId)
    return response
  } catch (error) {
    logError('qbank_image_api_error', error, { request_id: requestId, route: '/api/qbank/image' })
    const response = Response.json({ error: 'Something went wrong' }, { status: 500 })
    response.headers.set('x-request-id', requestId)
    return response
  }
}
