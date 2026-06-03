import {
  evaluateDatasetQuality,
  type QualityResult,
  type DatasetQualityMeta,
} from '@/lib/dataset/qualityGate'

export type { QualityResult, DatasetQualityMeta }
export { evaluateDatasetQuality }

export type SyllabusTopicRow = {
  subject: string
  topic: string
  chapter?: string | null
  board?: string | null
  level?: string | null
}

export type KnowledgeBankCounts = {
  subject: string
  formulaCount: number
  theoryCount: number
  topicCount: number
  misconceptionCount: number
  chapterCount: number
  coveredTopics: string[]
}

export type KnowledgeAuditReport = {
  generatedAt: string
  complete: boolean
  subjects: Record<
    string,
    {
      chapterCount: number
      topicCount: number
      formulaCount: number
      theoryCount: number
      misconceptionCount: number
      missingTopics: string[]
      flagged: boolean
    }
  >
  totals: {
    formulaCount: number
    theoryCount: number
    topicCount: number
    misconceptionCount: number
    missingTopicCount: number
  }
}

const FALLBACK_SYLLABUS: Record<string, string[]> = {
  Physics: [
    'Wave Motion',
    'Forces and Motion',
    'Work, Energy and Power',
    'Electromagnetism',
    'Magnetism',
    'Electromagnetic Induction',
    'Thermal Physics',
    'Radioactivity',
    'Astrophysics',
  ],
  Chemistry: [
    'Chemical Bonding',
    'Organic Chemistry',
    'Rates of Reaction',
    'Energetics',
    'Stoichiometry',
    'Equilibrium',
    'Electrochemistry',
  ],
  Biology: [
    'Photosynthesis',
    'Cell Structure',
    'Enzymes',
    'Osmosis and Diffusion',
    'Respiration',
    'Genetics',
    'Ecology',
  ],
  Mathematics: [
    'Integration',
    'Differentiation',
    'Algebra',
    'Vectors',
    'Probability',
    'Trigonometric Differentiation',
    'Differential Equations',
  ],
  Economics: [
    'Law of Demand',
    'Market Structure',
    'Inflation',
    'Fiscal Policy',
    'Monetary Policy',
    'International Trade',
  ],
  Accounting: ['Ledgers', 'Balance Sheet', 'Profit and Loss', 'Depreciation', 'Cost Accounting'],
  Business: ['Leadership Styles', 'USP', 'Liquidity', 'Human Resource Management', 'Marketing Mix'],
  'Computer Science': [
    'Binary Arithmetic',
    'Data Structures',
    'Database Design',
    'Networking',
    'Boolean Logic',
  ],
  English: ['Reading Comprehension', 'Essay Writing', 'Grammar', 'Literary Analysis'],
}

function topicCovered(expected: string, actualTopics: string[]) {
  const needle = expected.toLowerCase()
  return actualTopics.some(
    (t) => t.toLowerCase().includes(needle) || needle.includes(t.toLowerCase())
  )
}

export function auditKnowledgeCoverageFromSyllabus(input: {
  syllabusTopics: SyllabusTopicRow[]
  bankCounts: KnowledgeBankCounts[]
}): { report: KnowledgeAuditReport; missingReport: { missingTopics: string[]; complete: boolean } } {
  const expectedBySubject = new Map<string, Set<string>>()

  for (const row of input.syllabusTopics) {
    const set = expectedBySubject.get(row.subject) ?? new Set<string>()
    set.add(row.topic)
    if (row.chapter) set.add(row.chapter)
    expectedBySubject.set(row.subject, set)
  }

  for (const [subject, topics] of Object.entries(FALLBACK_SYLLABUS)) {
    if (!expectedBySubject.has(subject)) {
      expectedBySubject.set(subject, new Set(topics))
    }
  }

  const resultSubjects: KnowledgeAuditReport['subjects'] = {}
  let totalFormulas = 0
  let totalTheory = 0
  let totalTopics = 0
  let totalMisconceptions = 0
  let missingTopicCount = 0
  const allMissing: string[] = []

  const subjects = Array.from(
    new Set([
      ...input.bankCounts.map((b) => b.subject),
      ...Array.from(expectedBySubject.keys()),
    ])
  )

  for (const subject of subjects) {
    const counts =
      input.bankCounts.find((b) => b.subject.toLowerCase() === subject.toLowerCase()) ?? {
        subject,
        formulaCount: 0,
        theoryCount: 0,
        topicCount: 0,
        misconceptionCount: 0,
        chapterCount: 0,
        coveredTopics: [],
      }

    const expected = Array.from(expectedBySubject.get(subject) ?? [])
    const missingTopics = expected.filter((t) => !topicCovered(t, counts.coveredTopics))

    if (missingTopics.length) {
      missingTopicCount += missingTopics.length
      allMissing.push(...missingTopics.map((t) => `${subject}: ${t}`))
    }

    resultSubjects[subject] = {
      chapterCount: counts.chapterCount || Math.max(1, Math.ceil(counts.topicCount / 3)),
      topicCount: counts.topicCount,
      formulaCount: counts.formulaCount,
      theoryCount: counts.theoryCount,
      misconceptionCount: counts.misconceptionCount,
      missingTopics,
      flagged: missingTopics.length > 0,
    }

    totalFormulas += counts.formulaCount
    totalTheory += counts.theoryCount
    totalTopics += counts.topicCount
    totalMisconceptions += counts.misconceptionCount
  }

  const complete = allMissing.length === 0

  const report: KnowledgeAuditReport = {
    generatedAt: new Date().toISOString(),
    complete,
    subjects: resultSubjects,
    totals: {
      formulaCount: totalFormulas,
      theoryCount: totalTheory,
      topicCount: totalTopics,
      misconceptionCount: totalMisconceptions,
      missingTopicCount,
    },
  }

  return {
    report,
    missingReport: { missingTopics: allMissing, complete },
  }
}

/** Legacy: audit from flat question rows when syllabus table is empty. */
export function auditKnowledgeCoverage(dbQuestions: Array<{
  subject?: string | null
  topic?: string | null
  resource_type?: string | null
  content?: string | null
}>): {
  report: KnowledgeAuditReport
  missingReport: { missingTopics: string[]; complete: boolean }
} {
  const bySubject = new Map<string, KnowledgeBankCounts>()

  for (const row of dbQuestions) {
    const subject = String(row.subject || 'General')
    const entry = bySubject.get(subject) ?? {
      subject,
      formulaCount: 0,
      theoryCount: 0,
      topicCount: 0,
      misconceptionCount: 0,
      chapterCount: 0,
      coveredTopics: [],
    }

    const rt = String(row.resource_type || '')
    if (rt === 'formula' || (rt === 'concept' && /formula|equation/i.test(row.content || ''))) {
      entry.formulaCount++
    }
    if (['theory', 'concept', 'concept_guide'].includes(rt)) {
      entry.theoryCount++
    }
    if (rt === 'concept' && /misconception|trap|common error/i.test(row.content || '')) {
      entry.misconceptionCount++
    }
    if (row.topic) {
      entry.coveredTopics.push(String(row.topic))
      entry.topicCount = new Set(entry.coveredTopics).size
    }
    bySubject.set(subject, entry)
  }

  return auditKnowledgeCoverageFromSyllabus({
    syllabusTopics: [],
    bankCounts: Array.from(bySubject.values()),
  })
}
