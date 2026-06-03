import { assertProductionQuality, evaluateDatasetQuality, type DatasetQualityMeta } from '@/lib/dataset/qualityGate'

/** Curated HF datasets allowed after quality gate (Layer 7 — not blind import). */
export const APPROVED_HF_DATASETS: Record<
  string,
  { license: string; subjects: string[]; boards: string[]; relevance: boolean }
> = {
  'cais/mmlu': {
    license: 'mit',
    subjects: ['Physics', 'Chemistry', 'Biology', 'Mathematics', 'Economics'],
    boards: ['Cambridge', 'Edexcel'],
    relevance: true,
  },
  'allenai/sciq': {
    license: 'cc-by',
    subjects: ['Physics', 'Chemistry', 'Biology'],
    boards: ['Cambridge', 'Edexcel'],
    relevance: true,
  },
  'derek-thomas/ScienceQA': {
    license: 'apache',
    subjects: ['Physics', 'Chemistry', 'Biology'],
    boards: ['Cambridge', 'Edexcel'],
    relevance: true,
  },
  'gsm8k': {
    license: 'mit',
    subjects: ['Mathematics'],
    boards: ['Cambridge', 'Edexcel'],
    relevance: true,
  },
}

export type HfImportDecision = {
  allowed: boolean
  quality: ReturnType<typeof evaluateDatasetQuality>
  reason: string
}

export function evaluateHfDatasetImport(input: {
  datasetId: string
  subject: string
  board: string
  level: string
  sampleText?: string
  hasDuplicates?: boolean
}): HfImportDecision {
  const catalog = APPROVED_HF_DATASETS[input.datasetId]
  if (!catalog) {
    const quality = evaluateDatasetQuality(
      {
        name: input.datasetId,
        license: 'unknown',
        relevance: false,
        subjectMapped: false,
        boardSupported: false,
        hasDuplicates: input.hasDuplicates ?? false,
        lowQualityOrGenerated: true,
        board: input.board,
        level: input.level,
        subject: input.subject,
      },
      input.sampleText
    )
    return {
      allowed: false,
      quality,
      reason: 'Dataset not on approved list — blind HF import blocked.',
    }
  }

  const subjectMapped = catalog.subjects.some(
    (s) => s.toLowerCase() === input.subject.toLowerCase()
  )
  const boardSupported = catalog.boards.some(
    (b) => b.toLowerCase() === input.board.toLowerCase()
  )

  const meta: DatasetQualityMeta = {
    name: input.datasetId,
    license: catalog.license,
    relevance: catalog.relevance,
    subjectMapped,
    boardSupported,
    hasDuplicates: input.hasDuplicates ?? false,
    board: input.board,
    level: input.level,
    subject: input.subject,
  }

  const quality = evaluateDatasetQuality(meta, input.sampleText)
  return {
    allowed: quality.passed,
    quality,
    reason: quality.passed
      ? 'Approved for Layer 7 public education chunks.'
      : quality.details,
  }
}

export function assertHfImportAllowed(input: Parameters<typeof evaluateHfDatasetImport>[0]) {
  const decision = evaluateHfDatasetImport(input)
  if (!decision.allowed) {
    throw new Error(decision.reason)
  }
  assertProductionQuality(
    {
      name: input.datasetId,
      license: APPROVED_HF_DATASETS[input.datasetId]?.license ?? 'unknown',
      relevance: true,
      subjectMapped: true,
      boardSupported: true,
      hasDuplicates: input.hasDuplicates ?? false,
      board: input.board,
      level: input.level,
      subject: input.subject,
    },
    input.sampleText
  )
  return decision
}
