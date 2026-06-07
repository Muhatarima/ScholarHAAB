import { POST as askPost } from '@/app/api/ask/route'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  return askPost(req)
}
