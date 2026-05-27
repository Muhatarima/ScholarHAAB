export type CambridgeQuestionPattern = 'definition' | 'calculation' | 'explain' | 'compare' | 'general'

export function detectCambridgePattern(message: string): CambridgeQuestionPattern {
  const text = message.toLowerCase()

  if (/\b(define|state what is meant|what is meant|meaning of)\b/.test(text)) {
    return 'definition'
  }
  if (/\b(calculate|find|determine|work out|solve|show that)\b/.test(text)) {
    return 'calculation'
  }
  if (/\b(explain|why|how|give a reason|account for)\b/.test(text)) {
    return 'explain'
  }
  if (/\b(compare|contrast|difference between|differentiate between)\b/.test(text)) {
    return 'compare'
  }
  return 'general'
}

export function getCambridgePatternInstruction(message: string): string {
  const pattern = detectCambridgePattern(message)

  switch (pattern) {
    case 'definition':
      return [
        'CAMBRIDGE MARK-SCHEME PATTERN: DEFINITION',
        'Format as: State [term]: [one clear sentence definition].',
        'Then add: Key words for marks: [word/phrase] [1], [word/phrase] [1].',
      ].join('\n')
    case 'calculation':
      return [
        'CAMBRIDGE MARK-SCHEME PATTERN: CALCULATION',
        'Format as:',
        'Step 1 [1]: formula',
        'Step 2 [1]: substitution with units',
        'Step 3 [1]: final answer with unit and sensible significant figures.',
      ].join('\n')
    case 'explain':
      return [
        'CAMBRIDGE MARK-SCHEME PATTERN: EXPLAIN',
        'Format as mark points:',
        'Point 1 [1]: cause or key idea.',
        'Point 2 [1]: mechanism.',
        'Point 3 [1]: final effect or conclusion.',
      ].join('\n')
    case 'compare':
      return [
        'CAMBRIDGE MARK-SCHEME PATTERN: COMPARE',
        'Format as:',
        '[A]: clear feature.',
        '[B]: clear feature.',
        'Difference [1]: the exact contrast that earns the mark.',
      ].join('\n')
    default:
      return [
        'CAMBRIDGE MARK-SCHEME PATTERN: GENERAL',
        'Structure the answer so each sentence can earn a mark.',
        'Use [1], [2], [3] where mark allocation is clear.',
      ].join('\n')
  }
}
