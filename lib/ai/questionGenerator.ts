import { generateResponse } from '@/lib/ai-service'
import { updateScore } from '@/lib/analytics/leaderboard'
import { filterResponse } from '@/lib/ai/qualityFilter'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'

export type AdaptiveDifficulty = 'foundation' | 'core' | 'extension'

export type Question = {
  question: string
  marks: number
  topic: string
  subject: string
  difficulty: AdaptiveDifficulty
  hint: string
  modelAnswer: string
  markScheme: string[]
  examinerTip: string
}

export type StudentWeakness = {
  topic: string
  confidenceScore: number
  weakness: string
}

export type GradeResult = {
  score: number
  marks: number
  correctPoints: string[]
  missingPoints: string[]
  modelAnswer: string
  feedback: string
}

type TopicPerformanceRow = {
  topic?: string | null
  chapter?: string | null
  confidence_score?: number | null
  weakness?: string | null
  weak_points?: string[] | null
}

type QuestionRow = {
  content?: string | null
  question_text?: string | null
}

function difficultyFromConfidence(score: number): AdaptiveDifficulty {
  if (score <= 30) return 'foundation'
  if (score <= 60) return 'core'
  return 'extension'
}

function clampConfidence(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function normalizeTopic(topic?: string | null) {
  return topic?.trim() || 'Forces'
}

function inferLevel(subject: string) {
  void subject
  return 'A/O Level'
}

function parseMarks(value: string, fallback: number) {
  const match = value.match(/MARKS:\s*\[?(\d{1,2})\]?/i)
  const parsed = match ? Number(match[1]) : fallback
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function getSection(text: string, label: string) {
  const pattern = new RegExp(`${label}:\\\\s*([\\\\s\\\\S]*?)(?=\\\\n[A-Z_ ]+:|$)`, 'i')
  return text.match(pattern)?.[1]?.trim() ?? ''
}

function parseMarkScheme(value: string) {
  return value
    .split(/\n|;/)
    .map((line) => line.replace(/^[-•*\d.()\s]+/, '').trim())
    .filter(Boolean)
}

function fallbackQuestion(subject: string, topic: string, difficulty: AdaptiveDifficulty): Question {
  const marks = difficulty === 'foundation' ? 3 : difficulty === 'core' ? 4 : 5

  if (/photo/i.test(topic) || /biology/i.test(subject)) {
    return {
      question: 'State the word equation for photosynthesis and explain why light intensity can affect its rate.',
      marks,
      topic,
      subject,
      difficulty,
      hint: 'Think reactants first, then products, then limiting factors.',
      modelAnswer:
        'Carbon dioxide + water -> glucose + oxygen. Light provides energy for photosynthesis, so increasing light intensity increases the rate until another factor becomes limiting.',
      markScheme: [
        'Carbon dioxide and water stated as reactants',
        'Glucose and oxygen stated as products',
        'Light provides energy for photosynthesis',
        'Rate stops increasing when another limiting factor controls the reaction',
      ].slice(0, marks),
      examinerTip: 'For equations, Cambridge wants correct substances on both sides, not a paragraph.',
    }
  }

  return {
    question:
      'A force of 12 N moves a box 3.0 m in the direction of the force. Calculate the work done on the box.',
    marks,
    topic,
    subject,
    difficulty,
    hint: 'Use work done = force x distance moved in the direction of the force.',
    modelAnswer: 'W = Fd = 12 x 3.0 = 36 J.',
    markScheme: [
      'States W = Fd',
      'Substitutes 12 x 3.0',
      'Calculates 36',
      'Includes unit J',
      'Shows working clearly',
    ].slice(0, marks),
    examinerTip: 'Always write the formula before substituting; that is the easy method mark.',
  }
}

async function getWeakTopics(userId: string): Promise<StudentWeakness[]> {
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('student_topic_performance')
      .select('*')
      .eq('user_id', userId)
      .order('confidence_score', { ascending: true })
      .limit(10)

    if (error || !Array.isArray(data)) return []

    return (data as TopicPerformanceRow[]).map((row) => {
      const confidenceScore = Number(row.confidence_score ?? 45)
      const weakPoints = Array.isArray(row.weak_points) ? row.weak_points.join(', ') : ''
      return {
        topic: normalizeTopic(row.topic ?? row.chapter),
        confidenceScore: clampConfidence(confidenceScore),
        weakness: row.weakness || weakPoints || 'Needs more confidence with core exam steps.',
      }
    })
  } catch {
    return []
  }
}

async function adjustDifficultyForRecentAnswers(
  userId: string,
  topic: string,
  base: AdaptiveDifficulty
): Promise<AdaptiveDifficulty> {
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('question_attempts')
      .select('is_correct, correct')
      .eq('user_id', userId)
      .ilike('topic', `%${topic}%`)
      .order('created_at', { ascending: false })
      .limit(2)

    if (error || !Array.isArray(data) || data.length < 2) return base

    const correctness = data.map((entry) => Boolean((entry as { is_correct?: unknown; correct?: unknown }).is_correct ?? (entry as { correct?: unknown }).correct))
    const allCorrect = correctness.every(Boolean)
    const allWrong = correctness.every((value) => !value)

    if (allCorrect && base === 'foundation') return 'core'
    if (allCorrect && base === 'core') return 'extension'
    if (allWrong && base === 'extension') return 'core'
    if (allWrong && base === 'core') return 'foundation'
    return base
  } catch {
    return base
  }
}

async function getPastPaperExamples(subject: string, topic: string) {
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('questions')
      .select('content, question_text')
      .eq('subject', subject)
      .ilike('content', `%${topic}%`)
      .in('resource_type', ['question_paper', 'unified_concept'])
      .limit(5)

    if (error || !Array.isArray(data)) return []

    return (data as QuestionRow[])
      .map((row) => row.content || row.question_text || '')
      .filter(Boolean)
      .slice(0, 5)
  } catch {
    return []
  }
}

function buildGeneratorPrompt(params: {
  subject: string
  topic: string
  level: string
  difficulty: AdaptiveDifficulty
  weakness: string
  examples: string[]
}) {
  return `
Generate ONE Cambridge-style exam question on:
Topic: ${params.topic}
Subject: ${params.subject}
Level: ${params.level}
Difficulty: ${params.difficulty}
Student weakness: ${params.weakness}

Based on these real past paper examples:
${params.examples.length ? params.examples.map((example, index) => `[Example ${index + 1}]\n${example}`).join('\n\n') : 'No exact examples found. Use Cambridge examiner reasoning.'}

Generate a question that:
- Tests the exact concept they are weak on
- Is Cambridge exam style
- Has clear mark allocation [X marks]
- Includes diagram description if needed
- Has a model answer and mark scheme

Format:
QUESTION: [question text]
MARKS: [X]
HINT: [optional subtle hint]
MODEL_ANSWER: [full answer]
MARK_SCHEME: [bullet points]
EXAMINER_TIP: [what examiners look for]
`.trim()
}

function parseGeneratedQuestion(
  raw: string,
  subject: string,
  topic: string,
  difficulty: AdaptiveDifficulty
): Question {
  const fallback = fallbackQuestion(subject, topic, difficulty)
  const clean = filterResponse(raw)
  const question = getSection(clean, 'QUESTION') || fallback.question
  const marks = parseMarks(clean, fallback.marks)
  const hint = getSection(clean, 'HINT') || fallback.hint
  const modelAnswer = getSection(clean, 'MODEL_ANSWER') || fallback.modelAnswer
  const markScheme = parseMarkScheme(getSection(clean, 'MARK_SCHEME'))
  const examinerTip = getSection(clean, 'EXAMINER_TIP') || fallback.examinerTip

  return {
    question,
    marks,
    topic,
    subject,
    difficulty,
    hint,
    modelAnswer,
    markScheme: markScheme.length ? markScheme.slice(0, marks + 2) : fallback.markScheme,
    examinerTip,
  }
}

export async function generateAdaptiveQuestion(
  userId: string,
  subject: string,
  topic?: string
): Promise<Question> {
  const weakTopics = await getWeakTopics(userId)
  const selected = topic
    ? { topic, confidenceScore: 45, weakness: `Needs practice on ${topic}.` }
    : weakTopics[0] ?? { topic: 'Forces', confidenceScore: 35, weakness: 'Needs confidence with formulas and mark-scheme wording.' }
  const baseDifficulty = difficultyFromConfidence(selected.confidenceScore)
  const difficulty = await adjustDifficultyForRecentAnswers(userId, selected.topic, baseDifficulty)
  const examples = await getPastPaperExamples(subject, selected.topic)
  const level = inferLevel(subject)
  const prompt = buildGeneratorPrompt({
    subject,
    topic: selected.topic,
    level,
    difficulty,
    weakness: selected.weakness,
    examples,
  })

  try {
    const raw = await generateResponse(
      prompt,
      'You generate precise Cambridge A/O Level practice questions with mark schemes. Return only the requested fields.',
      {
        maxTokens: 760,
        operation: 'adaptive_question_generator',
        userKey: userId,
        fallbackTextOnError: '',
      }
    )

    return parseGeneratedQuestion(raw, subject, selected.topic, difficulty)
  } catch {
    return fallbackQuestion(subject, selected.topic, difficulty)
  }
}

export function formatQuestionCard(question: Question) {
  return [
    '📝 Practice Question',
    `Topic: ${question.topic} | ${question.marks} marks`,
    '',
    question.question,
    '',
    `[Show hint] ${question.hint}`,
    '',
    'Submit your answer when ready and I will mark it against the scheme.',
  ].join('\n')
}

export async function gradeAdaptiveAnswer(params: {
  userId: string
  subject: string
  topic: string
  studentAnswer: string
  question: Question
}): Promise<GradeResult> {
  const normalized = params.studentAnswer.toLowerCase()
  const correctPoints = params.question.markScheme.filter((point) =>
    point
      .toLowerCase()
      .split(/\W+/)
      .filter((word) => word.length > 3)
      .some((word) => normalized.includes(word))
  )
  const missingPoints = params.question.markScheme.filter((point) => !correctPoints.includes(point))
  const score = Math.min(params.question.marks, correctPoints.length)

  try {
    const supabase = getSupabaseAdmin()
    const delta = score >= Math.ceil(params.question.marks * 0.65) ? 8 : -8
    const { data } = await supabase
      .from('student_topic_performance')
      .select('confidence_score')
      .eq('user_id', params.userId)
      .eq('subject', params.subject)
      .eq('topic', params.topic)
      .maybeSingle()
    const current = Number((data as { confidence_score?: unknown } | null)?.confidence_score ?? 45)
    await supabase.from('student_topic_performance').upsert({
      user_id: params.userId,
      subject: params.subject,
      topic: params.topic,
      confidence_score: clampConfidence(current + delta),
      updated_at: new Date().toISOString(),
    })
    if (score >= Math.ceil(params.question.marks * 0.65)) {
      await updateScore({
        userId: params.userId,
        points: 10,
        reason: 'correct_answer',
      })
    }
  } catch {
    // Analytics updates should never block grading feedback.
  }

  return {
    score,
    marks: params.question.marks,
    correctPoints,
    missingPoints,
    modelAnswer: params.question.modelAnswer,
    feedback:
      score >= Math.ceil(params.question.marks * 0.65)
        ? 'Nice, you hit the core marking points.'
        : 'Close. The missing points are exactly where marks are leaking.',
  }
}
