import { getSupabaseAdmin } from '@/lib/server/supabase-admin'

export type RetrievedMarkScheme = {
  answerText: string
  markPoints: string[]
  sourcePdfUrl: string | null
}

export async function retrieveMarkScheme(questionId: string): Promise<RetrievedMarkScheme | null> {
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('mark_schemes')
      .select('answer_text, mark_points, source_pdf_url')
      .eq('question_id', questionId)
      .maybeSingle()

    if (error || !data) return null

    const row = data as { answer_text?: string | null; mark_points?: unknown; source_pdf_url?: string | null }
    return {
      answerText: row.answer_text ?? '',
      markPoints: Array.isArray(row.mark_points) ? row.mark_points.filter((point): point is string => typeof point === 'string') : [],
      sourcePdfUrl: row.source_pdf_url ?? null,
    }
  } catch {
    return null
  }
}
