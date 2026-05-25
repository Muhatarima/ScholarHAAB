import { generateResponse } from '@/lib/ai-service'
import { CAMBRIDGE_MASTER_PROMPT } from '@/lib/ai/adaptiveEngine'
import { buildChapterCoachAnswer } from '@/lib/ai/chapterCoach'
import {
  detectMessageTone,
  polishResponse,
} from '@/lib/ai/personalityLayer'
import { searchRag } from '@/lib/ai/ragBridge'
import {
  buildTruthPrompt,
  classifyConfidence,
  validateTruthResponse,
  type RagChunk,
} from '@/lib/ai/truthEngine'
import { generateExamBriefing } from '@/lib/ai/examPredictor'
import { generateMockQuestion } from '@/lib/ai/mockGenerator'
import { inferSubjectFromText, inferTopicFromText, getPrerequisites } from '@/lib/learning/syllabus'
import {
  buildMemoryContext,
  getPrerequisiteGap,
  loadStudentMemory,
  updateMemoryAfterSession,
} from '@/lib/memory/studentMemory'

export type TutorMode = 'practice' | 'explain' | 'exam' | 'emergency' | 'explore' | 'mock'

export type TutorMessageResult = {
  answer: string
  mode: TutorMode
  subject: string | null
  topic: string
  memoryContext: string
  prerequisiteWarning: string | null
  tokensUsed: number
}

function detectMode(message: string): TutorMode {
  const normalized = message.toLowerCase()
  if (/\b(emergency|exam is tomorrow|exam tomorrow|in \d+\s*(hours?|hrs?|days?)|night before)\b/.test(normalized)) {
    return 'emergency'
  }
  if (/\b(mock|test me|practice paper|generate.*question|drill)\b/.test(normalized)) {
    return 'mock'
  }
  if (/\b(predict|likely|tomorrow|paper 1 exam|paper 2 exam|exam prep|briefing)\b/.test(normalized)) {
    return 'exam'
  }
  if (/\b(explain|why|understand|confused|teach)\b/.test(normalized)) {
    return 'explain'
  }
  if (/\b(deep|derive|prove|intuition|from scratch)\b/.test(normalized)) {
    return 'explore'
  }
  return 'practice'
}

function buildTutorSystemPrompt(
  studentName: string,
  memoryContext: string
): string {
  const name = studentName || 'there'

  return `
You are ScholarHAAB — ${name}'s personal Cambridge tutor.
Not a robot. Not a textbook. A brilliant friend.

${CAMBRIDGE_MASTER_PROMPT}

PERSONAL CONTEXT FOR ${name.toUpperCase()}:
${memoryContext}

HOW TO USE MEMORY:
- If they struggled before: "Last time this tripped you up..."
- If they improved: "You've gotten so much better at this!"
- If they skipped topics: warn gently, not lecture-style
- If on a streak: "You're crushing it today!"

CONVERSATION MODES:

PRACTICE MODE:
Don't give answer immediately.
Ask: "What do you think the first step is?"
Give hint → wait → then reveal.
Feel like a game, not a test.

EXPLAIN MODE:
Start with WHY it matters.
Real world example first.
Then theory. Then formula.
End with: "Make sense? Try this one..."

EMERGENCY MODE:
High energy! Time is short!
"Okay listen, exam in X hours — here's what matters MOST"
Bullet points. Fast. Confident.
"You've got this. Let's go."

EXPLORE MODE:
Go deep. Be curious together.
"Actually that's a fascinating question..."
Connect to bigger picture.
Make them feel like a scientist.

MOCK MODE:
Be the examiner — but a friendly one.
"Okay student, paper starts now 📝"
Give question. Wait. Then mark it properly.
"Here's what Cambridge would say..."
`
}

function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.split(/\s+/).filter(Boolean).length * 1.3))
}

function extractNumber(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) return Number(match[1])
  }
  return null
}

function buildHardFallbackAnswer(
  message: string,
  topic: string,
  confidence: ReturnType<typeof classifyConfidence>,
  gapMessage?: string,
  board?: string
) {
  const normalized = message.toLowerCase()
  const isEdexcel = board?.toLowerCase() === 'edexcel' || /edexcel|pearson|ial|igcse/i.test(message)
  const source = isEdexcel ? 'Pearson Edexcel expert reasoning' : 'Cambridge expert reasoning'
  const markSchemeLabel = isEdexcel ? 'Edexcel marks this as:' : 'Cambridge marks this as:'

  if (/\bwave\b|frequency|wavelength/.test(normalized)) {
    const frequency = extractNumber(normalized, [
      /frequency\s*(?:=|is)?\s*(\d+(?:\.\d+)?)/i,
      /\bf\s*=\s*(\d+(?:\.\d+)?)/i,
      /(\d+(?:\.\d+)?)\s*hz/i,
    ])
    const wavelength = extractNumber(normalized, [
      /wavelength\s*(?:=|is)?\s*(\d+(?:\.\d+)?)/i,
      /(?:λ|lambda)\s*=\s*(\d+(?:\.\d+)?)/i,
      /(\d+(?:\.\d+)?)\s*m\b/i,
    ])

    if (frequency !== null && wavelength !== null) {
      const speed = Number((frequency * wavelength).toFixed(4))
      return [
        `**Confidence:** ${confidence.badge} ${confidence.level}`,
        `**Source:** ${source}`,
        gapMessage ? `\n${gapMessage}` : null,
        '',
        '**Solution:**',
        'Formula: v = fλ',
        `Substitute: v = ${frequency} × ${wavelength}`,
        `Calculate: v = ${speed} m/s`,
        '',
        '**Mark Scheme:**',
        isEdexcel ? '- M1: states v = fλ' : '- States v = fλ',
        isEdexcel ? `- A1: correct substitution ${frequency} × ${wavelength}` : `- Correct substitution: ${frequency} × ${wavelength}`,
        isEdexcel ? `- B1: correct answer ${speed} m/s with unit` : `- Correct answer: ${speed} m/s with unit`,
        '',
        '**Examiner Tip:** Formula first, substitution second, final unit last.',
      ]
        .filter(Boolean)
        .join('\n')
    }
  }

  if (/integration by parts|integral by parts|parts bujhte|parts bujhini|∫u|uv/.test(normalized)) {
    return [
      `**Confidence:** ${confidence.badge} ${confidence.level}`,
      `**Source:** ${source}`,
      gapMessage ? `\n${gapMessage}` : null,
      '',
      '**Solution:**',
      'Haan, integration by parts looks weird first time. Think of it as splitting one hard integral into two easier pieces.',
      '',
      'Formula: ∫u dv = uv - ∫v du',
      '',
      'Hint first: choose u as the part that becomes simpler when you differentiate it.',
      'For ∫x e^x dx:',
      'u = x, so du = dx',
      'dv = e^x dx, so v = e^x',
      '',
      'Then:',
      '∫x e^x dx = x e^x - ∫e^x dx',
      '= x e^x - e^x + C',
      '= e^x(x - 1) + C',
      '',
      '**Mark Scheme:**',
      isEdexcel ? '- M1: correct choice of u and dv' : '- Correct choice of u and dv',
      isEdexcel ? '- M1: applies ∫u dv = uv - ∫v du' : '- Correct use of integration by parts formula',
      isEdexcel ? '- A1: final simplified expression' : '- Final simplified expression with + C',
      '',
      '**Examiner Tip:** Pick u using the rule: algebra before trig before exponential.',
    ]
      .filter(Boolean)
      .join('\n')
  }

  return [
    `**Confidence:** ${confidence.badge} ${confidence.level}`,
    `**Source:** ${source}`,
    gapMessage ? `\n${gapMessage}` : null,
    '',
    `Let's handle ${topic} in exam style.`,
    '',
    '**Solution:**',
    '1. Identify the command word.',
    '2. Write the formula or definition first.',
    '3. Use the data or keywords exactly.',
    '4. Compare your final line with the mark scheme wording.',
    '',
    '**Mark Scheme:**',
    markSchemeLabel,
    '• Correct formula or definition stated (1 mark)',
    '• Correct application to the question (1 mark)',
    '• Correct final answer or conclusion with units where needed (1 mark)',
    '',
    'Mark scheme comparison: full marks usually require the correct keyword plus a clear link to the question context.',
    `Next practice: try one short question on ${topic}, then check if your answer uses the exact examiner words.`,
  ]
    .filter(Boolean)
    .join('\n')
}

export async function detectPrerequisiteGap(topic: string, studentId: string) {
  const memory = await loadStudentMemory(studentId)
  const gap = getPrerequisiteGap(topic, memory)
  if (!gap) {
    return null
  }

  return {
    topic,
    missing: gap,
    prerequisites: getPrerequisites(topic),
    message: `You have not practiced ${gap} yet. Understanding ${gap} will help with ${topic}. Recommended: cover ${gap} first, then continue.`,
  }
}

export async function handleTutorMessage(
  studentId: string,
  message: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  board?: string
): Promise<TutorMessageResult> {
  const memory = await loadStudentMemory(studentId)
  const memoryContext = await buildMemoryContext(studentId)
  const mode = detectMode(message)
  const subject = inferSubjectFromText(message) ?? memory.subjects[0] ?? null
  const topic = inferTopicFromText(message)
  const gap = await detectPrerequisiteGap(topic, studentId)
  const chapterCoachAnswer = await buildChapterCoachAnswer(message, conversationHistory)

  if (chapterCoachAnswer) {
    await updateMemoryAfterSession(studentId, {
      subject: subject ?? 'Physics',
      topic: 'Forces',
      sessionType: 'exam',
      questionsAttempted: 0,
      questionsCorrect: 0,
      aiNotes: 'Chapter 5 Forces exam coach flow used.',
      skippedChapters: gap ? [gap.missing] : [],
    })

    return {
      answer: chapterCoachAnswer,
      mode: 'exam',
      subject: subject ?? 'Physics',
      topic: 'Forces',
      memoryContext,
      prerequisiteWarning: gap?.message ?? null,
      tokensUsed: estimateTokens(chapterCoachAnswer),
    }
  }

  if (mode === 'mock') {
    const mock = await generateMockQuestion(subject ?? 'Physics', topic, 'medium', studentId, memory.level, 'Paper 2')
    const answer = [
      mock.questionText,
      '',
      mock.markScheme,
      '',
      `Based on: ${mock.basedOnQuestionIds.length ? mock.basedOnQuestionIds.slice(0, 3).join(', ') : 'Cambridge-style local pattern fallback'}`,
    ].join('\n')

    await updateMemoryAfterSession(studentId, {
      subject,
      topic,
      sessionType: 'mock',
      questionsAttempted: 1,
      questionsCorrect: 0,
      weakPointsIdentified: gap ? [gap.missing] : [],
      aiNotes: `Generated mock question on ${topic}.`,
    })

    return {
      answer,
      mode,
      subject,
      topic,
      memoryContext,
      prerequisiteWarning: gap?.message ?? null,
      tokensUsed: estimateTokens(answer),
    }
  }

  if (mode === 'emergency') {
    const briefing = await generateExamBriefing(subject ?? 'Physics', memory.level, 'Paper 1', board)
    await updateMemoryAfterSession(studentId, {
      subject,
      topic,
      sessionType: 'emergency',
      aiNotes: `Emergency briefing generated for ${subject ?? 'subject'}: ${topic}.`,
      skippedChapters: gap ? [gap.missing] : [],
    })

    return {
      answer: briefing,
      mode,
      subject,
      topic,
      memoryContext,
      prerequisiteWarning: gap?.message ?? null,
      tokensUsed: estimateTokens(briefing),
    }
  }

  const ragResult = await searchRag(message, subject ?? undefined, memory.level || 'O Level', 7, board)
  const ragChunks: RagChunk[] = ragResult.chunks
  const truthOutput = buildTruthPrompt({
    question: message,
    subject: subject ?? 'General',
    level: memory.level || 'A/O Level',
    ragChunks,
    maxSimilarity: ragResult.maxSimilarity,
    studentMemory: memoryContext,
  })
  const history = conversationHistory
    .slice(-6)
    .map((entry) => `${entry.role}: ${entry.content}`)
    .join('\n')
  const prompt = [
    truthOutput.prompt,
    gap ? `Prerequisite gap to mention: ${gap.message}` : null,
    '',
    history ? `Recent conversation:\n${history}` : null,
    '',
    `Mode: ${mode}`,
    'If this is practice mode, guide with hints before revealing final answer unless the user explicitly asks for the final answer.',
    'Always include a mark scheme comparison and the next practice action.',
  ]
    .filter(Boolean)
    .join('\n')

  let answer: string
  let usedFallback = false
  let alreadyPolished = false
  try {
    answer = await generateResponse(prompt, buildTutorSystemPrompt(memory.name, memoryContext), {
      maxTokens: mode === 'explore' ? 720 : 520,
      operation: `adaptive_tutor_${mode}`,
      userKey: studentId,
    })

    const validation = validateTruthResponse(answer)
    if (!validation.valid) {
      const retryPrompt = [
        prompt,
        '',
        'CRITICAL: The previous response was invalid.',
        `Issues: ${validation.issues.join(', ')}`,
        'Provide a complete Cambridge-style answer now.',
        'Do not refuse because retrieval is weak. If retrieval is weak, reason as a Cambridge examiner.',
        'Always show step-by-step solution and mark scheme points.',
      ].join('\n')

      answer = await generateResponse(retryPrompt, buildTutorSystemPrompt(memory.name, memoryContext), {
        maxTokens: 600,
        operation: 'adaptive_tutor_retry',
        userKey: studentId,
      })
    }
  } catch {
    // HARD FALLBACK: if every provider fails, still answer using Cambridge expert reasoning.
    usedFallback = true
    const confidence = classifyConfidence(ragResult.maxSimilarity, ragResult.ragAvailable)
    answer = buildHardFallbackAnswer(message, topic, confidence, gap?.message, board)
    answer = polishResponse(
      answer,
      detectMessageTone(message),
      confidence.badge,
      confidence.level,
      board
    )
    alreadyPolished = true
  }

  if (!alreadyPolished) {
    const messageTone = detectMessageTone(message)
    answer = polishResponse(
      answer,
      messageTone,
      truthOutput.confidenceBadge,
      truthOutput.confidenceLevel,
      board
    )
  }

  await updateMemoryAfterSession(studentId, {
    subject,
    topic,
    sessionType: mode,
    questionsAttempted: mode === 'practice' ? 1 : 0,
    questionsCorrect: 0,
    weakPointsIdentified: gap ? [gap.missing] : [],
    aiNotes: `Mode ${mode} | RAG: ${ragResult.ragAvailable} | Similarity: ${ragResult.maxSimilarity.toFixed(2)} | Fallback: ${usedFallback}`,
    skippedChapters: gap ? [gap.missing] : [],
  })

  return {
    answer,
    mode,
    subject,
    topic,
    memoryContext,
    prerequisiteWarning: gap?.message ?? null,
    tokensUsed: estimateTokens(answer),
  }
}

export async function generateSessionSummary(sessionId: string) {
  return [
    'Session Summary:',
    'Covered: use the session log to list topics covered.',
    'Struggled with: weakest topic from the last attempts.',
    'Skipped: prerequisite gaps detected during the session.',
    'Progress: compare correct percentage against previous attempts.',
    'Next session: practice the weakest topic first, then move one level harder.',
    `Session id: ${sessionId}`,
  ].join('\n')
}
