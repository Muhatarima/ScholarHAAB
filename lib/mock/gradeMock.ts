export type MockGradeResult = {
  score: number
  totalMarks: number
  percentage: number
  hitPoints: string[]
  missingPoints: string[]
  correctAnswer: string
  improvementAdvice: string
  isCorrect: boolean
}

export function splitMarkScheme(markScheme: string) {
  return markScheme
    .split(/\n|•|-/)
    .map((point) => point.trim())
    .filter((point) => point.length > 8)
    .slice(0, 8)
}

function extractKeywords(point: string) {
  return point
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 4)
    .filter((word) => !['award', 'mark', 'marks', 'correct', 'answer', 'where', 'relevant'].includes(word))
    .slice(0, 5)
}

export function gradeMockAnswer({
  answer,
  markScheme,
  marks,
}: {
  answer: string
  markScheme: string
  marks: number
}): MockGradeResult {
  const cleanAnswer = answer.toLowerCase()
  const points = splitMarkScheme(markScheme)
  const hitPoints = points.filter((point) => {
    const keywords = extractKeywords(point)
    return keywords.length > 0 && keywords.some((word) => cleanAnswer.includes(word))
  })
  const rawScore = Math.round((hitPoints.length / Math.max(1, points.length)) * marks)
  const score = Math.min(marks, Math.max(0, rawScore))
  const missingPoints = points.filter((point) => !hitPoints.includes(point))
  const percentage = Math.round((score / Math.max(1, marks)) * 100)
  const isCorrect = percentage >= 60
  const improvementAdvice = isCorrect
    ? 'Correct. Your answer matches the main mark-scheme points.'
    : 'Incorrect or incomplete. Add the missing mark-scheme points, then try again.'

  return {
    score,
    totalMarks: marks,
    percentage,
    hitPoints,
    missingPoints,
    correctAnswer: markScheme,
    improvementAdvice,
    isCorrect,
  }
}
