import { getSupabaseAdmin } from '@/lib/server/supabase-admin'
import { trackSkip, trackWeak, trackConfident } from '@/lib/analytics/topicTracker'

type ProfileLike = {
  level?: string | null
  board?: string | null
}

function isMissingTable(error: unknown) {
  const code = (error as { code?: string })?.code
  const message = String((error as { message?: string })?.message ?? '')
  return code === '42P01' || code === 'PGRST205' || /schema cache|does not exist/i.test(message)
}

export async function trackSolvedTopic(input: {
  userId: string
  subject: string
  topic: string
  isCorrect?: boolean
  confidenceScore?: number
  profile?: ProfileLike
}) {
  const { userId, subject, topic, isCorrect, confidenceScore = 50, profile } = input
  const correct = Boolean(isCorrect ?? confidenceScore >= 70)

  try {
    const supabase = getSupabaseAdmin()
    const level = profile?.level || 'A Level'
    const board = profile?.board || 'Cambridge'
    const { data: existing, error: existingError } = await supabase
      .from('student_topic_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('level', level)
      .eq('board', board)
      .eq('subject', subject)
      .eq('topic', topic)
      .maybeSingle()

    if (existingError && !isMissingTable(existingError)) throw existingError
    if (existingError && isMissingTable(existingError)) throw existingError

    const attempted = Number(existing?.attempted_count ?? 0) + 1
    const correctCount = Number(existing?.correct_count ?? 0) + (correct ? 1 : 0)
    const wrongCount = Number(existing?.wrong_count ?? 0) + (correct ? 0 : 1)
    const accuracy = Math.round((correctCount / Math.max(1, attempted)) * 100)
    const weakScore = Math.max(
      0,
      Math.min(100, Number(existing?.weak_score ?? 0) + (correct ? -8 : 16) + (confidenceScore < 50 ? 8 : 0))
    )

    const payload = {
      user_id: userId,
      level,
      board,
      subject,
      topic,
      attempted_count: attempted,
      correct_count: correctCount,
      wrong_count: wrongCount,
      accuracy,
      confidence_score: Math.max(0, Math.min(100, confidenceScore)),
      weak_score: weakScore,
      last_practiced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('student_topic_progress')
      .upsert(payload, { onConflict: 'user_id,level,board,subject,topic' })

    if (error) throw error
  } catch (error) {
    if (!isMissingTable(error)) {
      console.error('trackSolvedTopic failed:', error)
    }
  }

  if (correct) {
    await trackConfident(userId, subject, topic)
  } else {
    await trackWeak(userId, subject, topic)
  }
}

export async function trackLearningGap(input: {
  userId: string
  subject: string
  skippedChapter: string
  currentTopic?: string | null
  detectedFromMessage: string
  profile?: ProfileLike
}) {
  const { userId, subject, skippedChapter, currentTopic, detectedFromMessage, profile } = input
  try {
    const supabase = getSupabaseAdmin()
    const level = profile?.level || 'A Level'
    const board = profile?.board || 'Cambridge'
    let existingQuery = supabase
      .from('student_learning_gaps')
      .select('id, detection_count')
      .eq('user_id', userId)
      .eq('level', level)
      .eq('board', board)
      .eq('skipped_chapter', skippedChapter)

    existingQuery = currentTopic
      ? existingQuery.eq('current_topic', currentTopic)
      : existingQuery.is('current_topic', null)

    const { data: existing, error: existingError } = await existingQuery.maybeSingle()

    if (existingError && !isMissingTable(existingError)) throw existingError
    if (existingError && isMissingTable(existingError)) throw existingError

    const payload = {
      user_id: userId,
      level,
      board,
      subject,
      skipped_chapter: skippedChapter,
      current_topic: currentTopic || null,
      detected_from_message: detectedFromMessage,
      detection_count: Number(existing?.detection_count ?? 0) + 1,
      status: 'active',
      updated_at: new Date().toISOString(),
    }

    const { error } = existing?.id
      ? await supabase.from('student_learning_gaps').update(payload).eq('id', existing.id)
      : await supabase.from('student_learning_gaps').insert(payload)

    if (error) throw error
  } catch (error) {
    if (!isMissingTable(error)) {
      console.error('trackLearningGap failed:', error)
    }
  }

  await trackSkip(userId, subject, skippedChapter)
}
