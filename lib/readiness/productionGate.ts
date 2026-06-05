import fs from 'node:fs'
import path from 'node:path'
import { KNOWLEDGE_LAYERS } from '@/lib/knowledge/layers'

export const PRODUCTION_THRESHOLDS = {
  datasetCoverage: 95,
  retrievalTop1: 95,
  retrievalTop3: 98,
  mathAccuracy: 99,
  physicsAccuracy: 97,
  chemistryAccuracy: 97,
  biologyAccuracy: 95,
  markSchemeSimilarity: 95,
  unknownQuestionAccuracy: 95,
} as const

export type ProductionMetrics = {
  datasetCoverage: number | null
  knowledgeCoverage: number | null
  retrievalTop1: number | null
  retrievalTop3: number | null
  mathAccuracy: number | null
  physicsAccuracy: number | null
  chemistryAccuracy: number | null
  biologyAccuracy: number | null
  markSchemeSimilarity: number | null
  unknownQuestionAccuracy: number | null
  buildPasses: boolean | null
  testsPass: boolean | null
}

export type ModuleStatus = {
  id: number
  name: string
  completenessPercent: number
  status: 'production' | 'partial' | 'stub'
  keyPaths: string[]
  gaps: string[]
}

export type ProductionReadinessReport = {
  generatedAt: string
  readinessScore: number
  passedGates: boolean
  productionReady: boolean
  metrics: ProductionMetrics
  gateResults: Record<string, { value: number | null; threshold: number; passed: boolean }>
  modules: ModuleStatus[]
  architecture: {
    pipeline: string[]
    knowledgeLayers: typeof KNOWLEDGE_LAYERS
    neverDirectLlmFirst: boolean
  }
  datasets: {
    coverageReportPath: string
    missingTopicsPath: string
    qualityReportPath: string
  }
  remainingLimitations: string[]
  personaMix: Record<string, string>
}

function readJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T
  } catch {
    return null
  }
}

function gate(value: number | null, threshold: number) {
  return {
    value,
    threshold,
    passed: value !== null && value >= threshold,
  }
}

export function loadMeasuredMetrics(root = process.cwd()): ProductionMetrics {
  const torture = readJson<{
    gates?: { mathAccuracy?: number; numericalPhysicsAccuracy?: number; passed?: boolean }
  }>(path.join(root, 'test-results', 'academic_torture_report.json'))

  const retrieval = readJson<{ accuracy?: number; top3Accuracy?: number }>(
    path.join(root, 'test-results', 'retrieval_benchmark_report.json')
  )

  const redTeam = readJson<{ accuracy?: number; markSchemeSimilarity?: number }>(
    path.join(root, 'test-results', 'red_team_report.json')
  )

  const coverage = readJson<{ coverage_percent?: number }>(
    path.join(root, 'dataset', 'reports', 'coverage_report.json')
  )

  const knowledge = readJson<{ complete?: boolean; totals?: { missingTopicCount?: number } }>(
    path.join(root, 'dataset', 'reports', 'knowledge_coverage_report.json')
  )

  const missing = readJson<{ complete?: boolean; missingTopics?: string[] }>(
    path.join(root, 'dataset', 'reports', 'missing_topics_report.json')
  )

  const mathAccuracy = torture?.gates?.mathAccuracy ?? null
  const physicsAccuracy = torture?.gates?.numericalPhysicsAccuracy ?? null

  let knowledgeCoverage: number | null = null
  if (knowledge?.complete === true) knowledgeCoverage = 100
  else if (missing?.missingTopics) {
    const missingCount = missing.missingTopics.length
    knowledgeCoverage = Math.max(0, Math.round(100 - missingCount * 2))
  }

  return {
    datasetCoverage: coverage?.coverage_percent ?? null,
    knowledgeCoverage,
    retrievalTop1: retrieval?.accuracy ?? null,
    retrievalTop3: retrieval?.top3Accuracy ?? (retrieval?.accuracy != null ? null : null),
    mathAccuracy,
    physicsAccuracy,
    chemistryAccuracy: redTeam?.accuracy ?? null,
    biologyAccuracy: redTeam?.accuracy ?? null,
    markSchemeSimilarity: redTeam?.markSchemeSimilarity ?? null,
    unknownQuestionAccuracy: redTeam?.accuracy ?? null,
    buildPasses: null,
    testsPass: torture?.gates?.passed ?? null,
  }
}

export const MODULE_REGISTRY: ModuleStatus[] = [
  { id: 1, name: 'Verified Paper Solver', completenessPercent: 78, status: 'partial', keyPaths: ['lib/paper-solver/solvePipeline.ts', 'app/api/solve/route.ts'], gaps: ['Edexcel corpus sparse', 'Verified path skips knowledge router'] },
  { id: 2, name: 'Pattern Reasoning Engine', completenessPercent: 72, status: 'partial', keyPaths: ['lib/paper-solver/patternRetriever.ts'], gaps: ['Local patterns limited', 'Dual pattern systems'] },
  { id: 3, name: 'Academic Reasoning', completenessPercent: 74, status: 'partial', keyPaths: ['lib/reasoning/academicReasoner.ts'], gaps: ['Rule-based not full multi-hop LLM'] },
  { id: 4, name: 'Concept Graph', completenessPercent: 58, status: 'partial', keyPaths: ['lib/knowledge/retrieveConceptGraph.ts'], gaps: ['Sparse graph in DB', 'Small local prereqs'] },
  { id: 5, name: 'Formula Engine', completenessPercent: 62, status: 'partial', keyPaths: ['lib/math/formulaEngine.ts', 'lib/knowledge/retrieveFormula.ts'], gaps: ['Incomplete formula_bank population'] },
  { id: 6, name: 'Theory Engine', completenessPercent: 65, status: 'partial', keyPaths: ['lib/theory/theoryEngine.ts'], gaps: ['theory_bank coverage incomplete'] },
  { id: 7, name: 'Misconception Engine', completenessPercent: 70, status: 'partial', keyPaths: ['lib/reasoning/misconceptionDetector.ts'], gaps: ['Regex + DB not fully unified'] },
  { id: 8, name: 'Human Tutor Mode', completenessPercent: 75, status: 'partial', keyPaths: ['lib/tutor/humanTutorFormatter.ts', 'lib/ai/tutorEngine.ts'], gaps: ['Not all routes use tutor formatter'] },
  { id: 9, name: 'Exam Mode', completenessPercent: 73, status: 'partial', keyPaths: ['lib/exam/examModePlanner.ts', 'app/api/exam-plan/route.ts'], gaps: ['Client fallback plans'] },
  { id: 10, name: 'Mock Exam Engine', completenessPercent: 71, status: 'partial', keyPaths: ['app/api/mock/generate/route.ts'], gaps: ['Heuristic grading'] },
  { id: 11, name: 'Performance Dashboard', completenessPercent: 76, status: 'partial', keyPaths: ['app/api/dashboard/route.ts'], gaps: ['Dual dashboard APIs'] },
  { id: 12, name: 'Multimodal Input', completenessPercent: 79, status: 'partial', keyPaths: ['lib/input/multimodalProcessor.ts'], gaps: ['OCR below 95% not hard-rejected'] },
  { id: 13, name: 'Mathematics Engine', completenessPercent: 81, status: 'partial', keyPaths: ['lib/math/sympyEngine.ts'], gaps: ['Requires Python runtime'] },
  { id: 14, name: 'LaTeX / Graph / Diagrams', completenessPercent: 67, status: 'partial', keyPaths: ['components/math/LatexRenderer.tsx'], gaps: ['No diagram generator'] },
  { id: 15, name: 'Knowledge System', completenessPercent: 83, status: 'partial', keyPaths: ['lib/knowledge/layers.ts'], gaps: ['Layer order not enforced on all routes'] },
  { id: 16, name: 'Dataset Governance', completenessPercent: 76, status: 'partial', keyPaths: ['lib/dataset/qualityGate.ts', 'audits/dataset/'], gaps: ['Processed JSONL offline'] },
  { id: 17, name: 'Retrieval Benchmark', completenessPercent: 71, status: 'partial', keyPaths: ['testing/retrieval/retrieval_benchmark.ts'], gaps: ['Not in default npm test', 'Board metadata failures'] },
  { id: 18, name: 'Academic Red Team', completenessPercent: 63, status: 'partial', keyPaths: ['testing/red-team/academic_red_team.ts'], gaps: ['Template variants not 10k unique'] },
  { id: 19, name: 'Self-Improvement Loop', completenessPercent: 58, status: 'partial', keyPaths: ['lib/server/feedback-improvement.ts'], gaps: ['No auto prompt retrain'] },
  { id: 20, name: 'Production Gate', completenessPercent: 82, status: 'partial', keyPaths: ['lib/readiness/productionGate.ts'], gaps: ['Metrics need live DB for full pass'] },
]

export function evaluateProductionGate(metrics: ProductionMetrics): {
  gateResults: ProductionReadinessReport['gateResults']
  passedGates: boolean
  readinessScore: number
} {
  const gateResults: ProductionReadinessReport['gateResults'] = {
    datasetCoverage: gate(metrics.datasetCoverage, PRODUCTION_THRESHOLDS.datasetCoverage),
    retrievalTop1: gate(metrics.retrievalTop1, PRODUCTION_THRESHOLDS.retrievalTop1),
    retrievalTop3: gate(metrics.retrievalTop3, PRODUCTION_THRESHOLDS.retrievalTop3),
    mathAccuracy: gate(metrics.mathAccuracy, PRODUCTION_THRESHOLDS.mathAccuracy),
    physicsAccuracy: gate(metrics.physicsAccuracy, PRODUCTION_THRESHOLDS.physicsAccuracy),
    chemistryAccuracy: gate(metrics.chemistryAccuracy, PRODUCTION_THRESHOLDS.chemistryAccuracy),
    biologyAccuracy: gate(metrics.biologyAccuracy, PRODUCTION_THRESHOLDS.biologyAccuracy),
    markSchemeSimilarity: gate(metrics.markSchemeSimilarity, PRODUCTION_THRESHOLDS.markSchemeSimilarity),
    unknownQuestionAccuracy: gate(metrics.unknownQuestionAccuracy, PRODUCTION_THRESHOLDS.unknownQuestionAccuracy),
  }

  const coreGates = [
    'datasetCoverage',
    'retrievalTop1',
    'mathAccuracy',
    'physicsAccuracy',
    'chemistryAccuracy',
    'biologyAccuracy',
    'markSchemeSimilarity',
    'unknownQuestionAccuracy',
  ] as const

  const passedGates = coreGates.every((key) => gateResults[key].passed)

  const scored = Object.values(gateResults)
    .map((g) => (g.value === null ? 0 : Math.min(100, g.value)))
    .filter((v) => v > 0)

  const moduleAvg = Math.round(
    MODULE_REGISTRY.reduce((sum, m) => sum + m.completenessPercent, 0) / MODULE_REGISTRY.length
  )

  const readinessScore =
    scored.length > 0
      ? Math.round((scored.reduce((a, b) => a + b, 0) / scored.length + moduleAvg) / 2)
      : moduleAvg

  return { gateResults, passedGates, readinessScore }
}

export function buildProductionReadinessReport(root = process.cwd()): ProductionReadinessReport {
  const metrics = loadMeasuredMetrics(root)
  const { gateResults, passedGates, readinessScore } = evaluateProductionGate(metrics)

  const remainingLimitations = [
    'Production gate requires live Supabase with ≥95% paper coverage — current dataset audit may show 0% in dev.',
    'Retrieval benchmark must return board metadata on Top-1 hits before Top-1 ≥95% is achievable.',
    'Chemistry/Biology accuracy use red-team proxy until per-subject suites exist.',
    'Edexcel past papers need manifest indexing.',
    'Never mark VERIFIED without exact question + mark scheme (enforced in solvePipeline).',
  ]

  if (metrics.datasetCoverage !== null && metrics.datasetCoverage < 50) {
    remainingLimitations.unshift(`Dataset coverage is ${metrics.datasetCoverage}% — ingest Cambridge/Edexcel papers before production.`)
  }

  return {
    generatedAt: new Date().toISOString(),
    readinessScore,
    passedGates,
    productionReady: passedGates && (metrics.testsPass ?? false),
    metrics,
    gateResults,
    modules: MODULE_REGISTRY,
    architecture: {
      pipeline: [
        'Input',
        'OCR/Vision',
        'Intent Detection',
        'Board / Level / Subject / Topic Detection',
        'Exact Retrieval',
        'Pattern Retrieval',
        'Formula / Theory / Concept Graph Retrieval',
        'Examiner Reasoning',
        'Human Tutor Formatting',
        'Answer',
      ],
      knowledgeLayers: KNOWLEDGE_LAYERS,
      neverDirectLlmFirst: true,
    },
    datasets: {
      coverageReportPath: 'dataset/reports/coverage_report.json',
      missingTopicsPath: 'dataset/reports/missing_topics_report.json',
      qualityReportPath: 'dataset/reports/dataset_quality_report.json',
    },
    remainingLimitations,
    personaMix: {
      examiner: '40%',
      teacher: '30%',
      consultant: '20%',
      aiAssistant: '10%',
    },
  }
}
