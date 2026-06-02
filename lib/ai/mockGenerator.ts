import { generateResponse } from '@/lib/ai-service'
import { adjustDifficulty, CAMBRIDGE_MASTER_PROMPT } from '@/lib/ai/adaptiveEngine'
import { inferTopicFromText } from '@/lib/learning/syllabus'
import { loadStudentMemory } from '@/lib/memory/studentMemory'
import { parseQbankQuery } from '@/lib/server/qbank'
import { searchCompiledQbankQuestions } from '@/lib/server/qbank-compiled-questions'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'
import { formatKnowledgeContext, getKnowledgeContext } from '@/lib/knowledge/base'

export type MockQuestionResult = {
  questionText: string
  markScheme: string
  marks: number
  basedOnQuestionIds: string[]
}

function getAdminClientOrNull() {
  try {
    return getSupabaseAdmin()
  } catch {
    return null
  }
}

function getMarksFromText(text: string) {
  const totalMatch = /\[\s*total\s*:?\s*(\d+)\s*marks?\s*\]/i.exec(text)
  if (totalMatch) return Number(totalMatch[1])

  const bracketMatches = [...text.matchAll(/\[(\d+)\s*marks?\]|\[(\d+)\]/gi)]
    .map((match) => Number(match[1] ?? match[2]))
    .filter((value) => Number.isFinite(value) && value > 0)

  if (bracketMatches.length > 1) {
    return Math.min(40, bracketMatches.reduce((sum, value) => sum + value, 0))
  }

  return bracketMatches[0] ?? 4
}

function fallbackQuestion(subject: string, topic: string, difficulty: string): MockQuestionResult {
  const knowledge = getKnowledgeContext(subject, topic)
  const formulaLine = knowledge.formula ? ` Use ${knowledge.formula} where relevant.` : ''
  return {
    questionText: [
      `${subject} ${difficulty} practice question`,
      `A student is investigating ${topic}. ${knowledge.theory} Explain the key idea and apply it to an exam-style situation.${formulaLine}`,
      '[4 marks]',
    ].join('\n'),
    markScheme: [
      `Award one mark for the correct principle: ${knowledge.theory}`,
      `Award one mark for using exam keywords: ${knowledge.examKeywords.slice(0, 3).join(', ')}.`,
      knowledge.formula
        ? `Award one mark for correct formula/use: ${knowledge.formula}.`
        : 'Award one mark for linking the idea to the example.',
      `Award one mark for avoiding the common mistake: ${knowledge.commonMistake}`,
    ].join('\n'),
    marks: 4,
    basedOnQuestionIds: [],
  }
}

function splitGeneratedQuestion(text: string) {
  const cleaned = text
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
    .replace(/^\s*(arre|hey|hi|okay|sure)[^\n]*\n+/i, '')
    .replace(/\*{3,}/g, '')
    .trim()
  const modelAnswerIndex = cleaned.search(/model answer:/i)
  if (modelAnswerIndex === -1) {
    const questionStart = cleaned.search(/question\s*:/i)
    return {
      questionText: (questionStart >= 0 ? cleaned.slice(questionStart) : cleaned).trim(),
      markScheme: 'Mark scheme not separated. Use the model answer in the question body.',
    }
  }

  const questionRaw = cleaned.slice(0, modelAnswerIndex).trim()
  const questionStart = questionRaw.search(/question\s*:/i)
  return {
    questionText: (questionStart >= 0 ? questionRaw.slice(questionStart) : questionRaw).trim(),
    markScheme: cleanMarkScheme(cleaned.slice(modelAnswerIndex)),
  }
}

function cleanMarkScheme(text: string) {
  return text
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
    .replace(/^\s*(arre|bhai|hey|hi|okay|sure)[^.\n]*(?:[.\n]|$)/gim, '')
    .replace(/^.*\b(arre|bhai|bojhageche|easy na\??|dekho|did you remember|how did you find|ready to try)\b.*(?:\n|$)/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function saveGeneratedMock(
  studentId: string,
  subject: string,
  topic: string,
  difficulty: string,
  result: MockQuestionResult
) {
  const supabase = getAdminClientOrNull()
  if (!supabase || !studentId) {
    return
  }

  await supabase.from('ai_mock_questions').insert({
    student_id: studentId,
    subject,
    topic,
    difficulty,
    question_text: result.questionText,
    mark_scheme: result.markScheme,
    marks: result.marks,
    based_on_question_ids: result.basedOnQuestionIds,
  })
}

export async function generateMockQuestion(
  subject: string,
  topic: string,
  difficulty: string,
  studentId: string,
  level = 'A Level',
  paper = 'Paper 2'
): Promise<MockQuestionResult> {
  const memory = await loadStudentMemory(studentId)
  const parsed = parseQbankQuery(`${level} ${subject} ${paper} ${topic}`)
  const similar = searchCompiledQbankQuestions(parsed, 4).filter(
    (row) => !memory.recentSessions.some((session) => row.id.includes(session.id))
  )
  const references = similar
    .map((row, index) => `${index + 1}. ${row.year ?? 'Unknown'} ${row.paper ?? paper} ${row.topic}: ${row.question_text.slice(0, 220)}`)
    .join('\n')
  const knowledgeContext = formatKnowledgeContext(subject, topic)
  const prompt = [
    `Generate a Cambridge ${level} ${subject} exam question about ${topic}.`,
    `Difficulty: ${difficulty}`,
    `Format: exactly like Cambridge past papers.`,
    'Include a full concise mark scheme with marking points.',
    `Paper style: ${paper}`,
    'Do not copy any reference question. Generate an original question with authentic wording.',
    'Tone: concise exam paper wording only. No emojis. No hype. No long intro. Start with "Question:".',
    'Do not include Banglish, slang, jokes, or tutor chatter inside the question or mark scheme.',
    'Use this syllabus/formula/theory context. Do not claim it is a real past paper:',
    knowledgeContext,
    'After the question include: [X marks], Model answer, What this tests, Common mistake.',
    '',
    'Style references:',
    references || 'No exact local references found; use general Cambridge style.',
  ].join('\n')

  try {
    const text = await generateResponse(prompt, CAMBRIDGE_MASTER_PROMPT, {
      maxTokens: 520,
      operation: 'mock_question',
      userKey: studentId,
    })
    const parts = splitGeneratedQuestion(text)
    const result = {
      questionText: parts.questionText,
      markScheme: parts.markScheme,
      marks: getMarksFromText(text),
      basedOnQuestionIds: similar.map((row) => row.id),
    }
    await saveGeneratedMock(studentId, subject, topic, difficulty, result)
    return result
  } catch {
    const result = fallbackQuestion(subject, topic, difficulty)
    await saveGeneratedMock(studentId, subject, topic, difficulty, result)
    return result
  }
}

export async function generateTargetedDrillSet(
  studentId: string,
  topic: string,
  count = 5,
  options: {
    subject?: string
    level?: string
    paper?: string
  } = {}
) {
  const memory = await loadStudentMemory(studentId)
  const subject = options.subject ?? memory.subjects[0] ?? 'Physics'
  const level = options.level ?? memory.level
  const paper = options.paper ?? 'Paper 2'
  const difficulties = ['easy', 'medium', 'hard']

  const questions = []
  for (let index = 0; index < count; index += 1) {
    questions.push(
      await generateMockQuestion(
        subject,
        topic,
        difficulties[Math.min(index, difficulties.length - 1)],
        studentId,
        level,
        paper
      )
    )
  }

  return questions
}

export async function generateFullMockPaper(
  subject: string,
  level: string,
  paper: string,
  studentId: string
) {
  const memory = await loadStudentMemory(studentId)
  const weakTopics = memory.weakTopics.length ? memory.weakTopics.slice(0, 3) : [inferTopicFromText(subject)]
  const baseDifficulty = await adjustDifficulty(studentId, subject, weakTopics[0] ?? null)
  const topics = [...weakTopics, 'core syllabus', 'data handling', 'exam technique']

  const questions = []
  for (let index = 0; index < 6; index += 1) {
    const topic = topics[index % topics.length] ?? subject
    const difficulty = index < 2 ? baseDifficulty : index < 4 ? 'medium' : 'hard'
    questions.push(await generateMockQuestion(subject, topic, difficulty, studentId, level, paper))
  }

  const totalMarks = questions.reduce((sum, question) => sum + question.marks, 0)
  return {
    title: `${level} ${subject} ${paper} personalized mock`,
    timeAllowed: totalMarks <= 40 ? '45 minutes' : '1 hour 15 minutes',
    totalMarks,
    questions,
    personalizedFocus: weakTopics,
  }
}
