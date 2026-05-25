import { NextResponse } from 'next/server'
import {
  buildImprovementDigest,
  markFeedbackReviewed,
} from '@/lib/server/feedback-improvement'
import { createRequestId, logError } from '@/lib/server/logger'
import { requireAuth } from '@/lib/auth/requireAuth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError

  const requestId = createRequestId()

  try {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized Cron Invocation' },
        { status: 401, headers: { 'x-request-id': requestId } }
      )
    }

    const digest = await buildImprovementDigest(100)
    await markFeedbackReviewed(digest.map((item) => item.id))

    return NextResponse.json({
      success: true,
      processed: digest.length,
      byIssueType: Object.fromEntries(
        Object.entries(
          digest.reduce<Record<string, number>>((acc, item) => {
            acc[item.issueType] = (acc[item.issueType] ?? 0) + 1
            return acc
          }, {})
        ).sort((a, b) => b[1] - a[1])
      ),
      items: digest,
    }, {
      headers: { 'x-request-id': requestId },
    })
  } catch (err) {
    logError('improvement_digest_failed', err, {
      request_id: requestId,
      route: '/api/cron/improvement-digest',
    })
    return NextResponse.json(
      { error: 'Improvement digest failed' },
      { status: 500, headers: { 'x-request-id': requestId } }
    )
  }
}
