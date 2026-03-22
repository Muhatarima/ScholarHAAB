import { handleProductChat } from '@/lib/server/chat-api'
import { isProduct } from '@/lib/products'

export async function POST(req: Request) {
  try {
    const clonedRequest = req.clone()
    const { product } = await req.json()
    return await handleProductChat(clonedRequest, {
      product: isProduct(product) ? product : 'abroad',
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return Response.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
