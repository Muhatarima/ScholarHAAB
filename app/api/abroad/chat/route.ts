import { handleProductChat } from '@/lib/server/chat-api'

export async function POST(req: Request) {
  try {
    return await handleProductChat(req, {
      product: 'abroad',
      forceMode: 'direct',
    })
  } catch (error) {
    console.error('Abroad chat API error:', error)
    return Response.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
