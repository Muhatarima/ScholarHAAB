export const runtime = 'nodejs'
export const maxDuration = 30
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { validateQuestion } from '@/lib/validation/inputValidator'
import { getStudentProfile } from '@/lib/server/profile'
import { classifyIntent } from '@/lib/rag/classifyIntent'
import { solveQuestion } from '@/lib/rag/qbankSolver'
import { calculateConfidence } from '@/lib/rag/calculateConfidence'
import { retrievePastPaper } from '@/lib/rag/retrievePastPaper'
import { retrieveMarkSchemeFromResult } from '@/lib/rag/retrieveMarkScheme'
import { trackLearningGap, trackSolvedTopic } from '@/lib/progress/autoTrack'
import { solveNumericalPhysics } from '@/lib/math/numericalPhysicsEngine'
import { solveWithSympy } from '@/lib/math/sympyEngine'
import { formatMathSolution } from '@/lib/math/solutionFormatter'
import { isLikelyMathQuestion } from '@/lib/math/mathParser'
import { buildMathGraph } from '@/lib/math/graphEngine'
import { generateDiagramSpec, suggestDiagramKind } from '@/lib/diagram/diagramGenerator'
import { buildAcademicReasoning, formatReasoningOverlay } from '@/lib/reasoning/academicReasoner'
import { verifyWithSympy } from '@/lib/verification/sympyGroundTruth'

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

function statusToBadge(status: string) {
  if (status === 'verified') return 'VERIFIED - from Cambridge/Edexcel past papers'
  if (status === 'partial') return 'PARTIAL MATCH - AI reasoning applied'
  return 'AI REASONING - verify before exam'
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

function adaptedGapAnswer(currentTopic: string, skippedChapter: string) {
  const lower = currentTopic.toLowerCase()
  const opener = [
    'Chapter Gap Detected.',
    `Skipped: ${skippedChapter}`,
    `Current topic: ${currentTopic}`,
    '',
    `No judgment. I will explain ${currentTopic} from the basics and avoid using ${skippedChapter} as a shortcut.`,
    '',
  ].join('\n')

  if (/bonding|ionic|covalent/.test(lower)) {
    return [
      opener,
      'Bonding, simple version:',
      '[1] Atoms become more stable when their outer shells are full.',
      '[1] Ionic bonding: electrons transfer, making positive and negative ions.',
      '[1] Covalent bonding: atoms share pairs of electrons.',
      '[1] Strong attraction holds the particles together.',
      '',
      'Exam tip: use words like electron transfer, shared pair, oppositely charged ions, and strong electrostatic attraction.',
    ].join('\n')
  }

  if (/differential/.test(lower)) {
    return [
      opener,
      'Differential equations, simple version:',
      '[1] A differential equation links a quantity to its rate of change.',
      '[1] First identify what is changing: y, x, time, velocity, etc.',
      '[1] Separate variables if possible, then integrate both sides.',
      '[1] Use any given condition to find the constant.',
      '',
      'Exam tip: method marks usually come from setting up the equation correctly, not just the final answer.',
    ].join('\n')
  }

  return [
    opener,
    'Safe route:',
    '[1] Start with the definition of the current topic.',
    '[1] Use one simple example.',
    '[1] Apply the key formula or keyword.',
    '[1] Finish with the exact exam phrase.',
    '',
    'Send me one past-paper question and I will solve it using this simplified route.',
  ].join('\n')
}

async function withFallbackTimeout<T>(task: Promise<T>, fallback: T, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      task,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function POST(req: Request) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError

  try {
    const body = (await req.json()) as Record<string, unknown>
    const rawMessage = validateQuestion(String(body.message ?? body.question ?? ''))
    const history = Array.isArray(body.history)
      ? body.history
          .map((entry) => {
            const record = entry as { role?: unknown; content?: unknown }
            return {
              role: record.role === 'assistant' ? 'assistant' as const : 'user' as const,
              content: typeof record.content === 'string' ? record.content : '',
            }
          })
          .filter((entry) => entry.content.trim())
          .slice(-8)
      : []
    const profile = await loadProfile(user?.id)
    const classified = classifyIntent(rawMessage)
    const subject = classified.subject ?? (typeof body.subject === 'string' ? body.subject : undefined)
    const profileSubjects = profile.preferredSubjects ?? []

    if (classified.intent === 'emotional_panic') {
      return NextResponse.json({
        status: 'emotional_panic',
        answer: panicAnswer(classified.topic),
        response: panicAnswer(classified.topic),
        intent: classified,
        confidence: 'AI_REASONING',
        confidenceBadge: 'AI REASONING - verify before exam',
      })
    }

    const subjectNotInProfile =
      subject && profileSubjects.length > 0 && !profileSubjects.some((item) => item.toLowerCase() === subject.toLowerCase())

    const profileFilters = {
      board: classified.board ?? profile.preferredBoard,
      level: classified.level ?? profile.preferredLevel,
      subjects: profileSubjects,
    }

    const numericalPhysics = !classified.skippedChapter ? solveNumericalPhysics(classified.normalizedQuery) : null
    if (numericalPhysics) {
      const verification = await verifyWithSympy({
        question: classified.normalizedQuery,
        category: 'numerical_physics',
        solverAnswer: numericalPhysics.finalAnswer,
        solverLatex: numericalPhysics.latex ?? null,
        solverNumericValue: numericalPhysics.numericValue,
        solverUnit: numericalPhysics.unit,
        solverFormulaPath: numericalPhysics.formulaPath,
        solverMarkAllocation: numericalPhysics.markAllocation,
      })
      const currentTopic = classified.topic ?? numericalPhysics.topic
      const academicReasoning = buildAcademicReasoning({
        question: rawMessage,
        normalizedQuestion: classified.normalizedQuery,
        subject: subject ?? 'Physics',
        topic: currentTopic,
        sources: [],
      })
      const answer = [
        'AI REASONING - verify before exam',
        '',
        verification.passed
          ? 'Calculation check: passed by independent SymPy verification.'
          : `Calculation check: failed (${verification.failureTypes.join(', ')}).`,
        '',
        'Short answer:',
        numericalPhysics.finalAnswer,
        '',
        'Working:',
        ...numericalPhysics.working.map((step, index) => `Step ${index + 1} [1]: ${step}`),
        '',
        'Mark scheme points:',
        ...numericalPhysics.markAllocation.map((point) => `- ${point}`),
        '',
        'Exam tip:',
        'Write known values with units first, then choose the formula. Sign errors are the easiest marks to lose.',
        formatReasoningOverlay(academicReasoning),
      ].join('\n')

      void trackSolvedTopic({
        userId: user?.id ?? 'test-anonymous-user',
        subject: subject ?? 'Physics',
        topic: currentTopic,
        isCorrect: verification.passed,
        confidenceScore: verification.passed ? 97 : 35,
        profile: {
          board: profile.preferredBoard,
          level: profile.preferredLevel,
        },
      }).catch((error) => console.error('Physics progress tracking failed:', error))

      return NextResponse.json({
        status: verification.passed ? 'calculation_verified' : 'ai_reasoning',
        answer,
        response: answer,
        warning: 'No exact past paper match found. This is AI reasoning. Verify before exam.',
        confidence: 'AI_REASONING',
        confidenceBadge: verification.passed
          ? 'SYMPY CHECK PASSED - calculation verified'
          : 'AI REASONING - SymPy mismatch detected',
        confidenceScore: verification.passed ? 97 : 35,
        intent: classified,
        profileFilters,
        source: null,
        question: null,
        markScheme: {
          answerText: numericalPhysics.finalAnswer,
          markPoints: numericalPhysics.markAllocation,
          sourcePdfUrl: null,
        },
        sources: [],
        chapterGap: null,
        mathEngine: {
          intent: 'numerical_physics',
          exactAnswer: numericalPhysics.finalAnswer,
          latex: numericalPhysics.latex ?? null,
          usedSympy: false,
        },
        calculationVerification: verification,
        visualLearning: {
          graph: null,
          diagram: null,
        },
        academicReasoning,
        subjectWarning: subjectNotInProfile
          ? `${subject} is not in your study profile. Add it in settings or search anyway.`
          : null,
      })
    }

    const likelyMath = !classified.skippedChapter && isLikelyMathQuestion(`${subject ?? ''} ${classified.normalizedQuery}`)
    if (likelyMath) {
      const quickSources = await withFallbackTimeout(
        retrievePastPaper(
          classified.normalizedQuery,
          {
            board: profileFilters.board ?? undefined,
            level: profileFilters.level ?? undefined,
            subject,
            topic: classified.topic ?? undefined,
          },
          5
        ),
        [],
        1800
      )
      const bestQuickSource = quickSources[0]
      const quickConfidence = calculateConfidence(bestQuickSource)
      const quickMarkScheme = retrieveMarkSchemeFromResult(bestQuickSource)
      const hasVerifiedMarkScheme =
        quickConfidence.status === 'verified' &&
        Boolean(quickMarkScheme.answerText || quickMarkScheme.markPoints.length > 0)

      if (!hasVerifiedMarkScheme) {
        const mathResult = await solveWithSympy(classified.normalizedQuery)
        const currentTopic = classified.topic ?? (mathResult ? 'Mathematics' : 'Graphing')
        if (mathResult) {
          void trackSolvedTopic({
            userId: user?.id ?? 'test-anonymous-user',
            subject: subject ?? 'Mathematics',
            topic: currentTopic,
            isCorrect: false,
            confidenceScore: quickConfidence.confidence,
            profile: {
              board: profile.preferredBoard,
              level: profile.preferredLevel,
            },
          }).catch((error) => console.error('Math progress tracking failed:', error))

          const diagramKind = suggestDiagramKind(`${classified.normalizedQuery} ${currentTopic}`)
          const academicReasoning = buildAcademicReasoning({
            question: rawMessage,
            normalizedQuestion: classified.normalizedQuery,
            subject: subject ?? 'Mathematics',
            topic: currentTopic,
            sources: quickSources,
          })
          const calculationVerification = await verifyWithSympy({
            question: classified.normalizedQuery,
            category: 'math',
            solverAnswer: mathResult.exactAnswer,
            solverLatex: mathResult.latex ?? null,
            solverFormulaPath: mathResult.working,
            solverMarkAllocation: mathResult.working,
          })
          const formattedMathAnswer = formatMathSolution(rawMessage, mathResult)
          return NextResponse.json({
            status: 'ai_reasoning',
            answer: `${formattedMathAnswer}\n\nCalculation check: ${
              calculationVerification.passed
                ? 'passed by independent SymPy verification.'
                : `failed (${calculationVerification.failureTypes.join(', ')}).`
            }${formatReasoningOverlay(academicReasoning)}`,
            response: `${formattedMathAnswer}\n\nCalculation check: ${
              calculationVerification.passed
                ? 'passed by independent SymPy verification.'
                : `failed (${calculationVerification.failureTypes.join(', ')}).`
            }${formatReasoningOverlay(academicReasoning)}`,
            warning: 'No exact past paper match found. This is AI reasoning. Verify before exam.',
            confidence: 'AI_REASONING',
            confidenceBadge: calculationVerification.passed
              ? 'SYMPY CHECK PASSED - calculation verified'
              : 'AI REASONING - SymPy mismatch detected',
            confidenceScore: calculationVerification.passed ? Math.max(quickConfidence.confidence, 97) : quickConfidence.confidence,
            intent: classified,
            profileFilters,
            source: null,
            question: null,
            markScheme: quickMarkScheme,
            sources: quickSources,
            chapterGap: null,
            mathEngine: {
              intent: mathResult.parsed.intent,
              exactAnswer: mathResult.exactAnswer,
              latex: mathResult.latex ?? null,
              usedSympy: mathResult.usedSympy,
            },
            calculationVerification,
            visualLearning: {
              graph: buildMathGraph(classified.normalizedQuery),
              diagram: diagramKind ? generateDiagramSpec(diagramKind, currentTopic) : null,
            },
            academicReasoning,
            subjectWarning: subjectNotInProfile
              ? `${subject} is not in your study profile. Add it in settings or search anyway.`
              : null,
          })
        }

        const graphSpec = buildMathGraph(classified.normalizedQuery)
        if (graphSpec) {
          const academicReasoning = buildAcademicReasoning({
            question: rawMessage,
            normalizedQuestion: classified.normalizedQuery,
            subject: subject ?? 'Mathematics',
            topic: currentTopic,
            sources: quickSources,
          })
          const graphAnswer = [
            'AI REASONING - verify before exam',
            '',
            `Graph generated: ${graphSpec.title}`,
            'Use the graph to read intercepts, turning points, gradient, or area depending on the question.',
            '',
            'Exam tip: label both axes and state the key feature the question asks for.',
            formatReasoningOverlay(academicReasoning),
          ].join('\n')

          return NextResponse.json({
            status: 'ai_reasoning',
            answer: graphAnswer,
            response: graphAnswer,
            warning: 'No exact past paper match found. This is AI reasoning. Verify before exam.',
            confidence: 'AI_REASONING',
            confidenceBadge: statusToBadge('ai_reasoning'),
            confidenceScore: quickConfidence.confidence,
            intent: classified,
            profileFilters,
            source: null,
            question: null,
            markScheme: quickMarkScheme,
            sources: quickSources,
            chapterGap: null,
            mathEngine: null,
            visualLearning: {
              graph: graphSpec,
              diagram: null,
            },
            academicReasoning,
            subjectWarning: subjectNotInProfile
              ? `${subject} is not in your study profile. Add it in settings or search anyway.`
              : null,
          })
        }
      }
    }

    const solved = await solveQuestion(user?.id ?? 'test-anonymous-user', classified.normalizedQuery, subject, history, {
      avoidedTopics: classified.skippedChapter ? [classified.skippedChapter] : [],
      profileFilters,
    })

    const bestSource = solved.sources[0]
    const strictConfidence = calculateConfidence(bestSource)
    const markScheme = retrieveMarkSchemeFromResult(bestSource)
    const currentTopic = solved.topic ?? classified.topic ?? 'General'

    if (classified.skippedChapter) {
      await trackLearningGap({
        userId: user?.id ?? 'test-anonymous-user',
        subject: subject ?? solved.subject ?? 'General',
        skippedChapter: classified.skippedChapter,
        currentTopic,
        detectedFromMessage: rawMessage,
        profile: {
          board: profile.preferredBoard,
          level: profile.preferredLevel,
        },
      })
    } else {
      await trackSolvedTopic({
        userId: user?.id ?? 'test-anonymous-user',
        subject: subject ?? solved.subject ?? 'General',
        topic: currentTopic,
        isCorrect: strictConfidence.status === 'verified',
        confidenceScore: strictConfidence.confidence,
        profile: {
          board: profile.preferredBoard,
          level: profile.preferredLevel,
        },
      })
    }

    const chapterGap = classified.skippedChapter
      ? {
          skippedTopic: classified.skippedChapter,
          currentTopic,
          recommendation: `No worries. We will avoid ${classified.skippedChapter} and explain ${currentTopic} from the basics.`,
        }
      : null
    const academicReasoning = buildAcademicReasoning({
      question: rawMessage,
      normalizedQuestion: classified.normalizedQuery,
      subject: subject ?? solved.subject,
      topic: currentTopic,
      sources: solved.sources,
      weakOrSkippedConcepts: classified.skippedChapter ? [classified.skippedChapter] : [],
    })
    const mathResult =
      !chapterGap && strictConfidence.status !== 'verified' && isLikelyMathQuestion(`${subject ?? ''} ${classified.normalizedQuery}`)
        ? await solveWithSympy(classified.normalizedQuery)
        : null
    const calculationVerification = mathResult
      ? await verifyWithSympy({
          question: classified.normalizedQuery,
          category: 'math',
          solverAnswer: mathResult.exactAnswer,
          solverLatex: mathResult.latex ?? null,
          solverFormulaPath: mathResult.working,
          solverMarkAllocation: mathResult.working,
        })
      : null
    const diagramKind = suggestDiagramKind(`${classified.normalizedQuery} ${currentTopic}`)
    const graphSpec = isLikelyMathQuestion(classified.normalizedQuery) ? buildMathGraph(classified.normalizedQuery) : null
    const diagramSpec = diagramKind ? generateDiagramSpec(diagramKind, currentTopic) : null
    const answer = chapterGap
      ? adaptedGapAnswer(currentTopic, chapterGap.skippedTopic)
      : mathResult
        ? `${formatMathSolution(rawMessage, mathResult)}\n\nCalculation check: ${
            calculationVerification?.passed
              ? 'passed by independent SymPy verification.'
              : `failed (${calculationVerification?.failureTypes.join(', ') || 'unsupported_ground_truth'}).`
          }${formatReasoningOverlay(academicReasoning)}`
        : `${solved.answer}${formatReasoningOverlay(academicReasoning)}`

    return NextResponse.json({
      status: strictConfidence.status,
      answer,
      response: answer,
      warning: strictConfidence.warning,
      confidence: strictConfidence.status === 'verified' ? 'VERIFIED' : strictConfidence.status === 'partial' ? 'PARTIAL' : 'AI_REASONING',
      confidenceBadge: calculationVerification?.passed
        ? 'SYMPY CHECK PASSED - calculation verified'
        : statusToBadge(strictConfidence.status),
      confidenceScore: calculationVerification?.passed ? Math.max(strictConfidence.confidence, 97) : strictConfidence.confidence,
      intent: classified,
      profileFilters: {
        board: classified.board ?? profile.preferredBoard,
        level: classified.level ?? profile.preferredLevel,
        subjects: profileSubjects,
      },
      source: bestSource
        ? {
            board: bestSource.board,
            level: bestSource.level,
            subject: bestSource.subject,
            topic: bestSource.topic,
            year: bestSource.year,
            paper_code: bestSource.paper,
            question_number: bestSource.question_number,
            marks: bestSource.marks,
            source_pdf_url: bestSource.source_url,
          }
        : null,
      question: bestSource?.question_text ?? null,
      markScheme,
      sources: solved.sources,
      chapterGap,
      mathEngine: mathResult
        ? {
            intent: mathResult.parsed.intent,
            exactAnswer: mathResult.exactAnswer,
            latex: mathResult.latex ?? null,
            usedSympy: mathResult.usedSympy,
          }
        : null,
      calculationVerification,
      visualLearning: {
        graph: graphSpec,
        diagram: diagramSpec,
      },
      academicReasoning,
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
