import type { Product, PromptMode } from '@/lib/products'
import { updateScore } from '@/lib/analytics/leaderboard'
import {
  buildStudyProgressBadges,
  createEmptyStudyProgress,
  type DailyProgressPoint,
  type StudyProgressSnapshot,
} from '@/lib/study-progress'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'

const APP_TIMEZONE = process.env.APP_TIMEZONE ?? 'Asia/Dhaka'

export type ProfileProgressRow = {
  streak_days: number | null
  longest_streak: number | null
  total_xp: number | null
  last_active_date: string | null
}

type DailyActivityRow = {
  activity_date: string
  messages_count: number | null
  qbank_messages: number | null
  abroad_messages: number | null
  xp_earned: number | null
}

type RecordStudyActivityInput = {
  userId: string
  product: Product
  mode: PromptMode
  fileType?: string | null
  fileName?: string | null
}

function getZonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(date)
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]))

  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
  }
}

function getActivityDateString(date = new Date(), timeZone = APP_TIMEZONE) {
  const parts = getZonedParts(date, timeZone)
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

function shiftDate(dateString: string, offsetDays: number) {
  const date = new Date(`${dateString}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + offsetDays)
  return date.toISOString().slice(0, 10)
}

function isMissingProgressSchemaError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false
  }

  const record = error as { code?: string; message?: string; details?: string; hint?: string }
  const haystack = [record.message, record.details, record.hint].filter(Boolean).join(' ').toLowerCase()

  return (
    record.code === '42P01' ||
    record.code === '42703' ||
    record.code === 'PGRST205' ||
    /daily_activity|record_study_activity|streak_days|longest_streak|total_xp|last_active_date/.test(
      haystack
    )
  )
}

function getBaseProgress(row: ProfileProgressRow | null | undefined) {
  return {
    streakDays: Math.max(0, row?.streak_days ?? 0),
    longestStreak: Math.max(0, row?.longest_streak ?? 0),
    totalXp: Math.max(0, row?.total_xp ?? 0),
    lastActiveDate: row?.last_active_date ?? null,
  }
}

function toDailyPoint(row: DailyActivityRow): DailyProgressPoint {
  return {
    date: row.activity_date,
    messages: Math.max(0, row.messages_count ?? 0),
    xp: Math.max(0, row.xp_earned ?? 0),
    qbankMessages: Math.max(0, row.qbank_messages ?? 0),
    abroadMessages: Math.max(0, row.abroad_messages ?? 0),
  }
}

function buildRecentActivityWindow(rows: DailyActivityRow[], todayDate: string) {
  const byDate = new Map(rows.map((row) => [row.activity_date, toDailyPoint(row)]))

  return Array.from({ length: 7 }, (_, index) => {
    const date = shiftDate(todayDate, index - 6)
    return (
      byDate.get(date) ?? {
        date,
        messages: 0,
        xp: 0,
        qbankMessages: 0,
        abroadMessages: 0,
      }
    )
  })
}

function buildSnapshot(baseRow: ProfileProgressRow | null | undefined, rows: DailyActivityRow[]) {
  const base = getBaseProgress(baseRow)
  const todayDate = getActivityDateString()
  const recentActivity = buildRecentActivityWindow(rows, todayDate)
  const today = recentActivity.find((entry) => entry.date === todayDate)

  const snapshot: StudyProgressSnapshot = {
    ...createEmptyStudyProgress(),
    ...base,
    todayMessages: today?.messages ?? 0,
    todayXp: today?.xp ?? 0,
    weekMessages: recentActivity.reduce((sum, entry) => sum + entry.messages, 0),
    weekXp: recentActivity.reduce((sum, entry) => sum + entry.xp, 0),
    weekActiveDays: recentActivity.filter((entry) => entry.messages > 0).length,
    qbankMessages: recentActivity.reduce((sum, entry) => sum + entry.qbankMessages, 0),
    abroadMessages: recentActivity.reduce((sum, entry) => sum + entry.abroadMessages, 0),
    recentActivity,
    badges: [],
  }

  snapshot.badges = buildStudyProgressBadges(snapshot)
  return snapshot
}

function getBaseXpReward(product: Product, mode: PromptMode) {
  if (product === 'qbank') {
    return mode === 'tutor' ? 6 : 5
  }

  return 5
}

function getAttachmentBonus(fileType?: string | null, fileName?: string | null) {
  const normalizedType = (fileType ?? '').toLowerCase()
  const normalizedName = (fileName ?? '').toLowerCase()

  if (normalizedType.startsWith('image/')) {
    return 8
  }

  if (
    normalizedType === 'application/pdf' ||
    normalizedType.includes('word') ||
    normalizedType.includes('officedocument') ||
    normalizedName.endsWith('.pdf') ||
    normalizedName.endsWith('.doc') ||
    normalizedName.endsWith('.docx')
  ) {
    return 15
  }

  return 0
}

export async function fetchStudyProgressSnapshot(
  userId: string,
  baseRow?: ProfileProgressRow | null
): Promise<StudyProgressSnapshot> {
  const supabaseAdmin = getSupabaseAdmin()
  const todayDate = getActivityDateString()
  const weekStart = shiftDate(todayDate, -6)

  try {
    const { data, error } = await supabaseAdmin
      .from('daily_activity')
      .select('activity_date, messages_count, qbank_messages, abroad_messages, xp_earned')
      .eq('user_id', userId)
      .gte('activity_date', weekStart)
      .order('activity_date', { ascending: true })

    if (error) {
      throw error
    }

    return buildSnapshot(baseRow, (data as DailyActivityRow[] | null) ?? [])
  } catch (error) {
    if (isMissingProgressSchemaError(error)) {
      return buildSnapshot(baseRow, [])
    }

    throw error
  }
}

export async function recordStudyActivity({
  userId,
  product,
  mode,
  fileType,
  fileName,
}: RecordStudyActivityInput) {
  const supabaseAdmin = getSupabaseAdmin()
  const activityDate = getActivityDateString()

  try {
    const { error } = await supabaseAdmin.rpc('record_study_activity', {
      p_user_id: userId,
      p_activity_date: activityDate,
      p_product: product,
      p_base_xp: getBaseXpReward(product, mode),
      p_attachment_bonus: getAttachmentBonus(fileType, fileName),
      p_message_count: 1,
    })

    if (error) {
      throw error
    }

    const { data: profileRow, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('streak_days, longest_streak, total_xp, last_active_date')
      .eq('id', userId)
      .maybeSingle()

    if (profileError) {
      throw profileError
    }

    const typedProfile = (profileRow as ProfileProgressRow | null) ?? null
    await updateScore({
      userId,
      points: 5 + Math.max(0, Number(typedProfile?.streak_days ?? 0)),
      reason: 'daily_session',
      streakDays: Number(typedProfile?.streak_days ?? 0),
    })

    return fetchStudyProgressSnapshot(userId, typedProfile)
  } catch (error) {
    if (isMissingProgressSchemaError(error)) {
      return createEmptyStudyProgress()
    }

    throw error
  }
}
