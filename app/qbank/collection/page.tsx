import fs from 'node:fs'
import path from 'node:path'
import Link from 'next/link'
import { getQbankCoverageSummary } from '@/lib/server/qbank-coverage'
import { getQbankCompletionSummary } from '@/lib/server/qbank-completion'

export const dynamic = 'force-dynamic'

function readJson(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return null
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function countJsonlRows(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return 0
  }

  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean).length
}

function formatValue(value: unknown) {
  if (typeof value === 'string') {
    return value.split('\\').pop()
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (!value) {
    return '0'
  }

  if (Array.isArray(value)) {
    return value.length ? value.join(', ') : '0'
  }

  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, entryValue]) => `${key}:${String(entryValue)}`)
      .join(' | ')
  }

  return String(value)
}

export default function QbankCollectionPage() {
  const baseDir = path.join(process.cwd(), 'data', 'qbank_collection')
  const queueDir = path.join(baseDir, 'queues')
  const derivedDir = path.join(baseDir, 'derived')
  const downloadsDir = path.join(baseDir, 'downloads')
  const indexedDir = path.join(baseDir, 'indexed')
  const extractedTextDir = path.join(baseDir, 'extracted_text')
  const recursiveDir = path.join(baseDir, 'recursive')
  const papacambridgeDir = path.join(baseDir, 'papacambridge_archive')
  const supportRecoveryDir = path.join(baseDir, 'support_page_recovery')
  const blockedRecoveryDir = path.join(baseDir, 'blocked_recovery')

  const queueSummary = readJson(path.join(queueDir, 'queue_summary.json'))
  const candidateSummary = readJson(path.join(derivedDir, 'candidate_summary.json'))
  const promotedSummary = readJson(path.join(baseDir, 'promoted', 'promoted_summary.json'))
  const downloadSummary = readJson(path.join(downloadsDir, 'download_summary.json'))
  const indexedSummary = readJson(path.join(indexedDir, 'downloaded_pdf_index_summary.json'))
  const indexedPromotionSummary = readJson(
    path.join(baseDir, 'promoted', 'pdf_indexed_promoted_summary.json')
  )
  const extractedTextSummary = readJson(path.join(extractedTextDir, 'pdf_text_summary.json'))
  const derivedQuestionSummary = readJson(
    path.join(baseDir, 'derived_questions', 'question_span_summary.json')
  )
  const missingCoverageSummary = readJson(
    path.join(baseDir, 'missing_coverage', 'missing_coverage_summary.json')
  )
  const recursiveSourceSummary = readJson(path.join(recursiveDir, 'recursive_source_summary.json'))
  const recursiveLinkSummary = readJson(path.join(recursiveDir, 'link_summary.json'))
  const recursiveQueueSummary = readJson(path.join(recursiveDir, 'queues', 'queue_summary.json'))
  const recursiveCandidateSummary = readJson(path.join(recursiveDir, 'derived', 'candidate_summary.json'))
  const papacambridgeSummary = readJson(path.join(papacambridgeDir, 'summary.json'))
  const supportRecoverySummary = readJson(path.join(supportRecoveryDir, 'summary.json'))
  const blockedRecoverySummary = readJson(path.join(blockedRecoveryDir, 'blocked_recovery_summary.json'))
  const coverageSummary = getQbankCoverageSummary()
  const completionSummary = getQbankCompletionSummary()

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.14),_transparent_40%),linear-gradient(180deg,_#07111f_0%,_#020617_100%)] px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">
              ScholarHAAB QBank
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Collection pipeline</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/70">
              This page tracks the automated source-page collection, cleaned queues,
              and derived candidate manifests.
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/qbank"
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/75 transition hover:border-cyan-300/60 hover:text-white"
            >
              Back to QBank
            </Link>
            <Link
              href="/qbank/search"
              className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
            >
              Open workbench
            </Link>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 lg:col-span-3">
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">
              Coverage Reality
            </p>
            <div className="mt-4 grid gap-4 xl:grid-cols-[280px,1fr]">
              <div className="space-y-3 text-sm text-white/75">
                <div className="flex items-center justify-between gap-3">
                  <span>Indexed official rows</span>
                  <span className="text-cyan-100">{coverageSummary.indexedRows}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>10-year targets</span>
                  <span className="text-cyan-100">{coverageSummary.targetRows}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Full paper pairs</span>
                  <span className="text-cyan-100">{coverageSummary.pairStats.fullPairs}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Partial paper pairs</span>
                  <span className="text-cyan-100">{coverageSummary.pairStats.partialPairs}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Board groups</span>
                  <span className="text-cyan-100">
                    {Object.keys(coverageSummary.boardCounts).length}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Targeted groups</span>
                  <span className="text-cyan-100">
                    {coverageSummary.targetStats.targetedGroups}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Fully covered groups</span>
                  <span className="text-cyan-100">
                    {coverageSummary.targetStats.fullyCoveredGroups}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Uncovered groups</span>
                  <span className="text-cyan-100">
                    {coverageSummary.targetStats.uncoveredGroups}
                  </span>
                </div>
                <div className="mt-4 border-t border-white/10 pt-4" />
                <div className="flex items-center justify-between gap-3">
                  <span>Actionable target resources</span>
                  <span className="text-cyan-100">{completionSummary.actionableResources}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Indexed target resources</span>
                  <span className="text-cyan-100">{completionSummary.indexedResources}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Blocked exact resources</span>
                  <span className="text-amber-100">{completionSummary.blockedExactResources}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>True unresolved resources</span>
                  <span className="text-cyan-100">{completionSummary.unresolvedResources}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Operational completion</span>
                  <span className="text-cyan-100">
                    {Math.round(completionSummary.operationalCoverageRatio * 100)}%
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Fully indexed</span>
                  <span className="text-cyan-100">
                    {Math.round(completionSummary.indexedCoverageRatio * 100)}%
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm text-white/75">
                  <thead>
                    <tr className="border-b border-white/10 text-xs uppercase tracking-[0.22em] text-white/40">
                      <th className="pb-3 pr-4">Board</th>
                      <th className="pb-3 pr-4">Level</th>
                      <th className="pb-3 pr-4">Subject</th>
                      <th className="pb-3 pr-4">Target</th>
                      <th className="pb-3 pr-4">Covered</th>
                      <th className="pb-3 pr-4">Ratio</th>
                      <th className="pb-3 pr-4">QP</th>
                      <th className="pb-3 pr-4">MS</th>
                      <th className="pb-3 pr-4">Full</th>
                      <th className="pb-3 pr-4">Partial</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coverageSummary.groups.slice(0, 18).map((group) => (
                      <tr key={`${group.board}-${group.level}-${group.subject}`} className="border-b border-white/5">
                        <td className="py-3 pr-4">{group.board}</td>
                        <td className="py-3 pr-4">{group.level}</td>
                        <td className="py-3 pr-4">{group.subject}</td>
                        <td className="py-3 pr-4">
                          {group.targetYears.length
                            ? `${group.targetYears[0]}-${group.targetYears[group.targetYears.length - 1]}`
                            : 'Open'}
                        </td>
                        <td className="py-3 pr-4">
                          {group.coveredYears.length
                            ? `${group.coveredYears[0]}-${group.coveredYears[group.coveredYears.length - 1]}`
                            : 'None'}
                        </td>
                        <td className="py-3 pr-4 text-cyan-100">
                          {Math.round(group.coverageRatio * 100)}%
                        </td>
                        <td className="py-3 pr-4 text-cyan-100">{group.questionPapers}</td>
                        <td className="py-3 pr-4 text-cyan-100">{group.markSchemes}</td>
                        <td className="py-3 pr-4 text-cyan-100">{group.fullPairs}</td>
                        <td className="py-3 pr-4 text-white/55">{group.partialPairs}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">
              Completion Engine
            </p>
            <div className="mt-4 space-y-3 text-sm text-white/75">
              <div className="flex items-center justify-between gap-3">
                <span>Operationally complete</span>
                <span className="text-cyan-100">
                  {completionSummary.operationallyComplete ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Fully indexed</span>
                <span className="text-cyan-100">
                  {completionSummary.fullyIndexed ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Fully operational groups</span>
                <span className="text-cyan-100">
                  {completionSummary.groupStats.fullyOperationalGroups}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Partially operational groups</span>
                <span className="text-cyan-100">
                  {completionSummary.groupStats.partiallyOperationalGroups}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Unresolved groups</span>
                <span className="text-cyan-100">
                  {completionSummary.groupStats.unresolvedGroups}
                </span>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">
              Missing Coverage Queue
            </p>
            <div className="mt-4 space-y-3 text-sm text-white/75">
              {Object.entries(missingCoverageSummary ?? {}).slice(0, 8).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <span>{key}</span>
                  <span className="text-cyan-100">{formatValue(value)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">
              Blocked Recovery
            </p>
            <div className="mt-4 space-y-3 text-sm text-white/75">
              {Object.entries(blockedRecoverySummary ?? {}).slice(0, 6).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <span>{key}</span>
                  <span className="text-cyan-100">{formatValue(value)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">
              Raw Collection
            </p>
            <div className="mt-4 space-y-3 text-sm text-white/75">
              <div className="flex items-center justify-between gap-3">
                <span>Fetched pages</span>
                <span className="text-cyan-100">
                  {countJsonlRows(path.join(baseDir, 'fetch_manifest.jsonl'))}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Extracted links</span>
                <span className="text-cyan-100">
                  {countJsonlRows(path.join(baseDir, 'extracted_links.jsonl'))}
                </span>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">
              Cleaned Queues
            </p>
            <div className="mt-4 space-y-3 text-sm text-white/75">
              {Object.entries(queueSummary?.queues ?? {}).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <span>{key}</span>
                  <span className="text-cyan-100">{formatValue(value)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">
              Derived Candidates
            </p>
            <div className="mt-4 space-y-3 text-sm text-white/75">
              {Object.entries(candidateSummary ?? {}).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <span>{key}</span>
                  <span className="text-cyan-100">{formatValue(value)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">
              Recursive Sources
            </p>
            <div className="mt-4 space-y-3 text-sm text-white/75">
              {Object.entries(recursiveSourceSummary ?? {}).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <span>{key}</span>
                  <span className="text-cyan-100">{formatValue(value)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">
              Recursive Links
            </p>
            <div className="mt-4 space-y-3 text-sm text-white/75">
              {Object.entries(recursiveLinkSummary ?? {}).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <span>{key}</span>
                  <span className="text-cyan-100">{formatValue(value)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">
              Recursive Queues
            </p>
            <div className="mt-4 space-y-3 text-sm text-white/75">
              {Object.entries(recursiveQueueSummary?.queues ?? {}).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <span>{key}</span>
                  <span className="text-cyan-100">{formatValue(value)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">
              Recursive Candidates
            </p>
            <div className="mt-4 space-y-3 text-sm text-white/75">
              {Object.entries(recursiveCandidateSummary ?? {}).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <span>{key}</span>
                  <span className="text-cyan-100">{formatValue(value)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">
              Cambridge Archive
            </p>
            <div className="mt-4 space-y-3 text-sm text-white/75">
              {Object.entries(papacambridgeSummary ?? {}).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <span>{key}</span>
                  <span className="text-cyan-100">{formatValue(value)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">
              Support Page Recovery
            </p>
            <div className="mt-4 space-y-3 text-sm text-white/75">
              {Object.entries(supportRecoverySummary ?? {}).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <span>{key}</span>
                  <span className="text-cyan-100">{formatValue(value)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">
              Promoted Data
            </p>
            <div className="mt-4 space-y-3 text-sm text-white/75">
              {Object.entries(promotedSummary ?? {}).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <span>{key}</span>
                  <span className="text-cyan-100">
                    {formatValue(value)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">
              PDF Downloads
            </p>
            <div className="mt-4 space-y-3 text-sm text-white/75">
              {Object.entries(downloadSummary ?? {}).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <span>{key}</span>
                  <span className="text-cyan-100">
                    {formatValue(value)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">
              PDF Index
            </p>
            <div className="mt-4 space-y-3 text-sm text-white/75">
              {Object.entries(indexedSummary ?? {}).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <span>{key}</span>
                  <span className="text-cyan-100">
                    {formatValue(value)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">
              Indexed Promotion
            </p>
            <div className="mt-4 space-y-3 text-sm text-white/75">
              {Object.entries(indexedPromotionSummary ?? {}).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <span>{key}</span>
                  <span className="text-cyan-100">
                    {formatValue(value)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">
              Extracted Paper Text
            </p>
            <div className="mt-4 space-y-3 text-sm text-white/75">
              {Object.entries(extractedTextSummary ?? {}).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <span>{key}</span>
                  <span className="text-cyan-100">{formatValue(value)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">
              Derived Questions
            </p>
            <div className="mt-4 space-y-3 text-sm text-white/75">
              {Object.entries(derivedQuestionSummary ?? {}).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <span>{key}</span>
                  <span className="text-cyan-100">{formatValue(value)}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
