import { getSupabaseAdmin } from '@/lib/server/supabase-admin'

export type RetrievedPattern = {
  topic: string
  paperType: string | null
  frequency: number
  yearsAppeared: number[]
  commonQuestionTypes: string[]
  markSchemePatterns: string[]
  formulaPatterns: string[]
  commandWords: string[]
  confidence: 'high' | 'medium' | 'limited'
}

export type PatternFilters = {
  board?: string
  level?: string
  subject?: string
  paperType?: string
  topic?: string
}

function confidenceFromFrequency(frequency: number): RetrievedPattern['confidence'] {
  if (frequency >= 8) return 'high'
  if (frequency >= 4) return 'medium'
  return 'limited'
}

function fallbackPatterns(filters: PatternFilters): RetrievedPattern[] {
  const subject = filters.subject ?? 'Physics'
  const topic = filters.topic ?? (subject === 'Mathematics' ? 'Algebra' : subject === 'Chemistry' ? 'Bonding' : 'Waves')

  return [
    {
      topic,
      paperType: filters.paperType ?? null,
      frequency: 3,
      yearsAppeared: [],
      commonQuestionTypes: ['definition', 'calculation', 'explain'],
      markSchemePatterns: ['award marks for formula/keyword first, then application'],
      formulaPatterns: subject === 'Physics' ? ['v = fλ', 'W = Fd'] : subject === 'Mathematics' ? ['differentiate/integrate power rules'] : [],
      commandWords: ['state', 'calculate', 'explain'],
      confidence: 'limited',
    },
  ]
}

export async function retrievePatterns(filters: PatternFilters, limit = 8): Promise<RetrievedPattern[]> {
  let supabase
  try {
    supabase = getSupabaseAdmin()
  } catch {
    return fallbackPatterns(filters)
  }

  let query = supabase
    .from('paper_patterns')
    .select('topic,paper_type,frequency,years_appeared,common_question_types,mark_scheme_patterns,formula_patterns,command_words')
    .order('frequency', { ascending: false })
    .limit(limit)

  if (filters.board) query = query.eq('board', filters.board)
  if (filters.level) query = query.eq('level', filters.level)
  if (filters.subject) query = query.eq('subject', filters.subject)
  if (filters.paperType) query = query.eq('paper_type', filters.paperType)
  if (filters.topic) query = query.ilike('topic', `%${filters.topic}%`)

  const { data, error } = await query
  if (error || !data?.length) {
    return fallbackPatterns(filters)
  }

  return data.map((row) => {
    const frequency = Number(row.frequency ?? 0)
    return {
      topic: String(row.topic ?? filters.topic ?? 'General'),
      paperType: row.paper_type ? String(row.paper_type) : null,
      frequency,
      yearsAppeared: Array.isArray(row.years_appeared) ? row.years_appeared.map(Number).filter(Number.isFinite) : [],
      commonQuestionTypes: Array.isArray(row.common_question_types) ? row.common_question_types.map(String) : [],
      markSchemePatterns: Array.isArray(row.mark_scheme_patterns) ? row.mark_scheme_patterns.map(String) : [],
      formulaPatterns: Array.isArray(row.formula_patterns) ? row.formula_patterns.map(String) : [],
      commandWords: Array.isArray(row.command_words) ? row.command_words.map(String) : [],
      confidence: confidenceFromFrequency(frequency),
    }
  })
}
