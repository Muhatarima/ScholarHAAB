import { getSupabaseAdmin } from '@/lib/server/supabase-admin'
import type { QuestionAnalysis } from '@/lib/paper-solver/questionAnalyzer'
import type { PatternRetrievalResult } from '@/lib/paper-solver/patternRetriever'

export type MarkSchemePattern = {
  requiredPoints: string[]
  optionalPoints: string[]
  commonMistakes: string[]
  markAllocationPattern: string[]
  examinerKeywords: string[]
  source: 'mark_scheme_patterns' | 'paper_pattern' | 'local_pattern'
}

function localByQuestionType(analysis: QuestionAnalysis): MarkSchemePattern {
  if (analysis.questionType === 'calculation') {
    return {
      requiredPoints: ['Correct formula', 'Correct substitution', 'Correct final value', 'Correct unit'],
      optionalPoints: ['Clear rearrangement if needed'],
      commonMistakes: ['Wrong sign', 'Missing unit', 'Rounding too early'],
      markAllocationPattern: ['Formula mark [1]', 'Substitution mark [1]', 'Answer mark [1]', 'Unit mark [1]'],
      examinerKeywords: ['formula', 'substitution', 'answer', 'unit'],
      source: 'local_pattern',
    }
  }

  if (analysis.questionType === 'experiment design') {
    return {
      requiredPoints: ['Repeat the experiment', 'Calculate a mean', 'Control key variables', 'Use the same apparatus/method'],
      optionalPoints: ['Remove anomalies', 'Use a wider range of readings', 'Plot a graph if appropriate'],
      commonMistakes: ['Saying accurate/reliable without a practical method.'],
      markAllocationPattern: ['Method improvement [1]', 'Repeat/mean [1]', 'Control variable [1]', 'Data handling [1]'],
      examinerKeywords: ['repeat', 'average', 'control variable', 'same apparatus'],
      source: 'local_pattern',
    }
  }

  if (analysis.commandWord === 'explain' || analysis.commandWord === 'justify' || analysis.commandWord === 'suggest') {
    return {
      requiredPoints: ['Correct cause', 'Correct mechanism', 'Correct effect', 'Clear conclusion'],
      optionalPoints: ['Use particle model if relevant', 'Link to the exact context in the question'],
      commonMistakes: ['Listing facts without cause-to-effect links.'],
      markAllocationPattern: ['Concept mark [1]', 'Cause/mechanism mark [1]', 'Effect mark [1]', 'Conclusion/context mark [1]'],
      examinerKeywords: ['because', 'therefore', 'so', 'increases', 'decreases'],
      source: 'local_pattern',
    }
  }

  return {
    requiredPoints: ['Correct definition or concept', 'Application to the question', 'Exam keyword'],
    optionalPoints: ['Example if it helps'],
    commonMistakes: ['Writing a vague sentence without keywords.'],
    markAllocationPattern: ['Knowledge mark [1]', 'Application mark [1]', 'Keyword mark [1]'],
    examinerKeywords: ['definition', 'application', 'keyword'],
    source: 'local_pattern',
  }
}

async function retrieveDbMarkSchemePattern(analysis: QuestionAnalysis): Promise<MarkSchemePattern | null> {
  try {
    const supabase = getSupabaseAdmin()
    let query = supabase
      .from('mark_scheme_patterns')
      .select('required_points, optional_points, common_wrong_answers, mark_allocation_pattern, examiner_keywords')
      .limit(1)

    if (analysis.subject) query = query.ilike('subject', `%${analysis.subject}%`)
    if (analysis.topic) query = query.ilike('topic', `%${analysis.topic}%`)
    if (analysis.questionType) query = query.ilike('question_type', `%${analysis.questionType}%`)
    if (analysis.commandWord !== 'unknown') query = query.ilike('command_word', `%${analysis.commandWord}%`)

    const { data, error } = await query
    const row = data?.[0] as Record<string, unknown> | undefined
    if (error || !row) return null

    return {
      requiredPoints: Array.isArray(row.required_points) ? row.required_points.map(String) : [],
      optionalPoints: Array.isArray(row.optional_points) ? row.optional_points.map(String) : [],
      commonMistakes: Array.isArray(row.common_wrong_answers) ? row.common_wrong_answers.map(String) : [],
      markAllocationPattern: Array.isArray(row.mark_allocation_pattern) ? row.mark_allocation_pattern.map(String) : [],
      examinerKeywords: Array.isArray(row.examiner_keywords) ? row.examiner_keywords.map(String) : [],
      source: 'mark_scheme_patterns',
    }
  } catch {
    return null
  }
}

export async function retrieveMarkSchemePattern(
  analysis: QuestionAnalysis,
  patterns: PatternRetrievalResult
): Promise<MarkSchemePattern> {
  const dbPattern = await retrieveDbMarkSchemePattern(analysis)
  if (dbPattern && dbPattern.requiredPoints.length) return dbPattern

  const topPattern = patterns.matchedPatterns[0]
  const local = localByQuestionType(analysis)
  if (!topPattern) return local

  return {
    requiredPoints: topPattern.markSchemeKeywords.length ? topPattern.markSchemeKeywords : local.requiredPoints,
    optionalPoints: local.optionalPoints,
    commonMistakes: topPattern.commonMistakes.length ? topPattern.commonMistakes : local.commonMistakes,
    markAllocationPattern: local.markAllocationPattern,
    examinerKeywords: topPattern.markSchemeKeywords.length ? topPattern.markSchemeKeywords : local.examinerKeywords,
    source: 'paper_pattern',
  }
}
