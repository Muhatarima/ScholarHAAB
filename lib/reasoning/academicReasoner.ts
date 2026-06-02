import type { SearchResult } from '@/lib/rag/ragSystem'
import { detectDependencyGaps } from '@/lib/reasoning/conceptDependencyGraph'
import { detectMisconceptions } from '@/lib/reasoning/misconceptionDetector'
import { decomposeQuestion } from '@/lib/reasoning/questionDecomposer'
import { reasonLikeExaminer } from '@/lib/reasoning/examinerReasoner'

export type AcademicReasoningInput = {
  question: string
  normalizedQuestion?: string
  subject?: string | null
  topic?: string | null
  sources?: SearchResult[]
  weakOrSkippedConcepts?: string[]
}

export type AcademicReasoning = {
  label: 'Verified Reasoning' | 'Reasoned Solution'
  decomposition: ReturnType<typeof decomposeQuestion>
  examiner: ReturnType<typeof reasonLikeExaminer>
  misconceptions: ReturnType<typeof detectMisconceptions>
  dependencyGaps: ReturnType<typeof detectDependencyGaps>
  evidenceSummary: string
  consultantFormat: {
    directAnswer: string
    why: string
    examTip: string
    keywords: string[]
    commonMistake: string
  }
}

function evidenceSummary(sources: SearchResult[] = []) {
  if (!sources.length) return 'No exact verified source found; reasoning uses syllabus/formula/pattern knowledge.'
  const best = sources[0]
  return `Best evidence: ${best.board} ${best.level} ${best.subject} ${best.year} ${best.paper} Q${best.question_number}.`
}

export function buildAcademicReasoning(input: AcademicReasoningInput): AcademicReasoning {
  const question = input.normalizedQuestion || input.question
  const decomposition = decomposeQuestion(question, { subject: input.subject, topic: input.topic })
  const examiner = reasonLikeExaminer(decomposition)
  const misconceptions = detectMisconceptions(question, decomposition.subject ?? input.subject)
  const dependencyGaps = detectDependencyGaps(decomposition.concepts, input.weakOrSkippedConcepts ?? [])
  const verified = Boolean(input.sources?.[0]?.mark_scheme || input.sources?.[0]?.mark_scheme_points?.length)
  const keywords = examiner.expectedKeywords.slice(0, 6)

  return {
    label: verified ? 'Verified Reasoning' : 'Reasoned Solution',
    decomposition,
    examiner,
    misconceptions,
    dependencyGaps,
    evidenceSummary: evidenceSummary(input.sources),
    consultantFormat: {
      directAnswer: decomposition.questionType === 'calculation' ? 'Use the formula/method first, then substitute.' : 'Answer directly using the syllabus keyword first.',
      why: examiner.examinerSummary,
      examTip: `For ${decomposition.topic ?? 'this topic'}, marks come from ${examiner.requiredSteps.slice(0, 2).join(' + ')}.`,
      keywords,
      commonMistake: misconceptions[0]?.correction ?? examiner.commonLostMarks[0] ?? 'Skipping the exam keyword.',
    },
  }
}

export function formatReasoningOverlay(reasoning: AcademicReasoning) {
  const mistake = reasoning.misconceptions[0]
  const gap = reasoning.dependencyGaps[0]

  return [
    '',
    `${reasoning.label}:`,
    `Examiner expectation: ${reasoning.examiner.examinerSummary}`,
    `Mark scheme keywords: ${reasoning.examiner.expectedKeywords.slice(0, 5).join(', ')}`,
    mistake ? `${mistake.alert} ${mistake.correction}` : `Common mistake: ${reasoning.examiner.commonLostMarks[0] ?? 'missing the exact keyword'}.`,
    gap ? `Prerequisite check: ${gap.recommendation}` : '',
    `Exam tip: ${reasoning.consultantFormat.examTip}`,
  ]
    .filter(Boolean)
    .join('\n')
}
