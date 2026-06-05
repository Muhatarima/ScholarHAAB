/**
 * Module 8 — Human Tutor Mode
 * Structure: short answer → why → exam tip → mark scheme keywords → common mistake
 */

export type TutorFormatInput = {
  shortAnswer: string
  whyItWorks: string
  examTip: string
  markSchemeKeywords: string[]
  commonMistake: string
  confidenceBadge?: string | null
  sourceLabel?: string | null
  practiceNext?: string | null
}

export function formatHumanTutorResponse(input: TutorFormatInput): string {
  const keywords =
    input.markSchemeKeywords.length > 0
      ? input.markSchemeKeywords.slice(0, 8).join(', ')
      : 'Use syllabus keywords from the mark scheme.'

  const sections = [
    input.confidenceBadge?.trim() || null,
    input.sourceLabel ? `_Source: ${input.sourceLabel}_` : null,
    '',
    '**Short answer**',
    input.shortAnswer.trim(),
    '',
    '**Why it works**',
    input.whyItWorks.trim(),
    '',
    '**Exam tip**',
    input.examTip.trim(),
    '',
    '**Mark scheme keywords**',
    keywords,
    '',
    '**Common mistake**',
    input.commonMistake.trim(),
    input.practiceNext ? `\n**Practice next:** ${input.practiceNext.trim()}` : null,
  ].filter((line) => line !== null)

  return sections.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

export function tutorFormatFromSolver(input: {
  answer: string
  examinerTip: string
  commonMistake: string
  markSchemePoints: string[]
  reasoningSteps?: string[]
  confidenceBadge?: string | null
  sourceBasisLabel?: string | null
  practiceNext?: string | null
}): string {
  const why =
    input.reasoningSteps?.length
      ? input.reasoningSteps.slice(0, 4).join(' ')
      : 'This follows examiner mark allocation: method, working, then final answer with correct units where needed.'

  return formatHumanTutorResponse({
    shortAnswer: input.answer.split('\n').find((line) => line.trim() && !line.startsWith('VERIFIED') && !line.startsWith('PATTERN')) ?? input.answer.slice(0, 400),
    whyItWorks: why,
    examTip: input.examinerTip,
    markSchemeKeywords: input.markSchemePoints,
    commonMistake: input.commonMistake,
    confidenceBadge: input.confidenceBadge,
    sourceLabel: input.sourceBasisLabel,
    practiceNext: input.practiceNext,
  })
}
