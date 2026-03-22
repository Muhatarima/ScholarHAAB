import { retrieveQbankContext } from '@/lib/server/qbank'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const query = typeof body?.query === 'string' ? body.query.trim() : ''

    if (!query) {
      return Response.json({ error: 'Query is required' }, { status: 400 })
    }

    const result = await retrieveQbankContext(query)
    return Response.json({
      query,
      enabled: result.enabled,
      sourceMode: result.sourceMode,
      parsedQuery: result.parsedQuery,
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
    })
  } catch (error) {
    console.error('QBank search API error:', error)
    return Response.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
