/**
 * ScholarHAAB end-to-end pipeline:
 * Input → OCR/Vision → Question Analyzer → Board/Level/Topic → Retrievals → Examiner Reasoning → Tutor Response
 */

import type { ProcessedMultimodalInput } from '@/lib/input/multimodalProcessor'
import { processTextInput, processImageBuffer, processPdfBuffer } from '@/lib/input/multimodalProcessor'
import { understandQuestion, type QuestionUnderstandingResult } from '@/lib/question-understanding/engine'
import { solveWithPatternPipeline, type PatternSolveResult } from '@/lib/paper-solver/solvePipeline'
import { buildAcademicReasoning, formatReasoningOverlay } from '@/lib/reasoning/academicReasoner'
import { filterResponse } from '@/lib/ai/qualityFilter'
import type { PaperSolveProfile } from '@/lib/paper-solver/solvePipeline'

export type PipelineInput = {
  text?: string
  image?: { buffer: Buffer; mimeType: string; fileName: string }
  pdf?: Buffer
  profile: PaperSolveProfile
}

export type ScholarPipelineResult = {
  multimodal: ProcessedMultimodalInput | null
  understanding: QuestionUnderstandingResult
  solve: PatternSolveResult | null
  answer: string
  confidence: PatternSolveResult['confidence'] | 'AI_REASONING'
  confidenceScore: number
  pipelineTrace: string[]
}

function buildRepeatedAnswer(insight: NonNullable<QuestionUnderstandingResult['repeated']>) {
  const lines = [
    `# ${insight.topic} — repeated exam patterns (${insight.subject}, last ${insight.yearsAnalyzed} years)`,
    '',
    '## Repeated question themes',
    ...insight.repeatedQuestions.slice(0, 8).map(
      (q) => `- **${q.summary}** (×${q.frequency}, years: ${q.years.join(', ') || 'n/a'})`
    ),
    '',
    '## Repeated formulas',
    ...insight.repeatedFormulas.slice(0, 6).map((f) => `- ${f.formula} (×${f.frequency})`),
    '',
    '## Mark scheme keywords',
    ...insight.markSchemeKeywords.slice(0, 10).map((k) => `- ${k}`),
    '',
    '## Likely question styles',
    ...insight.likelyQuestionStyles.map((s) => `- ${s}`),
    '',
    '_Based on past paper retrieval and pattern frequency — revise these before the exam._',
  ]
  return lines.join('\n')
}

function buildTutorAnswer(input: {
  understanding: QuestionUnderstandingResult
  solve: PatternSolveResult | null
}): string {
  if (input.understanding.mode === 'repeated_questions' && input.understanding.repeated) {
    return buildRepeatedAnswer(input.understanding.repeated)
  }

  if (input.understanding.mode === 'explain_topic' && input.understanding.explain) {
    return input.understanding.explain.tutorNarrative
  }

  if (input.solve) {
    const reasoning = buildAcademicReasoning({
      question: input.understanding.analysis.rawQuestion,
      normalizedQuestion: input.understanding.analysis.normalizedQuestion,
      subject: input.understanding.analysis.subject,
      topic: input.understanding.analysis.topic,
      sources: input.solve.exactResult ? [input.solve.exactResult] : input.solve.patterns.similarQuestions,
    })
    return filterResponse(
      `${input.solve.answer}\n${formatReasoningOverlay(reasoning)}`.trim()
    )
  }

  return filterResponse(
    'I could not find enough verified material. Send the paper code, topic, or a clearer photo and I will route through past papers and mark schemes.'
  )
}

export async function runScholarPipeline(input: PipelineInput): Promise<ScholarPipelineResult> {
  const trace: string[] = ['Input']
  let multimodal: ProcessedMultimodalInput | null = null

  if (input.image) {
    trace.push('OCR/Vision')
    multimodal = await processImageBuffer(input.image)
  } else if (input.pdf) {
    trace.push('OCR/Vision')
    multimodal = await processPdfBuffer(input.pdf)
  } else if (input.text) {
    multimodal = await processTextInput(input.text)
  } else {
    throw new Error('Pipeline requires text, image, or PDF input.')
  }

  trace.push('Question Analyzer', 'Board Detection', 'Level Detection', 'Topic Detection')

  const questionText = multimodal.rawText || input.text || ''
  const understanding = await understandQuestion({
    question: questionText,
    extracted: multimodal.extracted,
    profile: input.profile,
  })

  if (understanding.mode === 'repeated_questions' || understanding.mode === 'explain_topic') {
    const answer = buildTutorAnswer({ understanding, solve: null })
    return {
      multimodal,
      understanding,
      solve: null,
      answer,
      confidence: 'AI_REASONING',
      confidenceScore: 72,
      pipelineTrace: [...trace, 'Pattern/Theory Retrieval', 'Examiner Reasoning', 'Human Tutor Response'],
    }
  }

  trace.push(
    'Past Paper Retrieval',
    'Mark Scheme Retrieval',
    'Pattern Retrieval',
    'Formula Retrieval',
    'Theory Retrieval',
    'Concept Graph',
    'Examiner Reasoning'
  )

  const solve = await solveWithPatternPipeline({
    question: understanding.analysis.normalizedQuestion,
    profile: input.profile,
  })

  trace.push('Human Tutor Response')

  return {
    multimodal,
    understanding,
    solve,
    answer: buildTutorAnswer({ understanding, solve }),
    confidence: solve.confidence,
    confidenceScore: solve.confidenceScore,
    pipelineTrace: trace,
  }
}
