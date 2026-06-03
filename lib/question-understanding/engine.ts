import { classifyIntent, type ClassifiedIntent, type SolverIntent } from '@/lib/rag/classifyIntent'
import { analyzeQuestion, type QuestionAnalysis } from '@/lib/paper-solver/questionAnalyzer'
import { analyzePastPapers, type PastPaperAnalysis } from '@/lib/exam/analyzePastPapers'
import { routeKnowledge } from '@/lib/knowledge/knowledgeRouter'
import type { KnowledgeRouterResult } from '@/lib/knowledge/types'
import { buildAcademicReasoning, formatReasoningOverlay } from '@/lib/reasoning/academicReasoner'
import { retrievePastPaper } from '@/lib/rag/retrievePastPaper'
import { retrievePatterns } from '@/lib/paper-solver/patternRetriever'
import type { ExtractedQuestion } from '@/lib/input/questionExtractor'

export type UnderstandingMode =
  | 'repeated_questions'
  | 'explain_topic'
  | 'solve_question'
  | 'past_paper_search'
  | 'general'

export type RepeatedQuestionsInsight = {
  subject: string
  topic: string
  yearsAnalyzed: number
  repeatedQuestions: Array<{ summary: string; frequency: number; years: number[] }>
  repeatedFormulas: Array<{ formula: string; frequency: number }>
  markSchemeKeywords: string[]
  likelyQuestionStyles: string[]
  analysis: PastPaperAnalysis
}

export type ExplainTopicInsight = {
  subject: string
  topic: string
  theory: KnowledgeRouterResult['theory']
  formulas: KnowledgeRouterResult['formulas']
  misconceptions: KnowledgeRouterResult['misconceptions']
  syllabus: KnowledgeRouterResult['syllabus']
  examinerExpectations: string[]
  tutorNarrative: string
}

export type QuestionUnderstandingResult = {
  mode: UnderstandingMode
  intent: ClassifiedIntent
  analysis: QuestionAnalysis
  extracted?: ExtractedQuestion
  repeated?: RepeatedQuestionsInsight
  explain?: ExplainTopicInsight
}

const REPEATED_QUERY =
  /\brepeated\b|\brecurring\b|\bcome up again\b|\bcommon questions\b|\bhigh frequency\b|\bpattern over\b/i

function detectMode(text: string, intent: SolverIntent): UnderstandingMode {
  if (intent === 'repeated_questions' || REPEATED_QUERY.test(text)) return 'repeated_questions'
  if (intent === 'explain_topic') return 'explain_topic'
  if (intent === 'past_paper_search') return 'past_paper_search'
  if (intent === 'solve_question') return 'solve_question'
  return 'general'
}

function defaultBoardLevel(analysis: QuestionAnalysis, profile?: { board?: string; level?: string }) {
  return {
    board: analysis.board ?? profile?.board ?? 'Cambridge',
    level: analysis.level ?? profile?.level ?? 'O Level',
  }
}

export async function understandQuestion(input: {
  question: string
  extracted?: ExtractedQuestion
  profile?: { board?: string | null; level?: string | null; subject?: string | null }
}): Promise<QuestionUnderstandingResult> {
  const mergedText = input.extracted?.cleanPrompt
    ? `${input.question}\n${input.extracted.cleanPrompt}`
    : input.question

  const intent = classifyIntent(mergedText)
  const analysis = analyzeQuestion(mergedText)

  if (input.extracted?.subject && !analysis.subject) {
    analysis.subject = input.extracted.subject
  }
  if (input.extracted?.topic && !analysis.topic) {
    analysis.topic = input.extracted.topic
    analysis.chapter = input.extracted.chapter ?? input.extracted.topic
  }
  if (input.extracted?.board && input.extracted.board !== 'General' && !analysis.board) {
    analysis.board = input.extracted.board
  }
  if (input.extracted?.level && input.extracted.level !== 'General' && !analysis.level) {
    analysis.level = input.extracted.level
  }
  if (input.extracted?.year && !analysis.year) {
    analysis.year = input.extracted.year
  }

  const mode = detectMode(mergedText, intent.intent)
  const { board, level } = defaultBoardLevel(analysis, {
    board: input.profile?.board ?? undefined,
    level: input.profile?.level ?? undefined,
  })
  const subject =
    analysis.subject ?? input.profile?.subject ?? input.extracted?.subject ?? 'Physics'
  const topic =
    analysis.topic ?? input.extracted?.topic ?? analysis.chapter ?? 'General'

  if (mode === 'repeated_questions') {
    const pastAnalysis = await analyzePastPapers({
      board,
      level,
      subject,
      yearsBack: 10,
      topicFocus: topic !== 'General' ? topic : null,
    })

    const repeatedQuestions = pastAnalysis.repeatedTopics.map((entry) => ({
      summary: entry.topic,
      frequency: entry.frequency,
      years: entry.yearsAppeared,
    }))

    return {
      mode,
      intent,
      analysis,
      extracted: input.extracted,
      repeated: {
        subject,
        topic,
        yearsAnalyzed: 10,
        repeatedQuestions,
        repeatedFormulas: pastAnalysis.recurringFormulas,
        markSchemeKeywords: pastAnalysis.markSchemePatterns,
        likelyQuestionStyles: pastAnalysis.highFrequencyQuestionTypes.map((t) => t.type),
        analysis: pastAnalysis,
      },
    }
  }

  if (mode === 'explain_topic') {
    const knowledge = await routeKnowledge(analysis, {
      board,
      level,
      subject,
    })

    const examinerExpectations = [
      ...knowledge.syllabus.flatMap((s) => s.learningObjectives).slice(0, 4),
      ...knowledge.theory.flatMap((t) => t.examKeywords).slice(0, 4),
    ].filter(Boolean)

    const reasoning = buildAcademicReasoning({
      question: mergedText,
      normalizedQuestion: analysis.normalizedQuestion,
      subject,
      topic,
      sources: [],
    })

    const sections = [
      `## ${topic} (${subject})`,
      '',
      '### Theory',
      knowledge.theory[0]?.detailedExplanation ??
        knowledge.theory[0]?.shortExplanation ??
        'Use syllabus definitions first.',
      '',
      '### Key formulas',
      knowledge.formulas.length
        ? knowledge.formulas.map((f) => `- ${f.formula}: ${f.meaning}`).join('\n')
        : '- Revise standard formulas for this topic from the formula bank.',
      '',
      '### Common misconceptions',
      knowledge.misconceptions.length
        ? knowledge.misconceptions.map((m) => `- ${m.misconception} → ${m.correction}`).join('\n')
        : '- Check command words and units before final answers.',
      '',
      '### Examiner expectations',
      examinerExpectations.length
        ? examinerExpectations.map((e) => `- ${e}`).join('\n')
        : '- State keyword, explain link, apply to the scenario.',
      '',
      formatReasoningOverlay(reasoning),
    ]

    return {
      mode,
      intent,
      analysis,
      extracted: input.extracted,
      explain: {
        subject,
        topic,
        theory: knowledge.theory,
        formulas: knowledge.formulas,
        misconceptions: knowledge.misconceptions,
        syllabus: knowledge.syllabus,
        examinerExpectations,
        tutorNarrative: sections.join('\n'),
      },
    }
  }

  return {
    mode,
    intent,
    analysis,
    extracted: input.extracted,
  }
}

export async function enrichWithPastPaperContext(analysis: QuestionAnalysis) {
  const [papers, patterns] = await Promise.all([
    retrievePastPaper(analysis.normalizedQuestion, {
      board: analysis.board ?? undefined,
      level: analysis.level ?? undefined,
      subject: analysis.subject ?? undefined,
      topic: analysis.topic ?? undefined,
    }, 5).catch(() => []),
    retrievePatterns(analysis, {
      board: analysis.board ?? undefined,
      level: analysis.level ?? undefined,
      subject: analysis.subject ?? undefined,
    }),
  ])
  return { papers, patterns }
}
