import { getSupabaseAdmin } from '@/lib/server/supabase-admin'

export type LeaderboardReason = 'correct_answer' | 'topic_confident' | 'daily_session' | 'streak_bonus' | 'manual'

export type LeaderboardRow = {
  id: string
  user_id: string
  display_name: string | null
  total_score: number
  topics_mastered: number
  streak_days: number
  updated_at: string
}

type UpdateScoreInput = {
  userId: string | null | undefined
  displayName?: string | null
  points?: number
  reason?: LeaderboardReason
  topicsMasteredDelta?: number
  streakDays?: number
}

function isMissingLeaderboard(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const record = error as { code?: string; message?: string; details?: string; hint?: string }
  const haystack = [record.message, record.details, record.hint].filter(Boolean).join(' ').toLowerCase()
  return record.code === '42P01' || record.code === 'PGRST205' || haystack.includes('leaderboard')
}

async function resolveDisplayName(userId: string, fallback?: string | null) {
  if (fallback?.trim()) return fallback.trim()

  try {
    const supabase = getSupabaseAdmin()
    const { data } = await supabase.from('profiles').select('full_name, email').eq('id', userId).maybeSingle()
    const row = data as { full_name?: string | null; email?: string | null } | null
    return row?.full_name || row?.email?.split('@')[0] || 'Student'
  } catch {
    return 'Student'
  }
}

export async function updateScore(input: UpdateScoreInput) {
  const userId = input.userId
  if (!userId) return null

  const points = Math.max(0, Math.round(input.points ?? 0))
  const topicsMasteredDelta = Math.max(0, Math.round(input.topicsMasteredDelta ?? 0))
  const streakDays = Math.max(0, Math.round(input.streakDays ?? 0))
  const supabase = getSupabaseAdmin()

  try {
    const { data: current, error: currentError } = await supabase
      .from('leaderboard')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (currentError && !isMissingLeaderboard(currentError)) throw currentError
    if (currentError && isMissingLeaderboard(currentError)) return null

    const currentRow = current as LeaderboardRow | null
    const displayName = await resolveDisplayName(userId, input.displayName ?? currentRow?.display_name)
    const next = {
      user_id: userId,
      display_name: displayName,
      total_score: Math.max(0, Number(currentRow?.total_score ?? 0) + points),
      topics_mastered: Math.max(0, Number(currentRow?.topics_mastered ?? 0) + topicsMasteredDelta),
      streak_days: Math.max(Number(currentRow?.streak_days ?? 0), streakDays),
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase.from('leaderboard').upsert(next, { onConflict: 'user_id' }).select('*').single()
    if (error) throw error
    return data as LeaderboardRow
  } catch (error) {
    if (isMissingLeaderboard(error)) return null
    console.error('updateScore failed:', error)
    return null
  }
}

export async function getLeaderboard(limit = 10) {
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('leaderboard')
      .select('*')
      .order('total_score', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(Math.max(1, Math.min(50, limit)))

    if (error) throw error
    return (data ?? []) as LeaderboardRow[]
  } catch (error) {
    if (isMissingLeaderboard(error)) return []
    console.error('getLeaderboard failed:', error)
    return []
  }
}

export async function getUserRank(userId: string | null | undefined) {
  if (!userId) return null

  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('leaderboard')
      .select('user_id, total_score')
      .order('total_score', { ascending: false })
      .order('updated_at', { ascending: false })

    if (error) throw error
    const rows = (data ?? []) as Array<{ user_id: string; total_score: number }>
    const index = rows.findIndex((row) => row.user_id === userId)
    if (index < 0) return null
    return { rank: index + 1, score: Number(rows[index]?.total_score ?? 0) }
  } catch (error) {
    if (isMissingLeaderboard(error)) return null
    console.error('getUserRank failed:', error)
    return null
  }
}
