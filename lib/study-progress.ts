export const STUDY_PROGRESS_UPDATED_EVENT = 'scholarhaab:study-progress-updated'

export type DailyProgressPoint = {
  date: string
  messages: number
  xp: number
  qbankMessages: number
  abroadMessages: number
}

export type StudyProgressSnapshot = {
  streakDays: number
  longestStreak: number
  totalXp: number
  lastActiveDate: string | null
  todayMessages: number
  todayXp: number
  weekMessages: number
  weekXp: number
  weekActiveDays: number
  qbankMessages: number
  abroadMessages: number
  recentActivity: DailyProgressPoint[]
  badges: string[]
}

export function createEmptyStudyProgress(): StudyProgressSnapshot {
  return {
    streakDays: 0,
    longestStreak: 0,
    totalXp: 0,
    lastActiveDate: null,
    todayMessages: 0,
    todayXp: 0,
    weekMessages: 0,
    weekXp: 0,
    weekActiveDays: 0,
    qbankMessages: 0,
    abroadMessages: 0,
    recentActivity: [],
    badges: [],
  }
}

export function buildStudyProgressBadges(
  progress: Pick<
    StudyProgressSnapshot,
    'streakDays' | 'longestStreak' | 'totalXp' | 'weekMessages' | 'qbankMessages' | 'abroadMessages'
  >
) {
  const badges: string[] = []

  if (progress.totalXp > 0) {
    badges.push('First Step')
  }
  if (progress.streakDays >= 3 || progress.longestStreak >= 3) {
    badges.push('3-Day Streak')
  }
  if (progress.streakDays >= 7 || progress.longestStreak >= 7) {
    badges.push('Week Warrior')
  }
  if (progress.totalXp >= 500) {
    badges.push('Rising Star')
  }
  if (progress.totalXp >= 2000) {
    badges.push('Champion')
  }
  if (progress.weekMessages >= 10) {
    badges.push('Consistent Learner')
  }
  if (progress.qbankMessages >= 15) {
    badges.push('QBank Regular')
  }
  if (progress.abroadMessages >= 10) {
    badges.push('Abroad Explorer')
  }

  return badges.slice(0, 6)
}
