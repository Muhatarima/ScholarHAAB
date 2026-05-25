export function normalizeQuestion(question: string) {
  return question
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
}

export function isPersonalQuestion(question: string) {
  const normalized = normalizeQuestion(question)
  return /\b(i|my|me|mine|our|we|am i|can i|my cgpa|my profile|my budget|my sop|my lor|i have)\b/.test(
    normalized
  )
}
