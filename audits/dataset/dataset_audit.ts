import fs from 'node:fs'
import path from 'node:path'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'
import { buildExpectedMatrix } from './coverage_matrix'
import {
  auditKnowledgeCoverage,
  auditKnowledgeCoverageFromSyllabus,
  evaluateDatasetQuality,
  type KnowledgeBankCounts,
} from './missing_content_report'
import { writeJson, reportsDir } from '@/lib/dataset/common'
import { evaluateHfDatasetImport } from '@/lib/dataset/huggingfaceGuard'

export async function runDatasetAudit() {
  const supabase = getSupabaseAdmin()

  const { data: questions, error } = await supabase
    .from('questions')
    .select('id, board, level, subject, year, resource_type, content, local_path, topic')

  if (error) {
    throw new Error(`Database query failed: ${error.message}`)
  }

  const rows = questions || []
  const expectedMatrix = buildExpectedMatrix()

  let duplicatesRemovedCount = 0
  const uniqueContents = new Set<string>()
  const idsToDelete: string[] = []

  for (const row of rows) {
    const contentKey = `${row.board ?? ''}|${row.level ?? ''}|${row.subject ?? ''}|${row.year ?? ''}|${row.resource_type ?? ''}|${(row.content ?? '').trim().slice(0, 1000)}`
    if (uniqueContents.has(contentKey)) {
      idsToDelete.push(row.id)
      continue
    }
    uniqueContents.add(contentKey)

    let board = row.board
    let level = row.level
    let year = row.year
    let needsUpdate = false

    if (!board) {
      if (row.local_path?.toLowerCase().includes('cambridge')) {
        board = 'Cambridge'
        needsUpdate = true
      } else if (row.local_path?.toLowerCase().includes('edexcel')) {
        board = 'Edexcel'
        needsUpdate = true
      }
    }

    if (!level) {
      if (row.local_path?.toLowerCase().includes('a-level')) {
        level = 'A Level'
        needsUpdate = true
      } else if (row.local_path?.toLowerCase().includes('o-level')) {
        level = 'O Level'
        needsUpdate = true
      }
    }

    if (!year && row.local_path) {
      const match = /\b(20\d{2})\b/.exec(row.local_path)
      if (match) {
        year = Number(match[1])
        needsUpdate = true
      }
    }

    if (needsUpdate) {
      await supabase.from('questions').update({ board, level, year }).eq('id', row.id)
    }

    const gridMatch = expectedMatrix.find(
      (g) =>
        String(g.board).toLowerCase() === String(board || '').toLowerCase() &&
        String(g.level).toLowerCase() === String(level || '').toLowerCase() &&
        String(g.subject).toLowerCase() === String(row.subject || '').toLowerCase() &&
        Number(g.year) === Number(year) &&
        String(g.paper_type).toLowerCase() === String(row.resource_type || '').toLowerCase()
    )

    if (gridMatch) {
      gridMatch.found = true
      gridMatch.parsed = true
      gridMatch.inserted = true
    }
  }

  if (idsToDelete.length > 0) {
    for (const chunk of chunkArray(idsToDelete, 100)) {
      await supabase.from('questions').delete().in('id', chunk)
    }
    duplicatesRemovedCount = idsToDelete.length
  }

  const missingFiles: string[] = []
  for (const entry of expectedMatrix) {
    if (!entry.found) {
      missingFiles.push(
        `${entry.board} ${entry.level} ${entry.subject} ${entry.year} [${entry.paper_type}]`
      )
    }
  }

  const expectedCount = expectedMatrix.length
  const foundCount = expectedMatrix.filter((e) => e.found).length
  const coveragePercent = expectedCount ? Math.round((foundCount / expectedCount) * 10000) / 100 : 0

  const missingByBoard: Record<string, number> = {}
  const missingByLevel: Record<string, number> = {}
  const missingBySubject: Record<string, number> = {}
  const missingByYear: Record<string, number> = {}

  for (const entry of expectedMatrix) {
    if (!entry.found) {
      missingByBoard[entry.board] = (missingByBoard[entry.board] || 0) + 1
      missingByLevel[entry.level] = (missingByLevel[entry.level] || 0) + 1
      missingBySubject[entry.subject] = (missingBySubject[entry.subject] || 0) + 1
      missingByYear[entry.year] = (missingByYear[entry.year] || 0) + 1
    }
  }

  const coverageReport = {
    generatedAt: new Date().toISOString(),
    expected_files: expectedCount,
    found_files: foundCount,
    parsed_files: foundCount,
    inserted_files: foundCount,
    missing_files: missingFiles.length,
    coverage_percent: coveragePercent,
    missing_by_board: missingByBoard,
    missing_by_level: missingByLevel,
    missing_by_subject: missingBySubject,
    missing_by_year: missingByYear,
    missing_mark_schemes: expectedMatrix.filter((e) => e.paper_type === 'ms' && !e.found).length,
    missing_question_papers: expectedMatrix.filter((e) => e.paper_type === 'qp' && !e.found).length,
    duplicatesRemovedCount,
  }

  const [{ data: syllabusRows }, { data: formulaRows }, { data: theoryRows }, { data: misconceptionRows }, { data: sources }] =
    await Promise.all([
      supabase.from('syllabus_topics').select('subject, topic, chapter, board, level'),
      supabase.from('formula_bank').select('subject, topic, chapter'),
      supabase.from('theory_bank').select('subject, topic, chapter'),
      supabase.from('misconception_bank').select('subject, topic'),
      supabase.from('academic_sources').select('id, name, license, board, level, subject, source_type'),
    ])

  const bankCounts: KnowledgeBankCounts[] = []
  const subjectSet = new Set<string>([
    ...(syllabusRows ?? []).map((r) => r.subject),
    ...(formulaRows ?? []).map((r) => r.subject),
    ...(theoryRows ?? []).map((r) => r.subject),
  ].filter(Boolean))

  for (const subject of subjectSet) {
    const formulas = (formulaRows ?? []).filter((r) => r.subject === subject)
    const theory = (theoryRows ?? []).filter((r) => r.subject === subject)
    const misconceptions = (misconceptionRows ?? []).filter((r) => r.subject === subject)
    const topics = new Set<string>()
    for (const r of [...formulas, ...theory, ...(syllabusRows ?? []).filter((s) => s.subject === subject)]) {
      if (r.topic) topics.add(String(r.topic))
      if ('chapter' in r && r.chapter) topics.add(String(r.chapter))
    }

    bankCounts.push({
      subject,
      formulaCount: formulas.length,
      theoryCount: theory.length,
      misconceptionCount: misconceptions.length,
      topicCount: topics.size,
      chapterCount: new Set(
        [...formulas, ...theory]
          .map((r) => ('chapter' in r ? r.chapter : null))
          .filter(Boolean)
      ).size,
      coveredTopics: Array.from(topics),
    })
  }

  const { report: knowledgeReport, missingReport } =
    (syllabusRows ?? []).length > 0
      ? auditKnowledgeCoverageFromSyllabus({
          syllabusTopics: (syllabusRows ?? []).map((r) => ({
            subject: r.subject,
            topic: r.topic,
            chapter: r.chapter,
            board: r.board,
            level: r.level,
          })),
          bankCounts,
        })
      : auditKnowledgeCoverage(rows)

  const datasetQualityResults = (sources ?? []).map((source) => {
    const sample = rows.find((r) => r.subject === source.subject)?.content?.slice(0, 500) ?? ''
    const hfDecision = source.source_type === 'huggingface'
      ? evaluateHfDatasetImport({
          datasetId: source.name,
          subject: source.subject ?? 'General',
          board: source.board ?? 'Cambridge',
          level: source.level ?? 'O Level',
          sampleText: sample,
        })
      : null

    return (
      hfDecision?.quality ??
      evaluateDatasetQuality({
        name: source.name,
        license: source.license ?? 'user_provided',
        relevance: source.source_type !== 'huggingface',
        subjectMapped: Boolean(source.subject),
        boardSupported: ['Cambridge', 'Edexcel'].includes(source.board ?? ''),
        hasDuplicates: false,
        board: source.board,
        level: source.level,
        subject: source.subject,
      }, sample)
    )
  })

  const rejectedDatasets = datasetQualityResults.filter((r) => !r.passed)

  const reportDir = reportsDir()
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true })
  }

  writeJson(path.join(reportDir, 'coverage_report.json'), coverageReport)
  writeJson(path.join(reportDir, 'knowledge_coverage_report.json'), knowledgeReport)
  writeJson(path.join(reportDir, 'missing_topics_report.json'), {
    ...missingReport,
    systemComplete: missingReport.complete && rejectedDatasets.length === 0,
    rejectedDatasets: rejectedDatasets.map((r) => ({ name: r.name, score: r.score, details: r.details })),
  })
  writeJson(path.join(reportDir, 'dataset_quality_report.json'), {
    generatedAt: new Date().toISOString(),
    threshold: 70,
    results: datasetQualityResults,
    productionReady: rejectedDatasets.length === 0,
  })

  console.log(
    `Dataset Audit completed. Coverage: ${coveragePercent}%. Syllabus complete: ${missingReport.complete}. Rejected datasets: ${rejectedDatasets.length}.`
  )

  return { coverageReport, knowledgeReport, missingReport, datasetQualityResults }
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}
