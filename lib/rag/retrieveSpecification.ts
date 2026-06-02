import { getSupabaseAdmin } from '@/lib/server/supabase-admin'

export type SpecificationRetrieval = {
  board: string
  level: string
  subject: string
  chapter: string
  topic: string
  learningObjectives: string[]
  specificationRef?: string | null
}

export async function retrieveSpecification(params: {
  board?: string
  level?: string
  subject?: string
  topic?: string
}): Promise<SpecificationRetrieval[]> {
  const topic = params.topic ?? ''
  try {
    const supabase = getSupabaseAdmin()
    let query = supabase
      .from('syllabus_topics')
      .select('board, level, subject, chapter, topic, learning_objectives, specification_ref')
      .limit(8)

    if (params.board) query = query.ilike('board', `%${params.board}%`)
    if (params.level) query = query.ilike('level', `%${params.level}%`)
    if (params.subject) query = query.ilike('subject', `%${params.subject}%`)
    if (topic) query = query.or(`topic.ilike.%${topic}%,chapter.ilike.%${topic}%`)

    const { data, error } = await query
    if (!error && data?.length) {
      return data.map((row) => ({
        board: String(row.board ?? params.board ?? ''),
        level: String(row.level ?? params.level ?? ''),
        subject: String(row.subject ?? params.subject ?? ''),
        chapter: String(row.chapter ?? ''),
        topic: String(row.topic ?? topic),
        learningObjectives: Array.isArray(row.learning_objectives)
          ? row.learning_objectives.map(String)
          : String(row.learning_objectives ?? '').split(';').map((item) => item.trim()).filter(Boolean),
        specificationRef: row.specification_ref ? String(row.specification_ref) : null,
      }))
    }
  } catch {
    // Empty fallback is safe; theory/formula fallbacks still cover the answer.
  }

  return []
}
