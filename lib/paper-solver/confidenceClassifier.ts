import type { SearchResult } from '@/lib/rag/ragSystem'
import { calculateConfidence, hasMarkScheme, hasRealSource } from '@/lib/rag/calculateConfidence'
import type { PatternRetrievalResult } from '@/lib/paper-solver/patternRetriever'

export type SolverStatus = 'verified' | 'pattern_based' | 'ai_reasoning' | 'unsupported'

export type ConfidenceClassification = {
  status: SolverStatus
  confidence: number
  label: 'VERIFIED' | 'PATTERN_BASED' | 'AI_REASONING' | 'UNSUPPORTED'
  badge: string
  warning: string | null
}

export function classifySolverConfidence(input: {
  exactResult?: SearchResult | null
  patternResult: PatternRetrievalResult
  formulaCount: number
  theoryCount: number
  syllabusCount: number
  sympyVerified?: boolean
}): ConfidenceClassification {
  const exactConfidence = calculateConfidence(input.exactResult)

  if (input.exactResult && exactConfidence.status === 'verified' && hasRealSource(input.exactResult) && hasMarkScheme(input.exactResult)) {
    return {
      status: 'verified',
      confidence: exactConfidence.confidence,
      label: 'VERIFIED',
      badge: 'VERIFIED - from Cambridge/Edexcel past papers',
      warning: null,
    }
  }

  if (input.sympyVerified) {
    return {
      status: 'pattern_based',
      confidence: Math.max(82, Math.min(89, input.patternResult.confidence + 8)),
      label: 'PATTERN_BASED',
      badge: 'PATTERN-BASED REASONING - SymPy calculation verified',
      warning: 'No exact past paper source was used. The calculation is independently checked with SymPy and formatted in examiner style.',
    }
  }

  const supportScore =
    input.patternResult.confidence +
    Math.min(8, input.formulaCount * 3) +
    Math.min(8, input.theoryCount * 3) +
    Math.min(4, input.syllabusCount * 2) +
    (input.sympyVerified ? 8 : 0)
  const confidence = Math.max(0, Math.min(89, Math.round(supportScore)))

  if (confidence >= 75) {
    return {
      status: 'pattern_based',
      confidence,
      label: 'PATTERN_BASED',
      badge: input.sympyVerified
        ? 'PATTERN-BASED REASONING - SymPy calculation verified'
        : 'PATTERN-BASED REASONING - based on similar examiner patterns',
      warning: 'I did not find this exact past paper question, but similar examiner patterns support this answer.',
    }
  }

  if (confidence >= 55) {
    return {
      status: 'pattern_based',
      confidence,
      label: 'PATTERN_BASED',
      badge: 'PATTERN-BASED REASONING - formula/theory supported',
      warning: 'No exact match found. This answer uses topic patterns, formula/theory support, and examiner-style reasoning.',
    }
  }

  if (confidence >= 30) {
    return {
      status: 'ai_reasoning',
      confidence,
      label: 'AI_REASONING',
      badge: 'AI REASONING - verify before exam',
      warning: 'No exact or close pattern found. This is AI reasoning - verify before exam.',
    }
  }

  return {
    status: 'unsupported',
    confidence,
    label: 'UNSUPPORTED',
    badge: 'UNSUPPORTED - verify with teacher/source',
    warning: 'I do not have enough verified support for this. Use this only as a starting point.',
  }
}
