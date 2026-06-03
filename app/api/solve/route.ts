export const runtime = 'nodejs'
export const maxDuration = 30
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { validateQuestion } from '@/lib/validation/inputValidator'
import { getStudentProfile } from '@/lib/server/profile'
import { classifyIntent } from '@/lib/rag/classifyIntent'
import { trackLearningGap, trackSolvedTopic } from '@/lib/progress/autoTrack'
import { runScholarPipeline } from '@/lib/pipeline/scholarPipeline'
import type { PatternSolveResult } from '@/lib/paper-solver/solvePipeline'
import {
  normalizeChatFilesPayload,
  prepareUploadedFiles,
  type ChatFilePayload,
} from '@/lib/server/file-input'

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

function sourceFromResult(result: NonNullable<PatternSolveResult['exactResult']>) {
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

function citationSources(result: PatternSolveResult) {
  if (result.exactResult) return [sourceFromResult(result.exactResult)]
  return result.patterns.similarQuestions.slice(0, 3).map(sourceFromResult)
}

export async function POST(req: Request) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError

  try {
    const body = (await req.json()) as Record<string, unknown> & ChatFilePayload
    let rawMessage = validateQuestion(String(body.message ?? body.question ?? ''))

    const filePayload: ChatFilePayload = {
      fileBase64: typeof body.fileBase64 === 'string' ? body.fileBase64 : null,
      fileType: typeof body.fileType === 'string' ? body.fileType : null,
      fileName: typeof body.fileName === 'string' ? body.fileName : null,
      files: body.files,
    }

    let pipelineImage: { buffer: Buffer; mimeType: string; fileName: string } | undefined
    let pipelinePdf: Buffer | undefined

    try {
      const normalizedFiles = normalizeChatFilesPayload(filePayload)
      if (normalizedFiles.length > 0) {
        const prepared = await prepareUploadedFiles(normalizedFiles)
        const ocrChunks = prepared.chunks.map((c) => c.content).filter(Boolean)
        if (ocrChunks.length) {
          rawMessage = [rawMessage, ...ocrChunks].filter(Boolean).join('\n\n')
        }
        const first = normalizedFiles[0]
        const buffer = Buffer.from(first.fileBase64, 'base64')
        if (first.fileType.includes('pdf') || first.fileName.toLowerCase().endsWith('.pdf')) {
          pipelinePdf = buffer
        } else if (first.fileType.startsWith('image/')) {
          pipelineImage = {
            buffer,
            mimeType: first.fileType,
            fileName: first.fileName,
          }
        }
      }
    } catch {
      // attachments optional
    }

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

    const pipeline = await runScholarPipeline({
      text: pipelineImage || pipelinePdf ? undefined : rawMessage,
      image: pipelineImage,
      pdf: pipelinePdf,
      profile: profileFilters,
    })
    const solved = pipeline.solve
    const analysis = pipeline.understanding.analysis
    const topic = analysis.topic ?? analysis.chapter ?? analysis.subtopic ?? 'General'
    const solvedSubject = analysis.subject ?? subject ?? 'General'
    const answerText = pipeline.answer

    if (!solved) {
      return NextResponse.json({
        status: pipeline.understanding.mode === 'repeated_questions' ? 'pattern_based' : 'ai_reasoning',
        answer: answerText,
        response: answerText,
        intent: pipeline.understanding.intent,
        confidence: pipeline.confidence,
        confidenceBadge: 'AI REASONING - theory/pattern tutor mode',
        confidenceScore: pipeline.confidenceScore,
        pipelineTrace: pipeline.pipelineTrace,
        understanding: {
          mode: pipeline.understanding.mode,
          repeated: pipeline.understanding.repeated ?? null,
          explain: pipeline.understanding.explain
            ? { topic: pipeline.understanding.explain.topic, subject: pipeline.understanding.explain.subject }
            : null,
        },
        profileFilters,
      })
    }

    if (analysis.skippedChapter) {
      await trackLearningGap({
        userId: user?.id ?? 'test-anonymous-user',
        subject: solvedSubject,
        skippedChapter: analysis.skippedChapter,
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
        isCorrect:
          solved.status === 'verified' ||
          Boolean(solved.examinerSolution?.calculationVerification?.passed),
        confidenceScore: solved.confidenceScore,
        profile: {
          board: profile.preferredBoard,
          level: profile.preferredLevel,
        },
      })
    }

    const chapterGap = analysis.skippedChapter
      ? {
          skippedTopic: analysis.skippedChapter,
          currentTopic: topic,
          recommendation: `No worries. I will avoid ${analysis.skippedChapter} and explain ${topic} from a safer foundation route.`,
        }
      : null
    const sources = citationSources(solved)
    const source = solved.exactResult ? sourceFromResult(solved.exactResult) : null
    const calculationVerification = solved.examinerSolution?.calculationVerification ?? null

    return NextResponse.json({
      status: solved.status,
      answer: answerText,
      response: answerText,
      pipelineTrace: pipeline.pipelineTrace,
      ocrAccuracyEstimate: pipeline.multimodal?.ocrAccuracyEstimate ?? null,
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
        commandWord: analysis.commandWord,
        questionType: analysis.questionType,
        concepts: analysis.concepts,
        formulasNeeded: analysis.formulasNeeded,
      },
      understandingMode: pipeline.understanding.mode,
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
