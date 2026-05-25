import { getSupabaseAdmin } from '@/lib/server/supabase-admin'
import { logError } from '@/lib/server/logger'

export type QaFeedbackPayload = {
  query: string
  response: string
  category?: string | null
  issueType?: string | null
  autoScore?: number | null
  userFlagged?: boolean
  fixed?: boolean
  issuesJson?: unknown
  responseTimeMs?: number | null
  metadataJson?: Record<string, unknown> | null
}

type QaFeedbackRow = {
  id: string
  query: string
  response: string
  category: string | null
  issue_type: string | null
  auto_score: number | null
  user_flagged: boolean
  fixed: boolean
  created_at: string
  issues_json?: unknown
  response_time_ms?: number | null
  metadata_json?: Record<string, unknown> | null
}

function isMissingQaFeedbackTableError(error: unknown) {
  const code = (error as { code?: string })?.code
  const message = String((error as { message?: string })?.message ?? '')
  return code === '42P01' || code === 'PGRST205' || /qa_feedback/i.test(message)
}

export async function insertQaFeedback(payload: QaFeedbackPayload) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { error } = await supabaseAdmin.from('qa_feedback').insert({
      query: payload.query,
      response: payload.response,
      category: payload.category ?? null,
      issue_type: payload.issueType ?? null,
      auto_score: payload.autoScore ?? null,
      user_flagged: payload.userFlagged ?? false,
      fixed: payload.fixed ?? false,
      issues_json: payload.issuesJson ?? [],
      response_time_ms: payload.responseTimeMs ?? null,
      metadata_json: payload.metadataJson ?? {},
    })

    if (error) {
      throw error
    }

    return true
  } catch (error) {
    if (isMissingQaFeedbackTableError(error)) {
      return false
    }

    logError('qa_feedback_insert_failed', error, {
      qa_feedback_category: payload.category ?? null,
      qa_feedback_issue_type: payload.issueType ?? null,
    })
    throw error
  }
}

export async function listQaFeedbackFailures(limit = 500) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { data, error } = await supabaseAdmin
      .from('qa_feedback')
      .select(
        'id, query, response, category, issue_type, auto_score, user_flagged, fixed, created_at, issues_json, response_time_ms, metadata_json'
      )
      .or('user_flagged.eq.true,auto_score.lt.70')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      throw error
    }

    return (data ?? []) as QaFeedbackRow[]
  } catch (error) {
    if (isMissingQaFeedbackTableError(error)) {
      return []
    }

    logError('qa_feedback_list_failed', error, {
      qa_feedback_limit: limit,
    })
    throw error
  }
}
