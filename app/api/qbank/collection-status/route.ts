import fs from 'node:fs'
import path from 'node:path'
import { getQbankCoverageSummary } from '@/lib/server/qbank-coverage'
import { getQbankCompletionSummary } from '@/lib/server/qbank-completion'

function countJsonlRows(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return 0
  }

  const raw = fs.readFileSync(filePath, 'utf8')
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean).length
}

function readJson(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return null
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

export async function GET() {
  try {
    const baseDir = path.join(process.cwd(), 'data', 'qbank_collection')
    const queueDir = path.join(baseDir, 'queues')
    const derivedDir = path.join(baseDir, 'derived')
    const downloadsDir = path.join(baseDir, 'downloads')
    const indexedDir = path.join(baseDir, 'indexed')
    const extractedTextDir = path.join(baseDir, 'extracted_text')
    const derivedQuestionDir = path.join(baseDir, 'derived_questions')
    const recursiveDir = path.join(baseDir, 'recursive')
    const missingCoverageDir = path.join(baseDir, 'missing_coverage')
    const papacambridgeDir = path.join(baseDir, 'papacambridge_archive')
    const supportRecoveryDir = path.join(baseDir, 'support_page_recovery')
    const blockedRecoveryDir = path.join(baseDir, 'blocked_recovery')

    const response = {
      fetchManifestRows: countJsonlRows(path.join(baseDir, 'fetch_manifest.jsonl')),
      extractedLinksRows: countJsonlRows(path.join(baseDir, 'extracted_links.jsonl')),
      queues: readJson(path.join(queueDir, 'queue_summary.json')),
      derived: readJson(path.join(derivedDir, 'candidate_summary.json')),
      downloads: readJson(path.join(downloadsDir, 'download_summary.json')),
      indexed: readJson(path.join(indexedDir, 'downloaded_pdf_index_summary.json')),
      indexedPromotion: readJson(path.join(baseDir, 'promoted', 'pdf_indexed_promoted_summary.json')),
      extractedText: readJson(path.join(extractedTextDir, 'pdf_text_summary.json')),
      derivedQuestions: readJson(path.join(derivedQuestionDir, 'question_span_summary.json')),
      missingCoverage: readJson(path.join(missingCoverageDir, 'missing_coverage_summary.json')),
      blockedRecovery: readJson(path.join(blockedRecoveryDir, 'blocked_recovery_summary.json')),
      supportPageRecovery: readJson(path.join(supportRecoveryDir, 'summary.json')),
      recursive: {
        sources: readJson(path.join(recursiveDir, 'recursive_source_summary.json')),
        links: readJson(path.join(recursiveDir, 'link_summary.json')),
        queues: readJson(path.join(recursiveDir, 'queues', 'queue_summary.json')),
        derived: readJson(path.join(recursiveDir, 'derived', 'candidate_summary.json')),
      },
      papacambridge: {
        summary: readJson(path.join(papacambridgeDir, 'summary.json')),
      },
      coverage: getQbankCoverageSummary(),
      completion: getQbankCompletionSummary(),
      files: {
        queueDir,
        derivedDir,
        downloadsDir,
        indexedDir,
        extractedTextDir,
        derivedQuestionDir,
        recursiveDir,
        missingCoverageDir,
        blockedRecoveryDir,
        papacambridgeDir,
        supportRecoveryDir,
      },
    }

    return Response.json(response)
  } catch (error) {
    console.error('QBank collection status API error:', error)
    return Response.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
