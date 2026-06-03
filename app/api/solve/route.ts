export const runtime = 'nodejs'
export const maxDuration = 30
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { validateQuestion } from '@/lib/validation/inputValidator'
import { getStudentProfile } from '@/lib/server/profile'
import { classifyIntent } from '@/lib/rag/classifyIntent'
import { trackLearningGap, trackSolvedTopic } from '@/lib/progress/autoTrack'
import { solveWithPatternPipeline } from '@/lib/paper-solver/solvePipeline'

function isUuid(value: string | undefined): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
}

async function loadProfile(userId: string | undefined) {
  if (!isUuid(userId)) {
    return {
      preferredBoard: 'Cambridge',
      preferredLevel: 'O Level',
      preferredSubjects: ['Physics', 'Chemistry'],
    }
  }

  try {
    return await getStudentProfile(userId)
  } catch {
    return {
      preferredBoard: 'Cambridge',
      preferredLevel: 'O Level',
      preferredSubjects: ['Physics', 'Chemistry'],
    }
  }
}

function panicAnswer(topic: string | null) {
  const target = topic ?? 'the highest-mark topic'
  return [
    'No panic. We go small and useful now.',
    '',
    `Do first: revise ${target} formulas/definitions for 10 minutes.`,
    'Then: solve one 4-mark question.',
    'Last: check mark scheme keywords only.',
    '',
    'Send me the exact topic and I will make a short emergency drill.',
  ].join('\n')
}

function sourceFromResult(result: NonNullable<Awaited<ReturnType<typeof solveWithPatternPipeline>>['exactResult']>) {
  return {
    board: result.board,
    level: result.level,
    subject: result.subject,
    topic: result.topic,
    year: result.year,
    paper_code: result.paper,
    question_number: result.question_number,
    marks: result.marks,
    source_pdf_url: result.source_url,
  }
}

function citationSources(result: Awaited<ReturnType<typeof solveWithPatternPipeline>>) {
  if (result.exactResult) return [sourceFromResult(result.exactResult)]
  return result.patterns.similarQuestions.slice(0, 3).map(sourceFromResult)
}

export async function POST(req: Request) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError

  try {
    const body = (await req.json()) as Record<string, unknown>
    const rawMessage = validateQuestion(String(body.message ?? body.question ?? ''))
    const profile = await loadProfile(user?.id)
    const classified = classifyIntent(rawMessage)
    const bodySubject = typeof body.subject === 'string' ? body.subject : undefined
    const subject = classified.subject ?? bodySubject
    const profileSubjects = profile.preferredSubjects ?? []

    if (classified.intent === 'emotional_panic') {
      const answer = panicAnswer(classified.topic)
      return NextResponse.json({
        status: 'emotional_panic',
        answer,
        response: answer,
        intent: classified,
        confidence: 'AI_REASONING',
        confidenceBadge: 'AI REASONING - emergency tutor mode',
        confidenceScore: 45,
      })
    }

    const profileFilters = {
      board: classified.board ?? profile.preferredBoard,
      level: classified.level ?? profile.preferredLevel,
      subjects: subject ? [subject, ...profileSubjects.filter((item) => item !== subject)] : profileSubjects,
    }
    const subjectNotInProfile =
      subject && profileSubjects.length > 0 && !profileSubjects.some((item) => item.toLowerCase() === subject.toLowerCase())

    const solved = await solveWithPatternPipeline({
      question: rawMessage,
      profile: profileFilters,
    })
    const topic = solved.analysis.topic ?? solved.analysis.chapter ?? solved.analysis.subtopic ?? 'General'
    const solvedSubject = solved.analysis.subject ?? subject ?? 'General'

    if (solved.analysis.skippedChapter) {
      await trackLearningGap({
        userId: user?.id ?? 'test-anonymous-user',
        subject: solvedSubject,
        skippedChapter: solved.analysis.skippedChapter,
        currentTopic: topic,
        detectedFromMessage: rawMessage,
        profile: {
          board: profile.preferredBoard,
          level: profile.preferredLevel,
        },
      })
    } else {
      await trackSolvedTopic({
        userId: user?.id ?? 'test-anonymous-user',
        subject: solvedSubject,
        topic,
        isCorrect: solved.status === 'verified' || Boolean(solved.examinerSolution?.calculationVerification?.passed),
        confidenceScore: solved.confidenceScore,
        profile: {
          board: profile.preferredBoard,
          level: profile.preferredLevel,
        },
      })
    }

    const chapterGap = solved.analysis.skippedChapter
      ? {
          skippedTopic: solved.analysis.skippedChapter,
          currentTopic: topic,
          recommendation: `No worries. I will avoid ${solved.analysis.skippedChapter} and explain ${topic} from a safer foundation route.`,
        }
      : null
    const sources = citationSources(solved)
    const source = solved.exactResult ? sourceFromResult(solved.exactResult) : null
    const calculationVerification = solved.examinerSolution?.calculationVerification ?? null

    return NextResponse.json({
      status: solved.status,
      answer: solved.answer,
      response: solved.response,
      warning: solved.warning,
      confidence: solved.confidence,
      confidenceBadge: solved.confidenceBadge,
      confidenceScore: solved.confidenceScore,
      badge: solved.confidenceBadge,
      sourceBasis: solved.sourceBasis,
      reasoningSteps: solved.reasoningSteps,
      markSchemePoints: solved.markSchemePoints,
      examinerTip: solved.examinerTip,
      commonMistake: solved.commonMistake,
      practiceNext: solved.practiceNext,
      intent: {
        ...classified,
        commandWord: solved.analysis.commandWord,
        questionType: solved.analysis.questionType,
        concepts: solved.analysis.concepts,
        formulasNeeded: solved.analysis.formulasNeeded,
      },
      profileFilters,
      source,
      question: solved.exactResult?.question_text ?? null,
      markScheme: {
        answerText: solved.examinerSolution?.finalAnswer ?? null,
        markPoints: solved.markSchemePoints,
        sourcePdfUrl: solved.exactResult?.source_url ?? null,
      },
      sources,
      chapterGap,
      patternReasoning: {
        patterns: solved.patterns.matchedPatterns,
        patternSummary: solved.patterns.patternSummary,
        markSchemePattern: solved.markSchemePattern,
        formulas: solved.formulas,
        theory: solved.theory,
        syllabus: solved.syllabus,
        conceptGraph: solved.knowledge?.concepts ?? [],
        misconceptions: solved.knowledge?.misconceptions ?? [],
        publicEducation: solved.knowledge?.publicEducation ?? [],
        knowledgeRoute: solved.knowledge?.route ?? null,
        knowledgeNotes: solved.knowledge?.notes ?? [],
      },
      calculationVerification,
      mathEngine: solved.examinerSolution?.mathResult
        ? {
            intent: solved.examinerSolution.mathResult.parsed.intent,
            exactAnswer: solved.examinerSolution.mathResult.exactAnswer,
            latex: solved.examinerSolution.mathResult.latex ?? null,
            usedSympy: solved.examinerSolution.mathResult.usedSympy,
          }
        : solved.examinerSolution?.numericalPhysics
          ? {
              intent: 'numerical_physics',
              exactAnswer: solved.examinerSolution.numericalPhysics.finalAnswer,
              latex: solved.examinerSolution.numericalPhysics.latex ?? null,
              usedSympy: false,
            }
          : null,
      subjectWarning: subjectNotInProfile
        ? `${subject} is not in your study profile. Add it in settings or search anyway.`
        : null,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not solve this question.' },
      { status: 400 }
    )
  }
}
