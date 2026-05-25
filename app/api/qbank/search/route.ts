import { retrieveQbankContext } from '@/lib/server/qbank'
import { createRequestId, logError } from '@/lib/server/logger'
import { requireAuth } from '@/lib/auth/requireAuth'
import { validateQuestion } from '@/lib/validation/inputValidator'

export async function POST(req: Request) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError

  const requestId = createRequestId()
  let body: unknown

  try {
    body = await req.json()
  } catch (error) {
    logError('qbank_search_json_parse_failed', error, {
      request_id: requestId,
      route_product: 'qbank_search',
    })
    return Response.json(
      { error: 'Invalid request body' },
      {
        status: 400,
        headers: {
          'x-request-id': requestId,
        },
      }
    )
  }

  const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}

  try {
    const rawQuery = typeof payload.query === 'string' ? payload.query.trim() : ''

    if (!rawQuery) {
      return Response.json(
        { error: 'Query is required' },
        {
          status: 400,
          headers: {
            'x-request-id': requestId,
          },
        }
      )
    }

    let query: string
    try {
      query = validateQuestion(rawQuery)
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : 'Invalid query' },
        {
          status: 400,
          headers: {
            'x-request-id': requestId,
          },
        }
      )
    }

    const result = await retrieveQbankContext(query)
    return Response.json(
      {
        query,
        enabled: result.enabled,
        sourceMode: result.sourceMode,
        parsedQuery: result.parsedQuery,
        repeatMatches: result.repeatMatches,
        conceptMatches: result.conceptMatches,
        topicMatches: result.topicMatches,
        questionMatches: result.questionMatches,
        paperMatches: result.paperMatches,
        paperPairMatches: result.paperPairMatches,
        pdfChunkMatches: result.pdfChunkMatches,
        gapMatches: result.gapMatches,
        blockedRecoveryMatches: result.blockedRecoveryMatches,
        nearbyResourceMatches: result.nearbyResourceMatches,
        sourceMatches: result.sourceMatches,
        chunks: result.chunks,
      },
      {
        headers: {
          'x-request-id': requestId,
        },
      }
    )
  } catch (error) {
    logError('qbank_search_api_error', error, {
      request_id: requestId,
      route_product: 'qbank_search',
    })
    return Response.json(
      { error: 'Something went wrong' },
      {
        status: 500,
        headers: {
          'x-request-id': requestId,
        },
      }
    )
  }
}
