import { getSupabaseAdmin } from '@/lib/server/supabase-admin'

export type PastPaperQuestion = {
  id: string
  questionText: string
  markScheme: string
  marks: number
  sourceTitle: string
  subject: string
  topic: string
  year?: string | number | null
  paper?: string | null
  questionNumber?: string | number | null
}

type DocumentRow = {
  content?: unknown
  id?: unknown
  metadata?: Record<string, unknown> | null
  source_title?: unknown
  source_url?: unknown
  source_kind?: unknown
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function number(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback
}

const TOPIC_ALIASES: Record<string, string[]> = {
  electricity: ['current', 'voltage', 'resistance', 'circuit', 'ohm'],
  kinematics: ['motion', 'speed', 'velocity', 'acceleration', 'distance', 'displacement'],
  waves: ['wave', 'frequency', 'wavelength', 'amplitude', 'oscillation'],
  forces: ['force', 'newton', 'friction', 'momentum', 'weight'],
  chemistry: ['reaction', 'mole', 'acid', 'alkali', 'bonding'],
}

function normalizedWords(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function searchTerms(topic: string) {
  const normalized = normalizedWords(topic)
  const terms = new Set<string>([topic.trim(), ...normalized.split(' ').filter((word) => word.length >= 4)])

  for (const [key, aliases] of Object.entries(TOPIC_ALIASES)) {
    if (normalized.includes(key) || aliases.some((alias) => normalized.includes(alias))) {
      terms.add(key)
      aliases.forEach((alias) => terms.add(alias))
    }
  }

  return Array.from(terms).filter(Boolean).slice(0, 10)
}

function metadata(row: DocumentRow) {
  return row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const clean = text(value)
    if (clean) return clean
  }
  return ''
}

function questionFieldText(meta: Record<string, unknown>) {
  return firstText(meta.question_text, meta.question, meta.prompt, meta.stem, meta.problem)
}

function markSchemeFieldText(meta: Record<string, unknown>) {
  return firstText(
    meta.mark_scheme,
    meta.markScheme,
    meta.answer,
    meta.answer_text,
    meta.solution,
    meta.ms,
    meta.mark_scheme_text
  )
}

function hasQuestionMetadata(meta: Record<string, unknown>) {
  return Boolean(questionFieldText(meta))
}

function readableScore(value: string) {
  const letters = value.match(/[A-Za-z]/g)?.length ?? 0
  const spaces = value.match(/\s/g)?.length ?? 0
  const vowels = value.match(/[aeiouAEIOU]/g)?.length ?? 0
  const words = value.match(/\b[a-zA-Z]{2,}\b/g) ?? []
  const longWords = words.filter((word) => word.length >= 14).length
  const commonWords = words.filter((word) =>
    /^(the|and|for|with|from|this|that|when|which|what|why|how|calculate|explain|state|show|find|given|using|answer|question|force|speed|velocity|current|resistance|voltage|wave|frequency|distance|time)$/i.test(word)
  ).length

  return {
    commonWords,
    longWordRatio: words.length ? longWords / words.length : 1,
    spaceRatio: value.length ? spaces / value.length : 0,
    vowelRatio: letters ? vowels / letters : 0,
    wordCount: words.length,
  }
}

function isFormulaSheetNoise(value: string) {
  return (
    /speed of light|permittivity of free space|avogadro|boltzmann|gravitational constant|formulae uniformly accelerated motion/i.test(value) ||
    /©\s*UCLES|Turn over|Data\s+c\s*=|molar gas constant/i.test(value)
  )
}

function hasBrokenWordSpacing(value: string) {
  const clean = value.toLowerCase().replace(/\s+/g, ' ')
  const splitWordHits = clean.match(/\b[a-z]{3,}\s+[a-z]{1,2}\b/g)?.length ?? 0
  const brokenPhraseHits = clean.match(/\b[a-z]{2,}\s+[a-z]\s+[a-z]{2,}\b/g)?.length ?? 0

  return (
    splitWordHits >= 8 ||
    brokenPhraseHits >= 2 ||
    /\btate\s+m\s+ent|\belectro\s+m\s+agnetic|\bapproxim\s+ate\s+l\s+y|\bcircumf\s+erence|\bsuitab\s+le/i.test(clean)
  )
}

function isMergedQuestionChunk(value: string) {
  const clean = value.replace(/\s+/g, ' ').trim()
  const whichCount = clean.match(/\bwhich\b/gi)?.length ?? 0
  const optionRuns = clean.match(/\bA\s+B\s+C\s+D\b|\bABCD\b/gi)?.length ?? 0

  return clean.length > 900 || whichCount >= 3 || optionRuns >= 2
}

function contentLooksLikeMarkScheme(value: string) {
  return /\b(mark scheme|answer|accept|allow|award|ignore|reject|correct|incorrect|any one|m\d|a\d|b\d)\b/i.test(value)
}

function isReadableQuestionText(value: string, meta: Record<string, unknown>) {
  const clean = value.replace(/\s+/g, ' ').trim()
  if (clean.length < 18) return false
  if (isFormulaSheetNoise(clean)) return false
  if (hasBrokenWordSpacing(clean)) return false
  if (!hasQuestionMetadata(meta) && isMergedQuestionChunk(clean)) return false

  const score = readableScore(clean)
  if (score.vowelRatio < 0.22 || score.spaceRatio < 0.08 || score.longWordRatio > 0.16) {
    return false
  }

  if (hasQuestionMetadata(meta)) return true

  const hasQuestionCue = /\?|calculate|explain|state|show|find|determine|describe|why|how|what|which|fig\.|figure|diagram/i.test(clean)
  return hasQuestionCue && score.commonWords >= 2 && score.wordCount >= 8
}

function normalizeDocument(row: DocumentRow, input: { subject: string; topic: string }): PastPaperQuestion | null {
  const meta = metadata(row)
  const id = firstText(row.id, meta.id, meta.document_id)
  const content = text(row.content)
  const explicitQuestion = questionFieldText(meta)
  const explicitMarkScheme = markSchemeFieldText(meta)
  const questionText = explicitQuestion || content
  const markScheme = explicitMarkScheme || (contentLooksLikeMarkScheme(content) ? content : '')

  if (!id || !questionText || !markScheme) return null
  if (!isReadableQuestionText(questionText, meta)) return null

  return {
    id,
    markScheme,
    marks: number(meta.marks ?? meta.mark_count, 4),
    paper: firstText(meta.paper, meta.paper_code, meta.component) || null,
    questionNumber: firstText(meta.question_number, meta.questionNo, meta.qno) || null,
    questionText,
    sourceTitle: firstText(row.source_title, meta.source_title, meta.source_file) || 'Past paper',
    subject: firstText(meta.subject) || input.subject,
    topic: firstText(meta.topic) || input.topic,
    year: firstText(meta.year, meta.session) || null,
  }
}

function uniqueByQuestion(rows: PastPaperQuestion[]) {
  const seen = new Set<string>()
  return rows.filter((row) => {
    const key = row.questionText.toLowerCase().replace(/\s+/g, ' ').slice(0, 240)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

async function strictPastPaperQuery(input: {
  limit: number
  subject: string
  topic: string
}) {
  const { data, error } = await getSupabaseAdmin()
    .from('documents')
    .select('id, content, metadata, source_title, source_url, source_kind')
    .eq('metadata->>subject', input.subject)
    .eq('metadata->>topic', input.topic)
    .eq('metadata->>type', 'past_paper')
    .limit(input.limit)

  if (error) throw error
  return ((data as DocumentRow[] | null) ?? [])
}

async function fallbackTopicQuery(input: {
  limit: number
  subject: string
  topic: string
}) {
  const { data, error } = await getSupabaseAdmin()
    .from('documents')
    .select('id, content, metadata, source_title, source_url, source_kind')
    .ilike('metadata->>subject', `%${input.subject}%`)
    .ilike('metadata->>topic', `%${input.topic}%`)
    .limit(input.limit)

  if (error) throw error
  return ((data as DocumentRow[] | null) ?? [])
}

async function contentFallbackQuery(input: {
  limit: number
  subject: string
  topic: string
}) {
  const terms = searchTerms(input.topic)
  const orParts = terms.flatMap((term) => [
    `content.ilike.%${term}%`,
    `source_title.ilike.%${term}%`,
    `source_kind.ilike.%${term}%`,
    `metadata->>topic.ilike.%${term}%`,
  ])

  const subjectParts = [
    `metadata->>subject.ilike.%${input.subject}%`,
    `source_title.ilike.%${input.subject}%`,
    `source_kind.ilike.%${input.subject}%`,
    `content.ilike.%${input.subject}%`,
  ]

  const { data, error } = await getSupabaseAdmin()
    .from('documents')
    .select('id, content, metadata, source_title, source_url, source_kind')
    .or(subjectParts.join(','))
    .or(orParts.join(','))
    .limit(input.limit * 2)

  if (error) throw error
  return ((data as DocumentRow[] | null) ?? [])
}

async function broadSubjectQuery(input: {
  limit: number
  subject: string
}) {
  const { data, error } = await getSupabaseAdmin()
    .from('documents')
    .select('id, content, metadata, source_title, source_url, source_kind')
    .or(
      [
        `metadata->>subject.ilike.%${input.subject}%`,
        `source_title.ilike.%${input.subject}%`,
        `source_kind.ilike.%${input.subject}%`,
        `content.ilike.%${input.subject}%`,
      ].join(',')
    )
    .limit(input.limit)

  if (error) throw error
  return ((data as DocumentRow[] | null) ?? [])
}

function fallbackPracticeQuestions(input: { subject: string; topic: string }, limit: number): PastPaperQuestion[] {
  const subject = input.subject || 'Physics'
  const topic = input.topic || 'Waves'
  const normalizedTopic = normalizedWords(topic)
  const templates: Array<Omit<PastPaperQuestion, 'id' | 'subject' | 'topic'>> =
    normalizedTopic.includes('electric') || normalizedTopic.includes('current') || normalizedTopic.includes('resistance')
      ? [
          {
            markScheme: 'State Ohm law or use V = IR. Rearrange to I = V/R. At constant voltage, increasing resistance decreases current. Link this to resistance opposing the flow of charge.',
            marks: 4,
            questionText: 'A student increases the resistance in a circuit while keeping the supply voltage constant. Explain why the current decreases.',
            sourceTitle: 'Clean mock question bank',
          },
          {
            markScheme: 'Current is the rate of flow of charge. Use Q = It or I = Q/t. Substitute values carefully and give the unit ampere.',
            marks: 3,
            questionText: 'A charge of 24 C passes a point in a circuit in 8.0 s. Calculate the current and state the equation used.',
            sourceTitle: 'Clean mock question bank',
          },
        ]
      : normalizedTopic.includes('kinematic') || normalizedTopic.includes('motion') || normalizedTopic.includes('velocity')
        ? [
            {
              markScheme: 'Use acceleration = change in velocity / time. Substitute a = (v - u) / t. Include the correct sign for acceleration or deceleration and give the unit m/s^2.',
              marks: 4,
              questionText: 'A particle moves in a straight line. Its velocity changes from 5.0 m/s to 3.0 m/s in 2.0 s. Calculate its acceleration.',
              sourceTitle: 'Clean mock question bank',
            },
            {
              markScheme: 'Use s = ut + 1/2 at^2. Since the car starts from rest, u = 0. Substitute the values, calculate the distance, and include the unit metre.',
              marks: 4,
              questionText: 'A car starts from rest and accelerates uniformly at 2.0 m/s^2 for 6.0 s. Calculate the distance travelled.',
              sourceTitle: 'Clean mock question bank',
            },
          ]
        : [
            {
              markScheme: 'State the wave equation v = f lambda. If speed is constant, wavelength is inversely proportional to frequency. Therefore increasing frequency decreases wavelength.',
              marks: 4,
              questionText: 'State the relationship between wave speed, frequency, and wavelength. Explain what happens to wavelength when frequency increases and wave speed stays constant.',
              sourceTitle: 'Clean mock question bank',
            },
            {
              markScheme: 'Amplitude is the maximum displacement from the rest position. Frequency is the number of complete waves or oscillations per second. Frequency is measured in hertz.',
              marks: 3,
              questionText: 'Describe how amplitude and frequency are defined for a wave.',
              sourceTitle: 'Clean mock question bank',
            },
            {
              markScheme: 'Use v = f lambda. Substitute frequency and wavelength consistently, calculate the answer, and include a correct unit such as m/s.',
              marks: 4,
              questionText: 'A wave has frequency 50 Hz and wavelength 0.40 m. Calculate its speed and state the equation used.',
              sourceTitle: 'Clean mock question bank',
            },
          ]

  return Array.from({ length: limit }, (_, index) => {
    const template = templates[index % templates.length]
    return {
      ...template,
      id: `clean-${normalizedWords(subject)}-${normalizedWords(topic)}-${index + 1}`,
      questionNumber: index + 1,
      subject,
      topic,
    }
  })
}

export async function getPastPaperQuestions(input: {
  count?: number
  subject: string
  topic: string
}) {
  const limit = Math.max(1, Math.min(20, input.count ?? 10))
  let rows = await strictPastPaperQuery({ ...input, limit })

  if (!rows.length) {
    rows = await fallbackTopicQuery({ ...input, limit })
  }

  if (!rows.length) {
    rows = await contentFallbackQuery({ ...input, limit })
  }

  if (!rows.length) {
    rows = await broadSubjectQuery({ limit, subject: input.subject })
  }

  const cleanRows = uniqueByQuestion(
    rows
      .map((row) => normalizeDocument(row, input))
      .filter((row): row is PastPaperQuestion => Boolean(row))
  ).slice(0, limit)

  return cleanRows.length ? cleanRows : fallbackPracticeQuestions(input, limit)
}
