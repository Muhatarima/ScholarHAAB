import type { PromptMode, Product } from '@/lib/products'
import type { SessionContext } from '@/lib/sessionContext'

export type SourceChunkLike = {
  title: string
  url?: string | null
  tier?: string | null
  lastChecked?: string | null
  score?: number | null
}

export type DisplaySourceCitation = {
  title: string
  url?: string | null
  label: string
  verified: boolean
  lastChecked?: string | null
  score?: number | null
}

export type AnswerValidationResult = {
  answer: string
  confidence: 'high' | 'medium' | 'low'
  factuallyGrounded: boolean
  hallucinatedFacts: string[]
  mathCorrect: boolean | null
}

const SOURCE_LABELS: Record<string, string> = {
  qbank_exact_answer: 'Official past paper answer',
  qbank_partial_answer: 'Past paper answer',
  qbank_seed: 'Past paper question',
  qbank_compiled_question: 'Past paper question',
  qbank_compiled_topic: 'Syllabus topic',
  qbank_concept_seed: 'Syllabus concept',
  qbank_concept_db: 'Syllabus concept',
  qbank_repeat_group: 'Repeated topic pattern',
  qbank_paper_db: 'Past paper',
  qbank_paper_seed: 'Past paper',
  qbank_paper_pair: 'Official paper set',
  qbank_source_db: 'Official paper source',
  qbank_source_seed: 'Official paper source',
  qbank_blocked_recovery: 'Verified paper status',
  qbank_gap_status: 'Verified paper status',
  qbank_nearby_official: 'Nearby official paper',
  tier0_structured_match: 'Verified scholarship record',
  tier0_guidance_match: 'Guidance case',
  tier0_document_case: 'Guidance case',
  tier1_official: 'Verified',
  tier2_internal_live: 'Guidance',
  uploaded_file_chunk: 'Uploaded file excerpt',
  uploaded_file_warning: 'Upload processing warning',
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function humanizeSourceTitle(title: string) {
  return title
    .replace(/\s+\[(exact|partial|question-only)\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function inferSubject(text: string) {
  const normalized = normalizeText(text)
  const subjects: Array<[RegExp, string]> = [
    [/\bchem(istry)?\b/, 'Chemistry'],
    [/\bphysics\b/, 'Physics'],
    [/\bmath(ematics|s)?\b/, 'Mathematics'],
    [/\bbiology\b/, 'Biology'],
    [/\beconomics?\b/, 'Economics'],
    [/\baccount(ing|ancy)?\b/, 'Accounting'],
    [/\benglish\b/, 'English'],
    [/\bict\b|\bcomput(ing|er science)\b|\bcse\b/, 'Computer Science'],
  ]

  for (const [pattern, subject] of subjects) {
    if (pattern.test(normalized)) {
      return subject
    }
  }

  return null
}

function sourceMatchesSubject(source: SourceChunkLike, subject: string | null) {
  if (!subject) {
    return true
  }

  if (String(source.tier ?? '').startsWith('uploaded_file_')) {
    return true
  }

  const normalizedTitle = normalizeText(source.title)
  const normalizedSubject = normalizeText(subject)
  return normalizedTitle.includes(normalizedSubject)
}

function isVerifiedSource(tier: string | null | undefined) {
  return /exact|tier0|official|verified/i.test(String(tier ?? ''))
}

function containsInternalTags(text: string) {
  return /\b(qbank_[a-z_]+|tier\d+_[a-z_]+)\b/i.test(text)
}

function stripInternalTags(text: string) {
  return text
    .replace(/\b(qbank_[a-z_]+|tier\d+_[a-z_]+)\b/gi, '')
    .replace(/\s+\|\s+/g, ' | ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function hasKnownBrokenSpacing(text: string) {
  const patterns = [
    /\bmult\s+iple\b/i,
    /\bch\s+oice\b/i,
    /\bpre\s+cipitate\b/i,
    /\bsolu\s+tion\b/i,
    /\bins\s+tru\s+ct\b/i,
    /\bpri\s+odic\b/i,
    /\brea\s+d\b/i,
  ]

  if (patterns.some((pattern) => pattern.test(text))) {
    return true
  }

  const alphaWords = text.split(/\s+/).filter((token) => /^[A-Za-z]+$/.test(token))
  const tinyWords = alphaWords.filter((token) => token.length <= 2)
  return alphaWords.length >= 18 && tinyWords.length / alphaWords.length > 0.38
}

function isKnownMathAnswerCorrect(query: string, answer: string) {
  const normalizedQuery = normalizeText(query).replace(/\s+/g, '')
  const normalizedAnswer = normalizeText(answer).replace(/\s+/g, '')

  if (normalizedQuery.includes('differentiatey=sinx')) {
    return /cosx/.test(normalizedAnswer)
  }

  if (normalizedQuery.includes('integratex^2') || normalizedQuery.includes('integrationofx^2')) {
    return /(x\^3\/3|frac\{x\^3\}\{3\}|x3\/3)/.test(normalizedAnswer)
  }

  if (normalizedQuery.includes('idealgasformula')) {
    return /pv=nrt/.test(normalizedAnswer)
  }

  if (normalizedQuery.includes('integrationbyparts')) {
    return /uv/.test(normalizedAnswer) && /(du|vd|dv)/.test(normalizedAnswer)
  }

  if (normalizedQuery.includes('ohmslawformula') || normalizedQuery.includes("ohm'slawformula")) {
    return /v=ir/.test(normalizedAnswer)
  }

  if (normalizedQuery.includes('kineticenergyformula')) {
    return /(ek=1\/2mv\^2|1\/2mv\^2|frac\{1\}\{2\}mv\^2)/.test(normalizedAnswer)
  }

  if (normalizedQuery.includes('momentumformula')) {
    return /p=mv/.test(normalizedAnswer)
  }

  if (normalizedQuery.includes('densityformula')) {
    return /(rho=m\/v|density=mass\/volume|rho=mass\/volume)/.test(normalizedAnswer)
  }

  if (normalizedQuery.includes('moleformulachemistry') || normalizedQuery.includes('numberofmoles')) {
    return /(n=m\/m|n=mass\/molarmass|molar)/.test(normalizedAnswer)
  }

  if (normalizedQuery.includes('concentrationformula')) {
    return /(c=n\/v|concentration=moles\/volume)/.test(normalizedAnswer)
  }

  return null
}

function shouldAppendVerificationWarning(product: Product, query: string, confidence: string) {
  if (confidence === 'high') {
    return false
  }

  if (product === 'abroad') {
    return /\b(deadline|last date|closing date|amount|stipend|funding|visa|proof of funds)\b/i.test(query)
  }

  return /\b(formula|differentiate|integrate|equation|deadline|amount)\b/i.test(query)
}

export function buildDisplaySources({
  product,
  query,
  answer,
  sessionContext,
  sources,
}: {
  product: Product
  query: string
  answer: string
  sessionContext?: SessionContext | null
  sources: SourceChunkLike[]
}) {
  const activeSubject = sessionContext?.subject ?? inferSubject(query)

  return sources
    .filter((source) => (source.score ?? 0) >= 0.75 || String(source.tier ?? '').startsWith('uploaded_file_'))
    .filter((source) => product !== 'qbank' || sourceMatchesSubject(source, activeSubject))
    .slice(0, 3)
    .map((source) => ({
      title: humanizeSourceTitle(source.title),
      url: source.url ?? null,
      label: SOURCE_LABELS[String(source.tier ?? '')] ?? 'Source',
      verified: isVerifiedSource(source.tier),
      lastChecked: source.lastChecked ?? null,
      score: source.score ?? null,
    }))
}

export function validateAndFinalizeAnswer({
  query,
  answer,
  product,
  mode,
  deterministicGeneralAnswer,
  deterministicGroundedAnswer,
  deterministicScholarshipAnswer,
}: {
  query: string
  answer: string
  product: Product
  mode: PromptMode
  deterministicGeneralAnswer?: string | null
  deterministicGroundedAnswer?: string | null
  deterministicScholarshipAnswer?: string | null
}) {
  let nextAnswer = stripInternalTags(answer)
  let confidence: AnswerValidationResult['confidence'] = 'high'
  let factuallyGrounded = true
  const hallucinatedFacts: string[] = []
  const mathCorrect = product === 'qbank' ? isKnownMathAnswerCorrect(query, nextAnswer) : null

  if (containsInternalTags(answer)) {
    confidence = 'medium'
    hallucinatedFacts.push('internal source labels leaked into the student response')
  }

  if (hasKnownBrokenSpacing(nextAnswer)) {
    confidence = 'low'
    factuallyGrounded = false
    hallucinatedFacts.push('response contained OCR-style broken spacing')
  }

  if (mathCorrect === false) {
    confidence = 'low'
    factuallyGrounded = false
    hallucinatedFacts.push('math answer did not match the known correct formula')
  }

  if (deterministicScholarshipAnswer && confidence === 'low' && product === 'abroad') {
    nextAnswer = deterministicScholarshipAnswer
    confidence = 'high'
    factuallyGrounded = true
  } else if (deterministicGeneralAnswer && (mathCorrect === false || confidence === 'low')) {
    nextAnswer = deterministicGeneralAnswer
    confidence = 'high'
    factuallyGrounded = true
  } else if (deterministicGroundedAnswer && confidence === 'low' && mode === 'direct') {
    nextAnswer = deterministicGroundedAnswer
    confidence = 'medium'
  }

  if (
    shouldAppendVerificationWarning(product, query, confidence) &&
    !/please verify|always confirm|official website|official source/i.test(nextAnswer)
  ) {
    nextAnswer = `${nextAnswer}\n\nPlease verify this against the official source before relying on it.`
  }

  return {
    answer: nextAnswer.trim(),
    confidence,
    factuallyGrounded,
    hallucinatedFacts,
    mathCorrect,
  }
}
