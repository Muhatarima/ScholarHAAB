import type { CommandWordAnalysis } from '@/lib/reasoning/commandWordAnalyzer'

export type DifficultyLevel = 'Easy' | 'Medium' | 'Hard' | 'Examiner-Trap'

export type DifficultyAnalysis = {
  difficulty: DifficultyLevel
  reasons: string[]
  estimatedMarks: number
}

export function analyzeDifficulty(input: {
  question: string
  concepts: string[]
  formulas: string[]
  command: CommandWordAnalysis
}): DifficultyAnalysis {
  const reasons: string[] = []
  const text = input.question.toLowerCase()
  const explicitMarks = /\[(\d+)\s*marks?\]|\b(\d+)\s*marks?\b/i.exec(input.question)
  const estimatedMarks = explicitMarks ? Number(explicitMarks[1] ?? explicitMarks[2]) : Math.max(2, Math.min(8, input.concepts.length + input.formulas.length + 1))

  let score = 0
  if (input.concepts.length >= 3) {
    score += 2
    reasons.push('multiple concepts must be linked')
  }
  if (input.formulas.length >= 2) {
    score += 2
    reasons.push('more than one formula may be needed')
  }
  if (/\btherefore|hence|show that|prove|justify|evaluate\b/i.test(input.question)) {
    score += 2
    reasons.push('requires reasoning, not only recall')
  }
  if (/\btrap|common mistake|compare|distinguish|gradient|area under\b/i.test(text)) {
    score += 2
    reasons.push('contains examiner-trap wording')
  }
  if (estimatedMarks >= 6) {
    score += 2
    reasons.push('higher mark allocation')
  }

  if (score >= 6) return { difficulty: 'Examiner-Trap', reasons, estimatedMarks }
  if (score >= 4) return { difficulty: 'Hard', reasons, estimatedMarks }
  if (score >= 2) return { difficulty: 'Medium', reasons, estimatedMarks }
  return { difficulty: 'Easy', reasons: reasons.length ? reasons : ['single main concept'], estimatedMarks }
}
