/**
 * Module 9 â€” Exam Mode (last 10 years analysis + study plan)
 * Never claims certainty â€” uses historical pattern language only.
 */
import { analyzePastPapers, type PastPaperAnalysis } from '@/lib/exam/analyzePastPapers'

export type ExamModeInput = {
  subject: string
  board: string
  level: string
  examDate?: string | null
  paperType?: string | null
  yearsBack?: number
}

export type ExamModePlan = {
  disclaimer: string
  analysis: PastPaperAnalysis
  repeatedTopics: string[]
  highProbabilityTopics: string[]
  repeatedFormulas: string[]
  repeatedQuestionStyles: string[]
  theoryRescueTopics: string[]
  studyPlan: string[]
  markdown: string
}

const DISCLAIMER =
  'High probability based on historical patterns in retrieved past papers. This is not a guarantee of what will appear on your exam.'

export async function buildExamModePlan(input: ExamModeInput): Promise<ExamModePlan> {
  const yearsBack = input.yearsBack ?? 10
  const analysis = await analyzePastPapers({
    board: input.board,
    level: input.level,
    subject: input.subject,
    paperType: input.paperType,
    yearsBack,
  })

  const repeatedTopics = analysis.repeatedTopics.slice(0, 8).map((t) => t.topic)
  const highProbabilityTopics = analysis.predictedImportantTopics
    .filter((t) => t.estimatedExamChance === 'high' || t.estimatedExamChance === 'medium')
    .map((t) => `${t.topic} (${t.estimatedExamChance} â€” ${t.whyImportant})`)

  const repeatedFormulas = analysis.recurringFormulas.slice(0, 6).map((f) => `${f.formula} [${f.topic}]`)
  const repeatedQuestionStyles = analysis.highFrequencyQuestionTypes.map((t) => t.type)

  const theoryRescueTopics = repeatedTopics.slice(0, 5)

  const daysUntil = input.examDate
    ? Math.max(1, Math.ceil((new Date(input.examDate).getTime() - Date.now()) / 86_400_000))
    : 14

  const studyPlan = [
    `Day 1â€“2: Revise top formulas â€” ${repeatedFormulas.slice(0, 3).join('; ') || 'subject formula sheet'}.`,
    `Day 3â€“5: Drill repeated topics â€” ${repeatedTopics.slice(0, 3).join(', ') || 'core syllabus'}.`,
    `Day 6â€“8: Past paper questions (${input.board} ${input.level}, last ${yearsBack} years).`,
    `Day 9â€“10: Mark scheme keyword review for ${repeatedQuestionStyles.slice(0, 2).join(' & ') || 'explanation questions'}.`,
    `Day 11â€“${daysUntil}: Timed mock + review weak topics from dashboard.`,
  ]

  const markdown = [
    `# Exam plan â€” ${input.subject} (${input.board} ${input.level})`,
    '',
    `> ${DISCLAIMER}`,
    '',
    analysis.dataLabel === 'prediction_based_on_available_data'
      ? '_Limited past paper data retrieved; predictions are conservative._'
      : `Based on ${analysis.sources.length} retrieved sources over ~${yearsBack} years._`,
    '',
    '## Repeated topics',
    ...repeatedTopics.map((t) => `- ${t}`),
    '',
    '## High probability topics',
    ...highProbabilityTopics.map((t) => `- ${t}`),
    '',
    '## Repeated formulas',
    ...repeatedFormulas.map((f) => `- ${f}`),
    '',
    '## Likely question styles',
    ...repeatedQuestionStyles.map((s) => `- ${s}`),
    '',
    '## Theory rescue (revise first)',
    ...theoryRescueTopics.map((t) => `- ${t}`),
    '',
    '## Personalized study plan',
    ...studyPlan.map((s) => `- ${s}`),
  ].join('\n')

  return {
    disclaimer: DISCLAIMER,
    analysis,
    repeatedTopics,
    highProbabilityTopics,
    repeatedFormulas,
    repeatedQuestionStyles,
    theoryRescueTopics,
    studyPlan,
    markdown,
  }
}




