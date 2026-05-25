import { getSupabaseAdmin } from '@/lib/server/supabase-admin'
import { loadStudentMemory } from '@/lib/memory/studentMemory'
import { parseQbankQuery } from '@/lib/server/qbank'
import {
  searchCompiledQbankQuestions,
  searchCompiledQbankTopicFrequency,
  type CompiledQbankQuestionRow,
} from '@/lib/server/qbank-compiled-questions'

export type PredictionLabel = 'GUARANTEED' | 'VERY_LIKELY' | 'PROBABLE' | 'UNLIKELY'

export type TopicFrequencyReport = {
  subject: string
  level: string
  paper: string
  analysis: Record<
    string,
    {
      appearances: number
      years: number[]
      missing_years: number[]
      avg_marks: number
      question_types: string[]
      last_appeared: number | null
      frequency: string
      prediction: PredictionLabel
      typical_marks: string
    }
  >
}

export type TopicFrequencyAnalysis = TopicFrequencyReport

export type TopicPattern = {
  topic: string
  patterns: string[]
  mustKnowFormulas: string[]
  typicalStructure: string
  commandWords: Record<string, number>
  typicalMarks: string
  subtopics: string[]
}

export type QuestionPatternAnalysis = TopicPattern

export type ExamPrediction = {
  topic: string
  probability: number
  reasoning: string
  lastAppeared: number | null
  lastYear: number | null
  prediction: PredictionLabel
  recommendation: 'HIGH PRIORITY' | 'MEDIUM PRIORITY' | 'LOW PRIORITY'
  avgMarks: number
  dueSoon: boolean
  mustKnowFormulas: string[]
  typicalQuestionStyle: string
  studentFlag?: string
}

export type TopicPrediction = ExamPrediction

export type CriticalAlert = {
  topic: string
  subject: string
  probability: number
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM'
  message: string
  priorityScore: number
}

const FORMULA_HINTS: Record<string, string[]> = {
  waves: ['v = fλ', 'path difference = nλ'],
  electricity: ['V = IR', 'P = IV', 'E = VQ'],
  circuits: ['V = IR', 'P = IV', 'R_total = R1 + R2'],
  forces: ['F = ma', 'W = mg'],
  momentum: ['p = mv', 'Ft = Δp'],
  thermal: ['Q = mcΔT', 'pV = nRT'],
  integration: ['∫x^n dx = x^(n+1)/(n+1) + C'],
  differentiation: ['d/dx(x^n) = nx^(n-1)'],
  moles: ['n = m/Mr', 'c = n/V'],
}

function getAdminClientOrNull() {
  try {
    return getSupabaseAdmin()
  } catch {
    return null
  }
}

function normalize(text: string | null | undefined) {
  return String(text ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values))
}

function lastYear(years: number[]) {
  return years.length ? Math.max(...years) : null
}

function yearWindow(targetYear = new Date().getFullYear()) {
  const end = Math.min(targetYear - 1, 2024)
  const start = Math.max(2010, end - 9)
  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
}

function predictionFromFrequency(appearances: number, denominator: number): PredictionLabel {
  const ratio = denominator > 0 ? appearances / denominator : 0
  if (ratio >= 0.9) {
    return 'GUARANTEED'
  }
  if (ratio >= 0.7) {
    return 'VERY_LIKELY'
  }
  if (ratio >= 0.4) {
    return 'PROBABLE'
  }
  return 'UNLIKELY'
}

function probabilityFromFrequency(
  appearances: number,
  denominator: number,
  lastAppeared: number | null,
  targetYear: number,
  avgMarks: number
) {
  const base = denominator > 0 ? Math.round((appearances / denominator) * 100) : 35
  const dueBoost = lastAppeared && targetYear - lastAppeared >= 2 ? 5 : 0
  const marksBoost = Math.min(7, Math.round(avgMarks / 2))
  return Math.min(97, Math.max(20, base + dueBoost + marksBoost))
}

function commandWords(rows: CompiledQbankQuestionRow[]) {
  const counts: Record<string, number> = {}
  for (const row of rows) {
    const match = /\b(calculate|explain|describe|state|define|sketch|show|determine|suggest|compare)\b/i.exec(
      row.question_text
    )
    const word = match?.[1]?.toLowerCase() ?? row.question_type?.toLowerCase() ?? 'structured'
    counts[word] = (counts[word] ?? 0) + 1
  }
  return counts
}

function commandWordSummary(counts: Record<string, number>) {
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0) || 1
  return Object.entries(counts)
    .sort((left, right) => right[1] - left[1])
    .map(([word, count]) => `${word}(${Math.round((count / total) * 100)}%)`)
    .join(', ')
}

function formulaHintsForTopic(topic: string) {
  const normalized = normalize(topic)
  const formulas = Object.entries(FORMULA_HINTS)
    .filter(([key]) => normalized.includes(key) || key.includes(normalized))
    .flatMap(([, value]) => value)
  return formulas.length ? unique(formulas) : ['Use the formula stated or implied by the mark scheme.']
}

function questionRowsFor(subject: string, level: string, paper?: string | null, topic?: string | null, limit = 500) {
  const parsed = parseQbankQuery(['Cambridge', level, subject, paper, topic].filter(Boolean).join(' '))
  return searchCompiledQbankQuestions(parsed, limit)
}

async function tryQuestionRowsFromSupabase(subject: string, level: string, paper: string, years: number[]) {
  const supabase = getAdminClientOrNull()
  if (!supabase) {
    return [] as CompiledQbankQuestionRow[]
  }

  try {
    const { data, error } = await supabase
      .from('questions')
      .select('id, level, subject, year, session, paper, question_number, question_text, mark_scheme, topic, subtopic, marks, difficulty')
      .eq('subject', subject)
      .eq('level', level)
      .eq('paper', paper)
      .gte('year', years[0] ?? 2010)
      .lte('year', years[years.length - 1] ?? 2024)

    if (error || !Array.isArray(data)) {
      return []
    }

    return data.map((row): CompiledQbankQuestionRow => ({
      id: String(row.id ?? ''),
      board: 'Cambridge',
      level: String(row.level ?? level),
      subject: String(row.subject ?? subject),
      year: typeof row.year === 'number' ? row.year : Number(row.year) || null,
      session: typeof row.session === 'string' ? row.session : null,
      paper: typeof row.paper === 'string' ? row.paper : paper,
      paper_code: typeof row.paper === 'string' ? row.paper : paper,
      question_number: typeof row.question_number === 'string' ? row.question_number : null,
      question_text: String(row.question_text ?? ''),
      options: [],
      answer: typeof row.mark_scheme === 'string' ? row.mark_scheme : null,
      solution: typeof row.mark_scheme === 'string' ? row.mark_scheme : null,
      page_start: null,
      page_end: null,
      topic: String(row.topic ?? 'Unclassified'),
      marks: typeof row.marks === 'number' ? row.marks : Number(row.marks) || null,
      question_type: 'structured',
      source_pdf: '',
      source_url: null,
      answer_source_url: null,
      link_quality: 'unknown',
      link_confidence: 'medium',
      answer_ready: Boolean(row.mark_scheme),
      repeat_group_id: null,
      frequency: 1,
    }))
  } catch {
    return []
  }
}

async function cacheExamPrediction(
  subject: string,
  level: string,
  paper: string,
  targetYear: number,
  report: TopicFrequencyReport,
  predictions: ExamPrediction[]
) {
  const supabase = getAdminClientOrNull()
  if (!supabase) {
    return
  }

  try {
    await supabase.from('exam_predictions').upsert(
      {
        subject,
        level,
        paper,
        analysis_year: targetYear,
        topic_frequencies: report.analysis,
        predicted_topics: predictions,
      },
      { onConflict: 'subject,level,paper,analysis_year' }
    )
  } catch {
    // Cache failures should never block analysis.
  }
}

export async function analyzeTopicFrequency(
  subject: string,
  level = 'A Level',
  paper = 'Paper 2'
): Promise<TopicFrequencyReport> {
  const years = yearWindow()
  const parsed = parseQbankQuery(['Cambridge', level, subject, paper].filter(Boolean).join(' '))
  const topicRows = searchCompiledQbankTopicFrequency(parsed, 120)
  const supabaseRows = await tryQuestionRowsFromSupabase(subject, level, paper, years)
  const compiledRows = questionRowsFor(subject, level, paper, null, 800)
  const questionRows = supabaseRows.length ? supabaseRows : compiledRows
  const discoveredYears = unique(
    topicRows
      .flatMap((row) => row.years)
      .concat(questionRows.map((row) => row.year).filter((year): year is number => year !== null))
  )
    .filter((year) => years.includes(year))
    .sort((left, right) => left - right)
  const allYears = discoveredYears.length ? discoveredYears.slice(-10) : years
  const denominator = Math.max(1, allYears.length)
  const topicsFromQuestions = unique(questionRows.map((row) => row.topic).filter(Boolean))
  const topicNames = unique([...topicRows.map((row) => row.topic), ...topicsFromQuestions])
  const analysis: TopicFrequencyReport['analysis'] = {}

  for (const topic of topicNames) {
    const topicRow = topicRows.find((row) => normalize(row.topic) === normalize(topic))
    const topicQuestions = questionRows.filter((row) => normalize(row.topic) === normalize(topic))
    const questionYears = topicQuestions
      .map((row) => row.year)
      .filter((year): year is number => year !== null && allYears.includes(year))
    const yearsAppeared = unique([...(topicRow?.years ?? []), ...questionYears])
      .filter((year) => allYears.includes(year))
      .sort((left, right) => left - right)
    const marks = topicQuestions
      .map((row) => row.marks)
      .filter((mark): mark is number => typeof mark === 'number' && Number.isFinite(mark) && mark > 0)
    const avgMarks = marks.length
      ? Number((marks.reduce((sum, mark) => sum + mark, 0) / marks.length).toFixed(1))
      : 0
    const missingYears = allYears.filter((year) => !yearsAppeared.includes(year))
    const appearances = yearsAppeared.length
    const prediction = predictionFromFrequency(appearances, denominator)
    const questionTypes = unique(topicQuestions.map((row) => row.question_type || 'structured').filter(Boolean))

    analysis[topic] = {
      appearances,
      years: yearsAppeared,
      missing_years: missingYears,
      avg_marks: avgMarks,
      question_types: questionTypes.length ? questionTypes : ['structured'],
      last_appeared: lastYear(yearsAppeared),
      frequency: `${Math.round((appearances / denominator) * 100)}%`,
      prediction,
      typical_marks: marks.length ? `${Math.min(...marks)}-${Math.max(...marks)} marks` : 'Marks vary by paper',
    }
  }

  return { subject, level, paper, analysis }
}

export async function getTopicPatterns(subject: string, topic: string, level = 'A Level'): Promise<TopicPattern> {
  const rows = questionRowsFor(subject, level, null, topic, 120).filter(
    (row) => normalize(row.topic).includes(normalize(topic)) || normalize(row.question_text).includes(normalize(topic))
  )
  const counts = commandWords(rows)
  const marks = rows
    .map((row) => row.marks)
    .filter((mark): mark is number => typeof mark === 'number' && Number.isFinite(mark) && mark > 0)
  const commandSummary = commandWordSummary(counts)
  const topType = Object.entries(counts).sort((left, right) => right[1] - left[1])[0]?.[0] ?? 'structured'
  const subtopics = unique(rows.map((row) => row.topic).filter(Boolean)).slice(0, 8)

  return {
    topic,
    patterns: [
      rows.length
        ? `${topic} appears in ${rows.length} indexed questions across recent compiled papers.`
        : `${topic} has limited indexed question coverage, so treat predictions as lower confidence.`,
      commandSummary ? `Command words: ${commandSummary}` : 'Command words are mixed across structured questions.',
      marks.length
        ? `Typical mark allocation clusters around ${Math.round(marks.reduce((sum, mark) => sum + mark, 0) / marks.length)} marks.`
        : 'Mark allocation varies because local mark data is incomplete.',
      `${topType} questions are the most common detected style.`,
    ],
    mustKnowFormulas: formulaHintsForTopic(topic),
    typicalStructure: marks.length
      ? `Part a) core recall/definition, Part b) ${topType}, usually ${Math.min(...marks)}-${Math.max(...marks)} marks.`
      : `Part a) recall, Part b) ${topType}, then a mark-scheme wording check.`,
    commandWords: counts,
    typicalMarks: marks.length ? `${Math.min(...marks)}-${Math.max(...marks)} marks` : 'Unknown',
    subtopics,
  }
}

export async function findQuestionPatterns(subject: string, level: string, topic: string) {
  return getTopicPatterns(subject, topic, level)
}

export async function generateExamPredictions(
  subject: string,
  level = 'A Level',
  paper = 'Paper 2',
  targetYear = new Date().getFullYear()
): Promise<ExamPrediction[]> {
  const frequency = await analyzeTopicFrequency(subject, level, paper)
  const predictions = await Promise.all(
    Object.entries(frequency.analysis).map(async ([topic, data]) => {
      const probability = probabilityFromFrequency(
        data.appearances,
        10,
        data.last_appeared,
        targetYear,
        data.avg_marks
      )
      const pattern = await getTopicPatterns(subject, topic, level)
      return {
        topic,
        probability,
        reasoning: `Appeared ${data.appearances}/10 years${data.missing_years.length ? `, missing ${data.missing_years.join(', ')}` : ''}.`,
        lastAppeared: data.last_appeared,
        lastYear: data.last_appeared,
        prediction: data.prediction,
        recommendation:
          probability >= 75
            ? 'HIGH PRIORITY'
            : probability >= 50
              ? 'MEDIUM PRIORITY'
              : 'LOW PRIORITY',
        avgMarks: data.avg_marks,
        dueSoon: Boolean(data.last_appeared && targetYear - data.last_appeared >= 2),
        mustKnowFormulas: pattern.mustKnowFormulas,
        typicalQuestionStyle: pattern.typicalStructure,
      } satisfies ExamPrediction
    })
  )

  const sorted = predictions.sort((left, right) => right.probability - left.probability).slice(0, 10)
  await cacheExamPrediction(subject, level, paper, targetYear, frequency, sorted)
  return sorted
}

export async function generateTopicPredictions(
  subject: string,
  level = 'A Level',
  paper = 'Paper 2',
  targetYear = new Date().getFullYear()
) {
  const predictions = await generateExamPredictions(subject, level, paper, targetYear)
  return {
    targetYear,
    predictions,
    studyPriority: predictions.slice(0, 8).map((item) => item.topic),
  }
}

export async function crossReferenceWithStudent(
  studentId: string,
  subject: string,
  level: string,
  paper: string
): Promise<CriticalAlert[]> {
  const { detectWeakPoints } = await import('@/lib/progress/progressEngine')
  const [predictions, weakPoints] = await Promise.all([
    generateExamPredictions(subject, level, paper),
    detectWeakPoints(studentId),
  ])
  const weakMap = new Map(weakPoints.map((point) => [normalize(point.topic), point]))

  const alerts: CriticalAlert[] = []
  for (const prediction of predictions) {
      const weak = weakMap.get(normalize(prediction.topic))
      if (!weak || prediction.probability < 60) {
        continue
      }
      const severity = prediction.probability >= 80 || weak.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH'
      alerts.push({
        topic: prediction.topic,
        subject,
        probability: prediction.probability,
        severity,
        message: `${prediction.topic}: ${prediction.probability}% exam probability + your ${weak.severity.toLowerCase()} weak area`,
        priorityScore: prediction.probability + (weak.severity === 'CRITICAL' ? 25 : weak.severity === 'HIGH' ? 15 : 5),
      })
  }

  return alerts.sort((left, right) => right.priorityScore - left.priorityScore)
}

export async function compareWithStudentProgress(studentId: string, predictions: TopicPrediction[]) {
  const memory = await loadStudentMemory(studentId)
  const weakSet = new Set(memory.weakTopics.map(normalize))

  return predictions.map((prediction) => {
    const isWeak = weakSet.has(normalize(prediction.topic))
    return {
      ...prediction,
      studentFlag:
        isWeak && prediction.probability >= 70
          ? 'CRITICAL: High exam probability + your weak area'
          : isWeak
            ? 'Weak area - schedule practice'
            : prediction.studentFlag,
    }
  })
}

export async function buildTenYearDashboardAnalysis(input: {
  studentId: string
  subject: string
  level: string
  paper: string
  targetYear?: number
}) {
  const predictions = await generateTopicPredictions(
    input.subject,
    input.level,
    input.paper,
    input.targetYear ?? new Date().getFullYear()
  )
  const compared = await compareWithStudentProgress(input.studentId, predictions.predictions)

  return {
    ...predictions,
    predictions: compared,
    frequency: await analyzeTopicFrequency(input.subject, input.level, input.paper),
  }
}
