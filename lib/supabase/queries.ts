import { getSupabaseAdmin } from '@/lib/server/supabase-admin'

export async function getStudentProgress(userId: string) {
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('student_progress')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (error) return []
    return data ?? []
  } catch {
    return []
  }
}

export async function saveExamPlan(userId: string, plan: Record<string, unknown>) {
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase.from('exam_plans').insert({
      user_id: userId,
      subject: plan.subject ?? 'General',
      level: plan.level ?? 'A/O Level',
      exam_date: plan.examDate ?? null,
      plan_json: plan,
    }).select('*').single()

    if (error) return null
    return data
  } catch {
    return null
  }
}
