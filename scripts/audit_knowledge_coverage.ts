import { jsonlPath, readJsonl, writeJson } from './dataset_common'

function countBy(rows: Record<string, unknown>[], key: string) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const value = String(row[key] ?? 'Unknown')
    acc[value] = (acc[value] ?? 0) + 1
    return acc
  }, {})
}

async function main() {
  const formulas = readJsonl<Record<string, unknown>>(jsonlPath('processed/formula_bank.jsonl'))
  const theory = readJsonl<Record<string, unknown>>(jsonlPath('processed/theory_bank.jsonl'))
  const syllabus = readJsonl<Record<string, unknown>>(jsonlPath('processed/syllabus_topics.jsonl'))
  const concepts = readJsonl<Record<string, unknown>>(jsonlPath('processed/concept_graph.jsonl'))
  const misconceptions = readJsonl<Record<string, unknown>>(jsonlPath('processed/misconceptions.jsonl'))
  const chunks = readJsonl<Record<string, unknown>>(jsonlPath('processed/public_education_chunks.jsonl'))
  const sources = readJsonl<Record<string, unknown>>(jsonlPath('manifests/public_dataset_sources.jsonl'))
  const review = sources.filter((row) => String(row.allowed_status ?? '').toLowerCase() !== 'allowed')

  const report = {
    generated_at: new Date().toISOString(),
    honesty_notice: formulas.length + theory.length + syllabus.length + concepts.length + misconceptions.length + chunks.length === 0
      ? 'No permitted knowledge rows imported yet. Do not claim academic coverage.'
      : 'Coverage reflects only rows present in processed manifests and database import logs.',
    subjects_covered: Array.from(new Set([...formulas, ...theory, ...syllabus, ...concepts, ...misconceptions, ...chunks].map((row) => String(row.subject ?? 'Unknown')))),
    formulas_per_subject: countBy(formulas, 'subject'),
    theory_topics_per_subject: countBy(theory, 'subject'),
    syllabus_topics_per_board: countBy(syllabus, 'board'),
    misconception_count: misconceptions.length,
    concept_graph_nodes: concepts.length,
    public_dataset_chunks: chunks.length,
    missing_chapters: [],
    missing_topics: [],
    review_required_sources: review.length,
    totals: {
      formula_bank: formulas.length,
      theory_bank: theory.length,
      syllabus_topics: syllabus.length,
      concept_graph: concepts.length,
      misconception_bank: misconceptions.length,
      public_education_chunks: chunks.length,
    },
  }
  writeJson(jsonlPath('reports/knowledge_coverage.json'), report)
  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => { console.error(error); process.exit(1) })
