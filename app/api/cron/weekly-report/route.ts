import { GET as improvementDigestGet } from '@/app/api/cron/improvement-digest/route'
import { requireAuth } from '@/lib/auth/requireAuth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError

  return improvementDigestGet(req)
}
