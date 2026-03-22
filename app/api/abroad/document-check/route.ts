import { runDocumentChecklist, searchAbroadDocumentCasesWithDb } from '@/lib/server/abroad-document-cases'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const summary = typeof body?.summary === 'string' ? body.summary.trim() : ''

    if (!summary) {
      return Response.json({ error: 'Document summary is required' }, { status: 400 })
    }

    const similarCases = await searchAbroadDocumentCasesWithDb(summary, 4)
    const checklist = runDocumentChecklist(summary)

    return Response.json({
      summary,
      similarCases,
      ...checklist,
    })
  } catch (error) {
    console.error('Abroad document check API error:', error)
    return Response.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
