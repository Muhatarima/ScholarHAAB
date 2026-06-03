import fs from 'node:fs'
import path from 'node:path'
import { getSupabaseAdmin } from '../../lib/server/supabase-admin'
import { buildExpectedMatrix, SUPPORTED_YEARS } from './coverage_matrix'
import { auditKnowledgeCoverage, evaluateDatasetQuality } from './missing_content_report'
import { writeJson, jsonlPath } from '../../scripts/dataset_common'

export async function runDatasetAudit() {
  const supabase = getSupabaseAdmin()

  // 1. Fetch all academic entries in Supabase
  const { data: questions, error } = await supabase
    .from('questions')
    .select('id, board, level, subject, year, resource_type, content, local_path')

  if (error) {
    throw new Error(`Database query failed: ${error.message}`)
  }

  const rows = questions || []
  const expectedMatrix = buildExpectedMatrix()
  const foundFiles = new Set<string>()
  const parsedFiles = new Set<string>()
  const insertedFiles = new Set<string>()
  const missingFiles: string[] = []

  let duplicatesRemovedCount = 0
  const uniqueContents = new Set<string>()
  const idsToDelete: string[] = []

  // Case-insensitive tags check & duplication detection & tags repair
  for (const row of rows) {
    // Deduplication check
    const contentKey = `${row.board ?? ''}|${row.level ?? ''}|${row.subject ?? ''}|${row.year ?? ''}|${row.resource_type ?? ''}|${(row.content ?? '').trim().slice(0, 1000)}`
    if (uniqueContents.has(contentKey)) {
      idsToDelete.push(row.id)
      continue
    }
    uniqueContents.add(contentKey)

    // Tag Healing / Auto-Repair tags
    let board = row.board
    let level = row.level
    let subject = row.subject
    let year = row.year

    let needsUpdate = false

    // Infer missing board
    if (!board) {
      if (row.local_path?.toLowerCase().includes('cambridge')) {
        board = 'Cambridge'
        needsUpdate = true
      } else if (row.local_path?.toLowerCase().includes('edexcel')) {
        board = 'Edexcel'
        needsUpdate = true
      }
    }

    // Infer missing level
    if (!level) {
      if (row.local_path?.toLowerCase().includes('a-level')) {
        level = 'A Level'
        needsUpdate = true
      } else if (row.local_path?.toLowerCase().includes('o-level')) {
        level = 'O Level'
        needsUpdate = true
      }
    }

    // Infer missing year
    if (!year && row.local_path) {
      const match = /\b(20\d{2})\b/.exec(row.local_path)
      if (match) {
        year = Number(match[1])
        needsUpdate = true
      }
    }

    if (needsUpdate) {
      await supabase
        .from('questions')
        .update({ board, level, year })
        .eq('id', row.id)
    }

    // Mark matrix match
    const gridMatch = expectedMatrix.find(
      g =>
        String(g.board).toLowerCase() === String(board || '').toLowerCase() &&
        String(g.level).toLowerCase() === String(level || '').toLowerCase() &&
        String(g.subject).toLowerCase() === String(subject || '').toLowerCase() &&
        Number(g.year) === Number(year) &&
        String(g.paper_type).toLowerCase() === String(row.resource_type || '').toLowerCase()
    )

    if (gridMatch) {
      gridMatch.found = true
      gridMatch.parsed = true
      gridMatch.inserted = true
    }
  }

  // Remove duplicates from DB if any
  if (idsToDelete.length > 0) {
    for (const chunk of chunkArray(idsToDelete, 100)) {
      await supabase.from('questions').delete().in('id', chunk)
    }
    duplicatesRemovedCount = idsToDelete.length
  }

  // Identify missing files
  for (const entry of expectedMatrix) {
    if (!entry.found) {
      missingFiles.push(`${entry.board} ${entry.level} ${entry.subject} ${entry.year} [${entry.paper_type}]`)
    }
  }

  const expectedCount = expectedMatrix.length
  const foundCount = expectedMatrix.filter(e => e.found).length
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

  const missingQPs = expectedMatrix.filter(e => e.paper_type === 'qp' && !e.found).length
  const missingMSs = expectedMatrix.filter(e => e.paper_type === 'ms' && !e.found).length

  // Build reports
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
    missing_mark_schemes: missingMSs,
    missing_question_papers: missingQPs,
    duplicatesRemovedCount
  }

  // Audit knowledge coverage
  const { report: knowledgeReport, missingReport } = auditKnowledgeCoverage(rows)

  // Write reports
  const reportDir = path.resolve(process.cwd(), 'dataset', 'reports')
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true })
  }

  fs.writeFileSync(path.join(reportDir, 'coverage_report.json'), JSON.stringify(coverageReport, null, 2), 'utf8')
  fs.writeFileSync(path.join(reportDir, 'knowledge_coverage_report.json'), JSON.stringify(knowledgeReport, null, 2), 'utf8')
  fs.writeFileSync(path.join(reportDir, 'missing_topics_report.json'), JSON.stringify(missingReport, null, 2), 'utf8')

  console.log(`Dataset Audit completed. Coverage: ${coveragePercent}%`)
  return { coverageReport, knowledgeReport, missingReport }
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}
