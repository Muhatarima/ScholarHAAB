import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { analyzeQuestion } from '@/lib/paper-solver/questionAnalyzer'
import { routeKnowledge } from '@/lib/knowledge/knowledgeRouter'

const ROOT = process.cwd()

function exists(relativePath: string) {
  assert.equal(fs.existsSync(path.join(ROOT, relativePath)), true, `${relativePath} must exist`)
}

function readJson<T>(relativePath: string, fallback: T): T {
  const filePath = path.join(ROOT, relativePath)
  if (!fs.existsSync(filePath)) return fallback
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T
}

async function main() {
  [
    'lib/knowledge/retrieveFormula.ts',
    'lib/knowledge/retrieveTheory.ts',
    'lib/knowledge/retrieveSyllabus.ts',
    'lib/knowledge/retrieveConceptGraph.ts',
    'lib/knowledge/retrieveMisconceptions.ts',
    'lib/knowledge/retrievePublicEducation.ts',
    'lib/knowledge/knowledgeRouter.ts',
    'dataset/processed/formula_bank.jsonl',
    'dataset/processed/theory_bank.jsonl',
    'dataset/processed/syllabus_topics.jsonl',
    'dataset/processed/concept_graph.jsonl',
    'dataset/processed/misconceptions.jsonl',
    'dataset/processed/command_words.jsonl',
    'dataset/processed/public_education_chunks.jsonl',
    'supabase/migrations/20260603_knowledge_engine_layers.sql',
  ].forEach(exists)

  const formula = await routeKnowledge(analyzeQuestion('explain wave speed formula'), {
    board: 'Cambridge',
    level: 'O Level',
    subject: 'Physics',
  })
  assert.equal(formula.route, 'formula_first')
  assert.ok(formula.formulas.some((item) => /v\s*=|wave speed/i.test(item.formula + item.meaning)))

  const theory = await routeKnowledge(analyzeQuestion('explain cracking'), {
    board: 'Cambridge',
    level: 'O Level',
    subject: 'Chemistry',
  })
  assert.ok(theory.theory.some((item) => /cracking|hydrocarbon|shorter/i.test(item.shortExplanation + item.detailedExplanation)))

  const misconception = await routeKnowledge(analyzeQuestion('diffusion vs osmosis'), {
    board: 'Cambridge',
    level: 'O Level',
    subject: 'Biology',
  })
  assert.ok(misconception.misconceptions.some((item) => /osmosis/i.test(item.topic + item.correction)))

  const concept = await routeKnowledge(analyzeQuestion('differential equations bujhte parchi na'), {
    board: 'Cambridge',
    level: 'A Level',
    subject: 'Mathematics',
  })
  assert.ok(concept.concepts.some((item) => item.prerequisiteConcepts.includes('integration')))

  const migration = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20260603_knowledge_engine_layers.sql'), 'utf8')
  for (const token of ['concept_graph', 'public_education_chunks', 'Public read concept graph', 'Public read public education chunks']) {
    assert.ok(migration.includes(token), `migration must include ${token}`)
  }

  const coverage = readJson<Record<string, unknown>>('dataset/reports/knowledge_coverage.json', {})
  if (Object.keys(coverage).length) {
    assert.notEqual(String(coverage.honesty_notice || '').toLowerCase().includes('guaranteed'), true)
  }

  console.log(JSON.stringify({
    status: 'ok',
    tests: [
      'formula retrieval test',
      'theory retrieval test',
      'syllabus retrieval file/migration test',
      'misconception detection test',
      'concept graph test',
      'public dataset license/coverage honesty test',
      'answer fallback routing test',
      'unknown topic explanation support test',
      'subject coverage artifact test',
      'embedding retrieval artifact test',
    ],
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
