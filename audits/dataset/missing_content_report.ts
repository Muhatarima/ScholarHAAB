import fs from 'node:fs'
import path from 'node:path'
import { jsonlPath, readJsonl, writeJson } from '../../scripts/dataset_common'

export type QualityResult = {
  name: string
  score: number
  licenseOk: boolean
  relevanceOk: boolean
  subjectOk: boolean
  boardOk: boolean
  dedupedOk: boolean
  passed: boolean
  details: string
}

export type KnowledgeAuditReport = {
  generatedAt: string
  subjects: Record<string, {
    chapterCount: number
    topicCount: number
    formulaCount: number
    theoryCount: number
    misconceptionCount: number
    missingTopics: string[]
  }>
  totals: {
    formulaCount: number
    theoryCount: number
    topicCount: number
    misconceptionCount: number
  }
}

// Enforces Dataset Quality Score (0-100, reject <70)
export function evaluateDatasetQuality(meta: {
  name: string
  license: string
  relevance: boolean
  subjectMapped: boolean
  boardSupported: boolean
  hasDuplicates: boolean
}): QualityResult {
  let score = 0
  
  // 1. License Check (permitted / user-provided)
  const licenseLower = String(meta.license || '').toLowerCase()
  const isPermitted = [
    'cc0', 'cc-by', 'cc by', 'creative commons', 'mit', 'apache',
    'public domain', 'user_provided', 'user provided', 'permitted', 'open government'
  ].some(term => licenseLower.includes(term))

  if (isPermitted) score += 30

  // 2. Educational Relevance
  if (meta.relevance) score += 20

  // 3. Subject Mapping
  if (meta.subjectMapped) score += 20

  // 4. Board Compatibility
  if (meta.boardSupported) score += 15

  // 5. Deduplication verification
  if (!meta.hasDuplicates) score += 15

  const passed = score >= 70 && isPermitted

  return {
    name: meta.name,
    score,
    licenseOk: isPermitted,
    relevanceOk: meta.relevance,
    subjectOk: meta.subjectMapped,
    boardOk: meta.boardSupported,
    dedupedOk: !meta.hasDuplicates,
    passed,
    details: `Dataset Score: ${score}/100. License status: ${isPermitted ? 'Permitted' : 'Rejected'}.`
  }
}

// Generate missing topics report based on expected vs actual syllabus topics
export function auditKnowledgeCoverage(dbQuestions: any[]): {
  report: KnowledgeAuditReport
  missingReport: { missingTopics: string[] }
} {
  const subjects = [
    'Physics', 'Chemistry', 'Biology', 'Mathematics', 'Further Mathematics',
    'Accounting', 'Economics', 'Business', 'ICT', 'Computer Science', 'English'
  ]

  const resultSubjects: KnowledgeAuditReport['subjects'] = {}
  let totalFormulas = 0
  let totalTheory = 0
  let totalTopics = 0
  let totalMisconceptions = 0

  // Seed expected topics if not present
  const expectedSyllabusTopics: Record<string, string[]> = {
    'Physics': ['Wave Motion', 'Forces and Motion', 'Work, Energy and Power', 'Electromagnetism', 'Thermal Physics', 'Radioactivity', 'Astrophysics'],
    'Chemistry': ['Chemical Bonding', 'Organic Chemistry', 'Rates of Reaction', 'Energetics', 'Stoichiometry', 'Equilibrium', 'Electrochemistry'],
    'Biology': ['Photosynthesis', 'Cell Structure', 'Enzymes', 'Osmosis and Diffusion', 'Respiration', 'Genetics', 'Ecology'],
    'Mathematics': ['Integration', 'Differentiation', 'Algebra', 'Vectors', 'Probability', 'Trigonometric Differentiation', 'Differential Equations'],
    'Economics': ['Law of Demand', 'Market Structure', 'Inflation', 'Fiscal Policy', 'Monetary Policy', 'International Trade'],
    'Accounting': ['Ledgers', 'Balance Sheet', 'Profit and Loss', 'Depreciation', 'Cost Accounting'],
    'Business': ['Leadership Styles', 'USP', 'Liquidity', 'Human Resource Management', 'Marketing Mix'],
    'Computer Science': ['Binary Arithmetic', 'Data Structures', 'Database Design', 'Networking', 'Boolean Logic'],
    'English': ['Reading Comprehension', 'Essay Writing', 'Grammar', 'Literary Analysis']
  }

  for (const sub of subjects) {
    // Filter questions by subject
    const subRows = dbQuestions.filter(q => String(q.subject || '').toLowerCase() === sub.toLowerCase())
    
    // Extrapolate counts from resource types
    const formulas = subRows.filter(q => q.resource_type === 'formula' || q.resource_type === 'concept' && /formula|equation/i.test(q.content || ''))
    const theory = subRows.filter(q => ['theory', 'concept', 'concept_guide'].includes(q.resource_type))
    const misconceptions = subRows.filter(q => q.resource_type === 'concept' && /misconception|trap|common error/i.test(q.content || ''))

    // Unique topics
    const uniqueTopics = Array.from(new Set(subRows.map(q => q.topic).filter(Boolean))) as string[]

    const expected = expectedSyllabusTopics[sub] || []
    const missingTopics = expected.filter(expectedTopic => 
      !uniqueTopics.some(t => String(t).toLowerCase().includes(expectedTopic.toLowerCase()))
    )

    resultSubjects[sub] = {
      chapterCount: Math.max(1, Math.ceil(uniqueTopics.length / 3)),
      topicCount: uniqueTopics.length,
      formulaCount: formulas.length,
      theoryCount: theory.length,
      misconceptionCount: misconceptions.length,
      missingTopics
    }

    totalFormulas += formulas.length
    totalTheory += theory.length
    totalTopics += uniqueTopics.length
    totalMisconceptions += misconceptions.length
  }

  const report: KnowledgeAuditReport = {
    generatedAt: new Date().toISOString(),
    subjects: resultSubjects,
    totals: {
      formulaCount: totalFormulas,
      theoryCount: totalTheory,
      topicCount: totalTopics,
      misconceptionCount: totalMisconceptions
    }
  }

  const allMissing = Object.values(resultSubjects).flatMap(s => s.missingTopics)

  return {
    report,
    missingReport: { missingTopics: allMissing }
  }
}
