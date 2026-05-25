import { filterTone } from '@/lib/tutor/tone_filter'

export type MockGenerationResult = {
  answer: string
  tokens_used: number
  from_cache: boolean
  source: 'mock_generator'
  is_mock: true
}

export function buildMockPrompt(input: string, subject: string, level: string) {
  return `
You are a Cambridge examiner writing a new question.

Subject : ${subject}
Level   : ${level}
Request : ${input}

Write ONE exam question following these rules:
1. Match real Cambridge style exactly — same wording,
   same structure, same type of data given.
2. Choose a marks value: 2, 3, 4, 5, or 6 marks.
3. Use a real-world context Cambridge loves.
4. After the question write:
   [marks]
   Model answer: [concise mark-scheme style answer]
   What this tests: [topic + skill]
   Common mistake: [what students get wrong]
5. Max 250 tokens total.
6. Do NOT say "here is a question" or any intro.
   Start directly with the question text.
`.trim()
}

export function normalizeMockAnswer(answer: string, tokensUsed = 0): MockGenerationResult {
  return {
    answer: filterTone(answer),
    tokens_used: tokensUsed,
    from_cache: false,
    source: 'mock_generator',
    is_mock: true,
  }
}

