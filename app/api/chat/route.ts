import { handleProductChat } from '@/lib/server/chat-api'
import { createRequestId, logError } from '@/lib/server/logger'
import { InvalidJsonBodyError, readJsonBody } from '@/lib/server/request-body'
import { requireAuth } from '@/lib/auth/requireAuth'
import { validateQuestion } from '@/lib/validation/inputValidator'

export async function POST(req: Request) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError

    const requestId = createRequestId()

  try {
    const clonedRequest = req.clone()
    const body = await readJsonBody(req)
    try {
      if (typeof body.message === 'string' && body.message.trim()) {
        validateQuestion(body.message)
      }
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : 'Invalid message' },
        {
          status: 400,
          headers: {
            'x-request-id': requestId,
          },
        }
      )
    }
    const response = await handleProductChat(clonedRequest, {
      requestId,
      product: 'qbank',
    })
    response.headers.set('x-request-id', requestId)
    return response
  } catch (error) {
    logError('chat_api_error', error, {
      request_id: requestId,
      route_product: 'generic',
    })
    return Response.json(
      { error: error instanceof InvalidJsonBodyError ? error.message : 'Something went wrong' },
      {
        status: error instanceof InvalidJsonBodyError ? 400 : 500,
        headers: {
          'x-request-id': requestId,
        },
      }
    )
  }
}
