import {
  generateFullMockPaper,
  generateMockQuestion,
  generateTargetedDrillSet,
  type MockQuestionResult,
} from '@/lib/ai/mockGenerator'
import { analyzePatterns } from '@/lib/pattern/patternAnalyzer'

export type MockGenerationRequest = {
  userId: string
  level: string
  board: string
  subject: string
  topic: string
  paperType?: string
  difficulty?: string
  numberOfQuestions?: number
  mode?: 'single' | 'drill' | 'paper'
}

export type ProductionMockQuestion = MockQuestionResult & {
  label: 'AI-generated mock based on A/O Level pattern'
  patternSummary: string
}

export async function generateAOLMock(request: MockGenerationRequest) {
  const pattern = await analyzePatterns({
    board: request.board,
    level: request.level,
    subject: request.subject,
    paperType: request.paperType,
    topic: request.topic,
  })

  if (request.mode === 'paper') {
    const paper = await generateFullMockPaper(
      request.subject,
      request.level,
      request.paperType ?? 'Paper 2',
      request.userId
    )
    return {
      ...paper,
      label: 'AI-generated mock based on A/O Level pattern' as const,
      patternSummary: pattern.summary,
    }
  }

  if (request.mode === 'drill' || (request.numberOfQuestions ?? 1) > 1) {
    const questions = await generateTargetedDrillSet(request.userId, request.topic, request.numberOfQuestions ?? 5, {
      subject: request.subject,
      level: request.level,
      paper: request.paperType,
    })
    return {
      title: `${request.level} ${request.subject} ${request.topic} drill`,
      totalMarks: questions.reduce((sum, question) => sum + question.marks, 0),
      questions: questions.map((question): ProductionMockQuestion => ({
        ...question,
        label: 'AI-generated mock based on A/O Level pattern',
        patternSummary: pattern.summary,
      })),
      patternSummary: pattern.summary,
    }
  }

  const question = await generateMockQuestion(
    request.subject,
    request.topic,
    request.difficulty ?? 'medium',
    request.userId,
    request.level,
    request.paperType ?? 'Paper 2'
  )

  return {
    ...question,
    label: 'AI-generated mock based on A/O Level pattern' as const,
    patternSummary: pattern.summary,
  }
}
