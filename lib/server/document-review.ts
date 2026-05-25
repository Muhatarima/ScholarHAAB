import { generateResponse } from '@/lib/ai-service'
import { createRequestId, logError } from '@/lib/server/logger'

export type ReviewDocumentType = 'sop' | 'lor' | 'cv'

export type ReviewIssue = {
  label: string
  severity: 'high' | 'medium' | 'low'
  detail: string
}

export type ReviewStrength = {
  label: string
  detail: string
}

export type DocumentReviewResult = {
  documentType: ReviewDocumentType
  score: number
  verdict: 'strong' | 'promising' | 'weak'
  outlook?: {
    currentReadiness: string
    improvedReadiness: string
    message: string
  }
  strengths: ReviewStrength[]
  issues: ReviewIssue[]
  nextSteps: string[]
}

const GENERIC_PHRASES = [
  'i am passionate',
  'from a young age',
  'i have always wanted',
  'dream university',
  'hardworking and dedicated',
  'best fit for me',
]

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function countMatches(text: string, pattern: RegExp) {
  return text.match(pattern)?.length ?? 0
}

function hasAny(text: string, phrases: string[]) {
  return phrases.some((phrase) => text.includes(phrase))
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value))
}

function buildVerdict(score: number): DocumentReviewResult['verdict'] {
  if (score >= 78) return 'strong'
  if (score >= 58) return 'promising'
  return 'weak'
}

function reviewDocumentFallback(documentType: ReviewDocumentType, content: string): DocumentReviewResult {
  const normalized = normalize(content)
  const wordCount = normalized.split(' ').filter(Boolean).length
  const paragraphs = content.split(/\n\s*\n/).filter((entry) => entry.trim().length > 0).length
  const numericEvidence = countMatches(content, /\b\d+(\.\d+)?%?\b/g)
  const namedEvidence = countMatches(content, /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}\b/g)
  const genericCount = GENERIC_PHRASES.filter((phrase) => normalized.includes(phrase)).length

  let score = 52
  const strengths: ReviewStrength[] = []
  const issues: ReviewIssue[] = []
  const nextSteps: string[] = []

  if (paragraphs >= 4) {
    score += 8
    strengths.push({ label: 'Clear structure', detail: 'The draft is broken into readable sections instead of one wall of text.' })
  } else {
    issues.push({ label: 'Weak structure', severity: 'medium', detail: 'Break the draft into clearer sections so the reviewer can follow your logic fast.' })
    nextSteps.push('Split the draft into 4-6 short paragraphs with one purpose each.')
  }

  if (numericEvidence >= 2 || namedEvidence >= 6) {
    score += 10
    strengths.push({ label: 'Specific evidence', detail: 'The draft includes concrete examples instead of only vague claims.' })
  } else {
    issues.push({ label: 'Too generic', severity: 'high', detail: 'The draft needs stronger evidence, examples, achievements, or measurable details.' })
    nextSteps.push('Add 2-3 concrete examples with projects, results, or achievements.')
  }

  if (genericCount >= 2) {
    score -= 10
    issues.push({ label: 'Generic phrasing', severity: 'medium', detail: 'Some lines sound template-like and could appear in many other applications.' })
    nextSteps.push('Replace generic motivation lines with specific reasons tied to your profile and goal.')
  }

  if (documentType === 'sop') {
    if (wordCount >= 500 && wordCount <= 1100) {
      score += 10
      strengths.push({ label: 'Reasonable SOP length', detail: 'The length is in a useful range for a serious statement draft.' })
    } else {
      issues.push({ label: 'SOP length risk', severity: 'medium', detail: 'The SOP may be too short to persuade or too long to stay sharp.' })
      nextSteps.push('Aim for a tight SOP that covers motivation, evidence, fit, and future goal without filler.')
    }

    if (hasAny(normalized, ['goal', 'research', 'program', 'university', 'career'])) {
      score += 8
      strengths.push({ label: 'Goal and fit signals', detail: 'The SOP shows some connection between the program and your future direction.' })
    } else {
      issues.push({ label: 'Weak program fit', severity: 'high', detail: 'The SOP does not clearly connect your background to the target program.' })
      nextSteps.push('Add one paragraph that explains why this program and why now.')
    }
  }

  if (documentType === 'lor') {
    if (hasAny(normalized, ['i taught', 'i supervised', 'in my class', 'under my supervision', 'as faculty'])) {
      score += 10
      strengths.push({ label: 'Recommender context', detail: 'The draft explains how the recommender knows the student.' })
    } else {
      issues.push({ label: 'Missing recommender context', severity: 'high', detail: 'A good recommendation needs the relationship, duration, and context up front.' })
      nextSteps.push('State how the recommender knows the student, for how long, and in what setting.')
    }

    if (hasAny(normalized, ['top', 'rank', 'compared', 'among', 'cohort'])) {
      score += 8
      strengths.push({ label: 'Comparative signal', detail: 'The letter includes some comparative evaluation, which makes praise more credible.' })
    } else {
      issues.push({ label: 'Praise without comparison', severity: 'medium', detail: 'The letter praises the student but does not show how they stand out.' })
      nextSteps.push('Add one comparative sentence like ranking, cohort context, or performance relative to peers.')
    }
  }

  if (documentType === 'cv') {
    if (hasAny(normalized, ['education', 'experience', 'project', 'skill'])) {
      score += 10
      strengths.push({ label: 'Core CV sections', detail: 'The draft contains some of the expected academic CV sections.' })
    } else {
      issues.push({ label: 'Missing CV sections', severity: 'high', detail: 'An academic CV needs clear sections for education, experience, projects, and skills.' })
      nextSteps.push('Add clear section headers for education, experience, projects, skills, and achievements.')
    }

    if (numericEvidence >= 3) {
      score += 8
      strengths.push({ label: 'Outcome-oriented bullets', detail: 'There are numbers or measurable details, which improve credibility.' })
    } else {
      issues.push({ label: 'Weak evidence in bullets', severity: 'medium', detail: 'CV lines should show impact, not just duties or vague participation.' })
      nextSteps.push('Rewrite bullets with outcomes, tools, scope, or measurable impact.')
    }
  }

  score = clamp(score)

  if (strengths.length === 0) {
    strengths.push({ label: 'Usable draft base', detail: 'The text is enough to start a focused improvement pass.' })
  }

  if (nextSteps.length === 0) {
    nextSteps.push('Do one final pass for specificity, shorter sentences, and stronger evidence.')
  }

  return {
    documentType,
    score,
    verdict: buildVerdict(score),
    outlook: {
      currentReadiness: 'Needs revision',
      improvedReadiness: score >= 58 ? 'Competitive with stronger evidence' : 'Much stronger after revision',
      message:
        'This is a document-quality outlook, not an admission guarantee. The fastest gain will come from stronger evidence, cleaner structure, and clearer fit.'
    },
    strengths: strengths.slice(0, 4),
    issues: issues.slice(0, 5),
    nextSteps: nextSteps.slice(0, 4),
  }
}

export async function reviewDocument(documentType: ReviewDocumentType, content: string): Promise<DocumentReviewResult> {
  const requestId = createRequestId()
  const trimmedContent = content.trim()

  if (!trimmedContent) {
    return reviewDocumentFallback(documentType, content)
  }

  const prompt = `
You are the ScholarHAAB Document Evaluator.
Analyze this ${documentType.toUpperCase()} based on these dimensions:
For SOP: Opening hook, research narrative depth, quantified achievements, scholarship fit, Bangladesh return impact, future goals specificity, language quality.
For LOR: Specificity, relative ranking, recommender credibility, quantified outcomes, enthusiasm.
For CV / Resume: Relevance, achievement framing, gaps, formatting, impact quantification.

Respond ONLY in valid JSON matching this exact schema:
{
  "documentType": "${documentType}",
  "score": number (0-100),
  "verdict": "strong" | "promising" | "weak",
  "outlook": {
    "currentReadiness": "Needs revision" | "Usable with fixes" | "Competitive",
    "improvedReadiness": "Usable with fixes" | "Competitive" | "Strongly competitive",
    "message": "Brief honest outlook without fake percentages."
  },
  "strengths": [{ "label": "Short String", "detail": "Details" }, ...upto 4],
  "issues": [{ "label": "Short String", "severity": "high" | "medium" | "low", "detail": "Details" }, ...upto 5],
  "nextSteps": ["String step 1", ...upto 4]
}

Document Content:
${trimmedContent.substring(0, 5000)}
`
  try {
    const raw = await generateResponse(
      prompt,
      'You are an explicit JSON API responding ONLY in pure JSON with no markdown blocks or backticks.',
      {
        maxTokens: 800,
        requestId,
        operation: 'document_review',
      }
    )
    const cleaned = raw.replace(/^```[a-z]*\n/i, '').replace(/\n```$/m, '').trim()
    const parsed = JSON.parse(cleaned) as DocumentReviewResult
    return parsed
  } catch (error) {
    logError('document_review_failed', error, {
      request_id: requestId,
      document_type: documentType,
    })
    return reviewDocumentFallback(documentType, content)
  }
}
