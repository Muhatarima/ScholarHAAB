import { handleProductChat } from '@/lib/server/chat-api'
import { createRequestId, logError } from '@/lib/server/logger'
import { requireAuth } from '@/lib/auth/requireAuth'
import { validateQuestion } from '@/lib/validation/inputValidator'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function withRequestId(response: Response, requestId: string) {
  response.headers.set('x-request-id', requestId)
  return response
}

function buildPayloadFromSearchParams(searchParams: URLSearchParams) {
  const rawMessage = searchParams.get('message')?.trim() ?? ''
  const message = rawMessage ? validateQuestion(rawMessage) : ''
  if (!message) {
    return null
  }

  const subject = searchParams.get('subject')?.trim() ?? ''
  const level = searchParams.get('level')?.trim() ?? ''
  const userId = searchParams.get('user_id')?.trim() ?? ''

  return {
    message,
    subject: subject || null,
    level: level || null,
    user_id: userId || null,
  }
}

async function buildJsonRequest(req: Request, body: Record<string, unknown>) {
  const headers = new Headers(req.headers)
  headers.set('Content-Type', 'application/json')
  headers.delete('content-length')

  return new Request(req.url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

async function buildStreamResponse(req: Request, payload: Record<string, unknown>, requestId: string) {
  const response = await handleProductChat(await buildJsonRequest(req, payload), {
    requestId,
    product: 'qbank',
  })

  let json: Record<string, unknown>
  try {
    json = (await response.json()) as Record<string, unknown>
  } catch (error) {
    logError('qbank_stream_invalid_json', error, {
      request_id: requestId,
      route: '/api/qbank/chat/stream',
    })
    return withRequestId(
      Response.json({ error: 'Invalid chat response.' }, { status: 502 }),
      requestId
    )
  }

  if (!response.ok) {
    return withRequestId(Response.json(json, { status: response.status }), requestId)
  }

  const answer = typeof json.answer === 'string' ? json.answer.trim() : ''
  if (!answer) {
    return withRequestId(
      Response.json({ error: 'Chat response did not include an answer.' }, { status: 502 }),
      requestId
    )
  }

  const meta = Object.fromEntries(
    Object.entries(json).filter(([key]) => key !== 'answer' && key !== 'response')
  )

  const encoder = new TextEncoder()
  const words = answer.split(/\s+/).filter(Boolean)

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const word of words) {
        controller.enqueue(encoder.encode(`data: ${word} \n\n`))
        await new Promise((resolve) => setTimeout(resolve, 30))
      }

      controller.enqueue(encoder.encode(`data: [META]${JSON.stringify(meta)}\n\n`))
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })

  return withRequestId(
    new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    }),
    requestId
  )
}

export async function GET(req: Request) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError

  const requestId = createRequestId()
  const url = new URL(req.url)
  let payload: ReturnType<typeof buildPayloadFromSearchParams>

  try {
    payload = buildPayloadFromSearchParams(url.searchParams)
  } catch (error) {
    return withRequestId(
      Response.json(
        { error: error instanceof Error ? error.message : 'Invalid message' },
        { status: 400 }
      ),
      requestId
    )
  }

  if (!payload) {
    return withRequestId(Response.json({ error: 'message is required' }, { status: 400 }), requestId)
  }

  try {
    return await buildStreamResponse(req, payload, requestId)
  } catch (error) {
    logError('qbank_stream_get_failed', error, {
      request_id: requestId,
      route: '/api/qbank/chat/stream',
    })
    return withRequestId(Response.json({ error: 'Something went wrong' }, { status: 500 }), requestId)
  }
}

export async function POST(req: Request) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError

  const requestId = createRequestId()
  let body: Record<string, unknown>

  try {
    body = (await req.json()) as Record<string, unknown>
  } catch (error) {
    logError('qbank_stream_invalid_json', error, {
      request_id: requestId,
      route: '/api/qbank/chat/stream',
    })
    return withRequestId(Response.json({ error: 'Invalid JSON body' }, { status: 400 }), requestId)
  }

  if (typeof body.message !== 'string' || !body.message.trim()) {
    return withRequestId(Response.json({ error: 'message is required' }, { status: 400 }), requestId)
  }

  try {
    body.message = validateQuestion(body.message)
  } catch (error) {
    return withRequestId(
      Response.json(
        { error: error instanceof Error ? error.message : 'Invalid message' },
        { status: 400 }
      ),
      requestId
    )
  }

  try {
    return await buildStreamResponse(req, body, requestId)
  } catch (error) {
    logError('qbank_stream_post_failed', error, {
      request_id: requestId,
      route: '/api/qbank/chat/stream',
    })
    return withRequestId(Response.json({ error: 'Something went wrong' }, { status: 500 }), requestId)
  }
}
