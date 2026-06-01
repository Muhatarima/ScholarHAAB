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
import { retrieveMarkSchemeFromResult } from '@/lib/rag/retrieveMarkScheme'
import { trackLearningGap, trackSolvedTopic } from '@/lib/progress/autoTrack'

function isUuid(value: string | undefined): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
}

async function loadProfile(userId: string | undefined) {
  if (!isUuid(userId)) {
    return {
      preferredBoard: 'Cambridge',
      preferredLevel: 'A Level',
      preferredSubjects: ['Physics', 'Chemistry', 'Mathematics'],
    }
  }

  try {
    return await getStudentProfile(userId)
  } catch {
    return {
      preferredBoard: 'Cambridge',
      preferredLevel: 'A Level',
      preferredSubjects: ['Physics', 'Chemistry', 'Mathematics'],
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

    const solved = await solveQuestion(user?.id ?? 'test-anonymous-user', classified.normalizedQuery, subject, history, {
      avoidedTopics: classified.skippedChapter ? [classified.skippedChapter] : [],
      profileFilters: {
        board: classified.board ?? profile.preferredBoard,
        level: classified.level ?? profile.preferredLevel,
        subjects: profileSubjects,
      },
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
    const answer = chapterGap
      ? adaptedGapAnswer(currentTopic, chapterGap.skippedTopic)
      : solved.answer

    return NextResponse.json({
      status: strictConfidence.status,
      answer,
      response: answer,
      warning: strictConfidence.warning,
      confidence: strictConfidence.status === 'verified' ? 'VERIFIED' : strictConfidence.status === 'partial' ? 'PARTIAL' : 'AI_REASONING',
      confidenceBadge: statusToBadge(strictConfidence.status),
      confidenceScore: strictConfidence.confidence,
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
