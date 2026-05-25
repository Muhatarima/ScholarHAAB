import { NextResponse } from 'next/server'
import { getAiServiceHealth } from '@/lib/ai-service'
import { requireAuth } from '@/lib/auth/requireAuth'

export async function GET(req: Request) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError

  return NextResponse.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      ai: getAiServiceHealth(),
    },
    error: null,
  })
}
