import { generateGraphSpec } from '@/lib/graph/graphGenerator'
import { parseMathQuestion } from '@/lib/math/mathParser'

export function buildMathGraph(question: string) {
  const parsed = parseMathQuestion(question)
  if (parsed.intent !== 'graph' && !parsed.expression) return null
  return generateGraphSpec({
    type: 'function',
    expression: parsed.expression ?? 'x^2',
    title: `Graph of y = ${parsed.expression ?? 'x^2'}`,
  })
}
