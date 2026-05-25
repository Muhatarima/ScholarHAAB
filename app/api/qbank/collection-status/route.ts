import fs from 'node:fs/promises'
import path from 'node:path'
import { getQbankCompletionSummary } from '@/lib/server/qbank-completion'
import { getQbankCoverageSummary } from '@/lib/server/qbank-coverage'
import { createRequestId, logError } from '@/lib/server/logger'
import { requireAuth } from '@/lib/auth/requireAuth'

async function countJsonlRows(filePath: string) {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean).length
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return 0
    }

    throw error
  }
}

async function readJson(filePath: string) {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    return JSON.parse(raw)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }

    throw error
  }
}

export async function GET(req: Request) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError

  const requestId = createRequestId()

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
    const kingsbridgeMirrorDir = path.join(baseDir, 'kingsbridge_mirror')

    const [
      fetchManifestRows,
      extractedLinksRows,
      queues,
      derived,
      downloads,
      indexed,
      indexedPromotion,
      extractedText,
      derivedQuestions,
      missingCoverage,
      blockedRecovery,
      kingsbridgeMirror,
      supportPageRecovery,
      recursiveSources,
      recursiveLinks,
      recursiveQueues,
      recursiveDerived,
      papacambridgeSummary,
    ] = await Promise.all([
      countJsonlRows(path.join(baseDir, 'fetch_manifest.jsonl')),
      countJsonlRows(path.join(baseDir, 'extracted_links.jsonl')),
      readJson(path.join(queueDir, 'queue_summary.json')),
      readJson(path.join(derivedDir, 'candidate_summary.json')),
      readJson(path.join(downloadsDir, 'download_summary.json')),
      readJson(path.join(indexedDir, 'downloaded_pdf_index_summary.json')),
      readJson(path.join(baseDir, 'promoted', 'pdf_indexed_promoted_summary.json')),
      readJson(path.join(extractedTextDir, 'pdf_text_summary.json')),
      readJson(path.join(derivedQuestionDir, 'question_span_summary.json')),
      readJson(path.join(missingCoverageDir, 'missing_coverage_summary.json')),
      readJson(path.join(blockedRecoveryDir, 'blocked_recovery_summary.json')),
      readJson(path.join(kingsbridgeMirrorDir, 'summary.json')),
      readJson(path.join(supportRecoveryDir, 'summary.json')),
      readJson(path.join(recursiveDir, 'recursive_source_summary.json')),
      readJson(path.join(recursiveDir, 'link_summary.json')),
      readJson(path.join(recursiveDir, 'queues', 'queue_summary.json')),
      readJson(path.join(recursiveDir, 'derived', 'candidate_summary.json')),
      readJson(path.join(papacambridgeDir, 'summary.json')),
    ])

    return Response.json(
      {
        fetchManifestRows,
        extractedLinksRows,
        queues,
        derived,
        downloads,
        indexed,
        indexedPromotion,
        extractedText,
        derivedQuestions,
        missingCoverage,
        blockedRecovery,
        kingsbridgeMirror,
        supportPageRecovery,
        recursive: {
          sources: recursiveSources,
          links: recursiveLinks,
          queues: recursiveQueues,
          derived: recursiveDerived,
        },
        papacambridge: {
          summary: papacambridgeSummary,
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
          kingsbridgeMirrorDir,
          papacambridgeDir,
          supportRecoveryDir,
        },
      },
      {
        headers: { 'x-request-id': requestId },
      }
    )
  } catch (error) {
    logError('qbank_collection_status_failed', error, {
      request_id: requestId,
      route: '/api/qbank/collection-status',
    })
    return Response.json(
      { error: 'Something went wrong' },
      { status: 500, headers: { 'x-request-id': requestId } }
    )
  }
}
