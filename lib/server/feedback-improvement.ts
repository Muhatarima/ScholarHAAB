import { getSupabaseAdmin } from '@/lib/server/supabase-admin'
import { insertQaFeedback } from '@/lib/server/qa-feedback'
import { logError } from '@/lib/server/logger'

export type FeedbackSource = {
  title: string
  url?: string | null
  tier?: string | null
  lastChecked?: string | null
}

export type FeedbackPayload = {
  userId: string
  product: string | null
  mode: string | null
  sessionId: string | null
  question: string
  answer: string
  rating: 'thumbs_up' | 'thumbs_down'
  note?: string | null
  sources?: FeedbackSource[]
}

type FeedbackRow = {
  id: number
  product: string | null
  question: string
  answer: string
  rating: 'thumbs_up' | 'thumbs_down'
  note: string | null
}

function isMissingFeedbackTableError(error: unknown) {
  const code = (error as { code?: string })?.code
  const message = String((error as { message?: string })?.message ?? '')
  return code === '42P01' || code === 'PGRST205' || /feedback|model_improvement_queue/i.test(message)
}

function normalize(text: string) {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

function classifyIssue(question: string, answer: string, note?: string | null) {
  const combined = normalize(`${question} ${answer} ${note ?? ''}`)

  if (/\bwrong|incorrect|mistake|false|hallucinat|not true\b/.test(combined)) {
    return {
      issueType: 'accuracy',
      priority: 'high',
      targetBehavior: 'Use retrieved sources first, avoid unsupported claims, and state uncertainty clearly.',
    }
  }

  if (/\btoo long|too much|wordy|lengthy\b/.test(combined)) {
    return {
      issueType: 'verbosity',
      priority: 'medium',
      targetBehavior: 'Keep the answer concise and front-load the highest-signal help.',
    }
  }

  if (/\bnot clear|confusing|hard to understand\b/.test(combined)) {
    return {
      issueType: 'clarity',
      priority: 'medium',
      targetBehavior: 'Use simpler structure and clearer step-by-step reasoning.',
    }
  }

  if (/\brude|tone|cold|robotic\b/.test(combined)) {
    return {
      issueType: 'tone',
      priority: 'low',
      targetBehavior: 'Answer in a warm, human, supportive way without sounding fake.',
    }
  }

  return {
    issueType: 'general_quality',
    priority: 'medium',
    targetBehavior: 'Improve usefulness, specificity, and grounding for similar future answers.',
  }
}

export async function insertFeedback(payload: FeedbackPayload) {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('feedback')
    .insert({
      user_id: payload.userId,
      session_id: payload.sessionId,
      product: payload.product,
      mode: payload.mode,
      question: payload.question,
      answer: payload.answer,
      rating: payload.rating,
      note: payload.note ?? null,
      sources_json: payload.sources ?? [],
      improvement_status: payload.rating === 'thumbs_down' ? 'queued' : 'not_needed',
    })
    .select('id')
    .single()

  if (error) {
    throw error
  }

  const feedbackId = Number((data as { id: number }).id)

  if (payload.rating === 'thumbs_down') {
    const classification = classifyIssue(payload.question, payload.answer, payload.note)
    await supabaseAdmin.from('model_improvement_queue').insert({
      feedback_id: feedbackId,
      product: payload.product ?? 'unknown',
      issue_type: classification.issueType,
      priority: classification.priority,
      prompt_input: payload.question,
      bad_answer: payload.answer,
      target_behavior: classification.targetBehavior,
      suggested_fix: payload.note ?? null,
      export_ready: true,
    })

    try {
      await insertQaFeedback({
        query: payload.question,
        response: payload.answer,
        category: payload.product ?? 'unknown',
        issueType: classification.issueType,
        userFlagged: true,
        issuesJson: payload.note ? [{ type: 'USER_NOTE', note: payload.note }] : [],
        metadataJson: {
          mode: payload.mode ?? null,
          sessionId: payload.sessionId ?? null,
          sources: payload.sources ?? [],
        },
      })
    } catch (error) {
      // Feedback capture should not fail the main thumbs-down pipeline.
      logError('qa_feedback_side_write_failed', error, {
        feedback_product: payload.product ?? 'unknown',
        feedback_rating: payload.rating,
      })
    }
  }

  return feedbackId
}

export async function buildImprovementDigest(limit = 100) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { data, error } = await supabaseAdmin
      .from('feedback')
      .select('id, product, question, answer, rating, note')
      .eq('rating', 'thumbs_down')
      .eq('reviewed', false)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) {
      throw error
    }

    const rows = ((data as FeedbackRow[] | null) ?? []).map((row) => {
      const classification = classifyIssue(row.question, row.answer, row.note)
      return {
        ...row,
        ...classification,
      }
    })

    return rows
  } catch (error) {
    if (isMissingFeedbackTableError(error)) {
      return []
    }
    throw error
  }
}

export async function markFeedbackReviewed(feedbackIds: number[]) {
  if (feedbackIds.length === 0) {
    return
  }

  try {
    const supabaseAdmin = getSupabaseAdmin()
    await supabaseAdmin
      .from('feedback')
      .update({ reviewed: true })
      .in('id', feedbackIds)
  } catch (error) {
    if (isMissingFeedbackTableError(error)) {
      return
    }
    throw error
  }
}
