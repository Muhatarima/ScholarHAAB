import { reviewDocument } from '@/lib/server/document-review'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const documentType = body?.documentType
    const content = typeof body?.content === 'string' ? body.content.trim() : ''

    if (documentType !== 'sop' && documentType !== 'lor' && documentType !== 'cv') {
      return Response.json({ error: 'Valid document type is required' }, { status: 400 })
    }

    if (!content) {
      return Response.json({ error: 'Document content is required' }, { status: 400 })
    }

    return Response.json(reviewDocument(documentType, content))
  } catch (error) {
    console.error('Abroad review API error:', error)
    return Response.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
