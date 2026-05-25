import { parseQbankQuery } from '@/lib/server/qbank'
import {
  searchCompiledQbankQuestions,
  searchCompiledQbankTopicFrequency,
} from '@/lib/server/qbank-compiled-questions'

export type PaperPatternAnalysis = {
  guaranteed: string[]
  veryLikely: string[]
  probable: string[]
  unlikely: string[]
  lastAppeared: Record<string, number>
  neverMissed: string[]
  board: string
  boardNote: string
}

export type ExamPredictionTopic = {
  topic: string
  confidence: number
  reason: string
  priority: 'high' | 'medium' | 'low'
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

function queryFor(subject: string, level?: string | null, paper?: string | null, board = 'cambridge') {
  const boardLabel = board === 'edexcel' ? 'Edexcel Pearson' : 'Cambridge'
  return parseQbankQuery([boardLabel, level, subject, paper].filter(Boolean).join(' '))
}

function lastYear(years: number[]) {
  return years.length ? Math.max(...years) : 0
}

function confidenceFromFrequency(frequency: number, totalYears: number) {
  if (totalYears <= 0) {
    return 50
  }
  return Math.min(96, Math.max(35, Math.round((frequency / totalYears) * 100)))
}

export async function analyzePaperPatterns(
  subject: string,
  level = 'A Level',
  paper = 'Paper 1',
  board = 'cambridge'
): Promise<PaperPatternAnalysis> {
  const parsed = queryFor(subject, level, paper, board)
  const rows = searchCompiledQbankTopicFrequency(parsed, 80)
  const scopedRows = rows.length > 0 ? rows : searchCompiledQbankTopicFrequency(queryFor(subject, level, null, board), 80)
  const years = unique(scopedRows.flatMap((row) => row.years.map(String))).map(Number)
  const recentYears = years.filter((year) => Number.isFinite(year)).sort((a, b) => a - b).slice(-10)
  const denominator = Math.max(1, recentYears.length || 10)

  const guaranteed: string[] = []
  const veryLikely: string[] = []
  const probable: string[] = []
  const unlikely: string[] = []
  const lastAppeared: Record<string, number> = {}

  for (const row of scopedRows) {
    const topicYears = unique(row.years.map(String)).map(Number)
    const recentHits = topicYears.filter((year) => recentYears.includes(year)).length || topicYears.length
    lastAppeared[row.topic] = lastYear(topicYears)

    if (recentHits >= denominator) {
      guaranteed.push(row.topic)
    } else if (recentHits >= 7) {
      veryLikely.push(row.topic)
    } else if (recentHits >= 4) {
      probable.push(row.topic)
    } else {
      unlikely.push(row.topic)
    }
  }

  return {
    guaranteed: guaranteed.slice(0, 8),
    veryLikely: veryLikely.slice(0, 10),
    probable: probable.slice(0, 10),
    unlikely: unlikely.slice(0, 10),
    lastAppeared,
    neverMissed: guaranteed.slice(0, 5),
    board,
    boardNote: board === 'edexcel'
      ? 'Edexcel IAL pattern analysis'
      : 'Cambridge CAIE pattern analysis',
  }
}

export async function predictNextExam(
  subject: string,
  level = 'A Level',
  paper = 'Paper 1',
  examYear = new Date().getFullYear(),
  board = 'cambridge'
): Promise<ExamPredictionTopic[]> {
  const parsed = queryFor(subject, level, paper, board)
  const rows = searchCompiledQbankTopicFrequency(parsed, 50)
  const candidates = rows.length > 0 ? rows : searchCompiledQbankTopicFrequency(queryFor(subject, level, null, board), 50)
  const allYears = unique(candidates.flatMap((row) => row.years.map(String))).map(Number)
  const totalYears = Math.max(1, allYears.length || 10)

  return candidates
    .map((row) => {
      const appeared = unique(row.years.map(String)).length
      const confidence = confidenceFromFrequency(appeared, totalYears)
      const last = lastYear(row.years)
      const yearsAgo = last ? Math.max(0, examYear - last) : null
      const dueSoon = yearsAgo !== null && yearsAgo >= 2

      return {
        topic: row.topic,
        confidence: dueSoon ? Math.min(98, confidence + 6) : confidence,
        reason: last
          ? `Last appeared ${yearsAgo} year${yearsAgo === 1 ? '' : 's'} ago${dueSoon ? ' - due soon' : ''}.`
          : 'Loaded as a recurring topic in the local QBank pattern index.',
        priority: confidence >= 75 ? 'high' : confidence >= 50 ? 'medium' : 'low',
      } satisfies ExamPredictionTopic
    })
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, 5)
}

export async function generateExamBriefing(subject: string, level = 'A Level', paper = 'Paper 1', board = 'cambridge') {
  const [analysis, predictions] = await Promise.all([
    analyzePaperPatterns(subject, level, paper, board),
    predictNextExam(subject, level, paper, new Date().getFullYear(), board),
  ])
  const parsed = queryFor(subject, level, paper, board)
  const examples = searchCompiledQbankQuestions(parsed, 6)

  const briefingLines = [
    `Emergency briefing: ${level} ${subject} ${paper}`,
    analysis.boardNote,
    '',
    'Focus 60% of your time on:',
    ...predictions.map((item, index) => `${index + 1}. ${item.topic} (${item.confidence}% confidence) - ${item.reason}`),
    '',
    `Guaranteed topics: ${analysis.guaranteed.length ? analysis.guaranteed.join(', ') : 'Not enough clean pattern data yet.'}`,
    `Very likely: ${analysis.veryLikely.length ? analysis.veryLikely.join(', ') : 'Use the top predictions above.'}`,
    '',
    'Common question styles:',
    ...examples.slice(0, 4).map((row, index) => `${index + 1}. ${row.topic}: ${row.question_type || 'structured response'} (${row.marks ?? '?'} marks)`),
    '',
    'Mark scheme tips:',
    '1. Use exact keywords before explanation.',
    '2. Show formulas before substitution.',
    '3. If a question asks explain, link cause to effect.',
    '',
    'Timing: skip any part that stalls you for more than 90 seconds, then return after securing easier marks.',
  ]

  if (board === 'edexcel') {
    briefingLines.push(
      '',
      'Edexcel-specific tips:',
      '1. B marks = accuracy — get the number right',
      '2. M marks = method — show every step',
      '3. A marks = answer following method — even wrong numbers get A marks if method is right',
      '4. "Hence" means use previous answer',
      '5. Draw diagrams even if not asked — often gets marks'
    )
  }

  return briefingLines.join('\n')
}
