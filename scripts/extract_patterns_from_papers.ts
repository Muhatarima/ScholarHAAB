import { analyzeQuestion } from '../lib/paper-solver/questionAnalyzer'
import { getSupabaseAdmin } from '../lib/server/supabase-admin'

type QuestionRow = {
  id: string
  board: string | null
  level: string | null
  subject: string | null
  topic: string | null
  chapter: string | null
  paper_type: string | null
  year: number | null
  question_text: string | null
  marks: number | null
  mark_schemes?: Array<{
    answer_text: string | null
    mark_points: string[] | null
    examiner_notes: string | null
  }>
}

type PatternGroup = {
  key: string
  board: string
  level: string
  subject: string
  topic: string
  chapter: string | null
  paperType: string | null
  questionType: string
  commandWord: string
  marks: number[]
  years: number[]
  sampleQuestionIds: string[]
  keywords: Map<string, number>
  mistakes: Map<string, number>
}

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'from',
  'answer',
  'mark',
  'marks',
  'must',
  'allow',
  'award',
  'one',
  'two',
])

function addCount(map: Map<string, number>, value: string) {
  const clean = value.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!clean || STOP_WORDS.has(clean) || clean.length < 3) return
  map.set(clean, (map.get(clean) ?? 0) + 1)
}

function extractKeywords(row: QuestionRow) {
  const text = [
    row.question_text,
    ...(row.mark_schemes ?? []).flatMap((scheme) => [
      scheme.answer_text,
      ...(scheme.mark_points ?? []),
      scheme.examiner_notes,
    ]),
  ].filter(Boolean).join(' ')

  text.split(/\s+/).forEach((word) => addCount(new Map(), word))
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3 && !STOP_WORDS.has(word))
}

function topValues(map: Map<string, number>, limit = 10) {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value]) => value)
}

function groupKey(row: QuestionRow, analysis: ReturnType<typeof analyzeQuestion>) {
  return [
    row.board ?? analysis.board ?? 'Cambridge',
    row.level ?? analysis.level ?? 'O Level',
    row.subject ?? analysis.subject ?? 'General',
    row.topic ?? analysis.topic ?? analysis.chapter ?? 'General',
    row.paper_type ?? analysis.paperType ?? '',
    analysis.questionType,
    analysis.commandWord,
  ].join('|')
}

function rangeFromMarks(marks: number[]) {
  if (!marks.length) return null
  const min = Math.min(...marks)
  const max = Math.max(...marks)
  return `[${min},${max + 1})`
}

function reasoningPattern(group: PatternGroup) {
  if (group.questionType === 'calculation') return 'Formula, substitution, rearrangement, final answer with unit.'
  if (group.questionType === 'experiment design') return 'Apparatus/method, control variables, repeats, mean, graph/analysis if needed.'
  if (group.commandWord === 'explain') return 'Cause, mechanism, effect, conclusion linked to the question.'
  if (group.commandWord === 'compare') return 'Point for A, point for B, direct similarity/difference.'
  return 'Definition or concept, application, exam keyword.'
}

async function main() {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('questions')
    .select('id, board, level, subject, topic, chapter, paper_type, year, question_text, marks, mark_schemes(answer_text, mark_points, examiner_notes)')
    .order('year', { ascending: false })
    .limit(5000)

  if (error) throw error
  const groups = new Map<string, PatternGroup>()

  for (const row of (data ?? []) as QuestionRow[]) {
    if (!row.question_text) continue
    const analysis = analyzeQuestion(row.question_text)
    const key = groupKey(row, analysis)
    const existing = groups.get(key) ?? {
      key,
      board: row.board ?? analysis.board ?? 'Cambridge',
      level: row.level ?? analysis.level ?? 'O Level',
      subject: row.subject ?? analysis.subject ?? 'General',
      topic: row.topic ?? analysis.topic ?? analysis.chapter ?? 'General',
      chapter: row.chapter ?? analysis.chapter,
      paperType: row.paper_type ?? analysis.paperType,
      questionType: analysis.questionType,
      commandWord: analysis.commandWord,
      marks: [],
      years: [],
      sampleQuestionIds: [],
      keywords: new Map<string, number>(),
      mistakes: new Map<string, number>(),
    }

    if (typeof row.marks === 'number') existing.marks.push(row.marks)
    if (typeof row.year === 'number' && !existing.years.includes(row.year)) existing.years.push(row.year)
    if (existing.sampleQuestionIds.length < 20) existing.sampleQuestionIds.push(row.id)
    extractKeywords(row).forEach((keyword) => addCount(existing.keywords, keyword))
    for (const scheme of row.mark_schemes ?? []) {
      if (scheme.examiner_notes) addCount(existing.mistakes, scheme.examiner_notes)
    }
    groups.set(key, existing)
  }

  const paperPatterns = Array.from(groups.values()).map((group) => ({
    board: group.board,
    level: group.level,
    subject: group.subject,
    topic: group.topic,
    chapter: group.chapter,
    paper_type: group.paperType,
    question_type: group.questionType,
    command_word: group.commandWord,
    marks_range: rangeFromMarks(group.marks),
    years_appeared: group.years,
    frequency: group.sampleQuestionIds.length,
    sample_question_ids: group.sampleQuestionIds,
    mark_scheme_keywords: topValues(group.keywords, 12),
    common_mistakes: topValues(group.mistakes, 6),
    reasoning_pattern: reasoningPattern(group),
    confidence: Math.min(89, 50 + group.sampleQuestionIds.length * 4),
    common_question_types: [group.questionType],
    command_words: [group.commandWord],
    updated_at: new Date().toISOString(),
  }))

  const markSchemePatterns = Array.from(groups.values()).map((group) => ({
    subject: group.subject,
    topic: group.topic,
    question_type: group.questionType,
    command_word: group.commandWord,
    required_points: topValues(group.keywords, 8),
    optional_points: [],
    common_wrong_answers: topValues(group.mistakes, 6),
    mark_allocation_pattern:
      group.questionType === 'calculation'
        ? ['Formula mark [1]', 'Substitution mark [1]', 'Answer mark [1]', 'Unit mark [1]']
        : group.questionType === 'experiment design'
          ? ['Method [1]', 'Control variable [1]', 'Repeat/mean [1]', 'Analysis [1]']
          : ['Concept [1]', 'Cause/mechanism [1]', 'Effect [1]', 'Conclusion [1]'],
    examiner_keywords: topValues(group.keywords, 10),
    updated_at: new Date().toISOString(),
  }))

  if (paperPatterns.length) {
    const { error: paperError } = await supabase.from('paper_patterns').upsert(paperPatterns, {
      onConflict: 'board,level,subject,topic,paper_type,question_type,command_word',
    })
    if (paperError) throw paperError
  }

  if (markSchemePatterns.length) {
    const { error: schemeError } = await supabase.from('mark_scheme_patterns').upsert(markSchemePatterns, {
      onConflict: 'subject,topic,question_type,command_word',
    })
    if (schemeError) throw schemeError
  }

  console.log(`Extracted ${paperPatterns.length} paper patterns and ${markSchemePatterns.length} mark scheme patterns.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
