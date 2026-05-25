'use client'

import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'

type ApiState<T> = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  data: T | null
  error: string | null
}

type SearchResponse = {
  query: string
  parsedQuery?: {
    board: string | null
    level: string | null
    subject: string | null
    year: number | null
    paper: string | null
    intent: string
    topicHints: string[]
  }
  topicMatches?: Array<{
    id: string
    board: string
    level: string
    subject: string
    chapter: string
    topic: string
    importanceScore: number
    repeatYears: string[]
    examTips: string[]
    summary: string
  }>
  questionMatches?: Array<{
    id: string
    board: string
    level: string
    subject: string
    year: number | null
    paper: string | null
    questionLabel: string | null
    topic: string
    questionText: string
    answerSummary: string
    repeatSignal: string | null
    sourceUrl: string | null
    answerSourceUrl: string | null
    linkQuality: 'exact' | 'hierarchical' | 'unlinked' | 'unknown'
    linkConfidence: 'high' | 'medium' | 'low' | 'none'
    answerReady: boolean
  }>
  paperMatches?: Array<{
    id: string
    board: string
    level: string
    subject: string
    year: number | null
    paper: string
    paperCode: string | null
    paperTitle: string
    session: string | null
    focusTopics: string[]
    sourceUrl: string | null
  }>
  paperPairMatches?: Array<{
    id: string
    board: string
    level: string
    subject: string
    year: number | null
    session: string | null
    paperCode: string | null
    questionPaperUrl: string | null
    markSchemeUrl: string | null
    examinerReportUrl: string | null
    confidentialInstructionsUrl: string | null
    specimenMarkSchemeUrl: string | null
    completeness: 'full' | 'partial'
  }>
  pdfChunkMatches?: Array<{
    id: string
    board: string
    level: string
    subject: string
    title: string
    year: number | null
    resourceType: string
    content: string
    visualRich: boolean
    visualRisk: string | null
    imageObjects: number
    visualTags: string[]
    sourceUrl: string | null
  }>
  gapMatches?: Array<{
    id: string
    board: string
    level: string
    subject: string
    year: number | null
    resourceType: string
    status: 'access_blocked' | 'source_page_available' | 'not_yet_published'
    httpStatus: number | null
    effectiveMinYear: number | null
    effectiveMaxYear: number | null
    sourceUrls: string[]
  }>
  blockedRecoveryMatches?: Array<{
    id: string
    targetId: string
    board: string
    level: string
    subject: string
    year: number | null
    resourceType: string
    officialTitle: string | null
    officialUrl: string | null
    exactFilename: string | null
    officialHttpStatus: number | null
    publicListingUrls: string[]
    supportSourceUrls: string[]
    mirrorProvider: string | null
    mirrorPageUrl: string | null
    mirrorPageTitle: string | null
    mirrorPageDescription: string | null
    mirrorEvidenceType: 'exact_file_name' | 'subject_year_support_page' | null
    mirrorSupportConfidence: 'high' | 'medium' | 'low' | null
    mirrorFileNames: string[]
    recoveryStatus: 'external_access_blocked'
    note: string
  }>
  nearbyResourceMatches?: Array<{
    id: string
    board: string
    level: string
    subject: string
    year: number | null
    session: string | null
    paperCode: string | null
    resourceType: string
    title: string
    url: string
    yearDistance: number | null
    samePaper: boolean
    completeness: 'full' | 'partial'
  }>
  sourceMatches?: Array<{
    id: string
    provider: string
    title: string
    url: string
    qualityTier: string
    allowedUse: string
  }>
}

type CatalogResponse = {
  sourceMode: string
  matches: Array<{
    id: string
    board: string
    level: string
    subject: string
    year: number | null
    paper: string
    paperCode: string | null
    paperTitle: string
    session: string | null
    focusTopics: string[]
    sourceUrl: string | null
    qualityTier: string | null
  }>
}

type StatsResponse = {
  files: {
    seedFiles: string[]
    paperFiles: string[]
    sourceFiles: string[]
  }
  counts: {
    topics: number
    questions: number
    papers: number
    exactAnswers: number
    partialAnswers: number
    questionOnly: number
    answerReady: number
  }
  paperPairs: {
    totalPairs: number
    fullPairs: number
    partialPairs: number
  }
  breakdown: {
    seedBoards: Record<string, number>
    seedSubjects: Record<string, number>
    paperBoards: Record<string, number>
    paperSubjects: Record<string, number>
  }
}

const EXAMPLES = [
  '2021 physics edexl',
  'important questions of vector',
  'chem paper 2021 equilibrium',
  'year wise integration questions',
]

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload?.error || 'Request failed')
  }

  return payload as T
}

export function QbankSearchWorkbench() {
  const [query, setQuery] = useState(EXAMPLES[0])
  const [result, setResult] = useState<ApiState<SearchResponse>>({
    status: 'idle',
    data: null,
    error: null,
  })
  const [catalog, setCatalog] = useState<ApiState<CatalogResponse>>({
    status: 'idle',
    data: null,
    error: null,
  })
  const [stats, setStats] = useState<ApiState<StatsResponse>>({
    status: 'idle',
    data: null,
    error: null,
  })
  const [catalogFilters, setCatalogFilters] = useState({
    board: 'Edexcel',
    level: 'A Level',
    subject: 'Mathematics',
    year: '2021',
  })
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false

    async function loadStats() {
      setStats({
        status: 'loading',
        data: null,
        error: null,
      })

      try {
        const response = await fetch('/api/qbank/stats', {
          cache: 'no-store',
        })
        const payload = await response.json()

        if (!response.ok) {
          throw new Error(payload?.error || 'Stats request failed')
        }

        if (!cancelled) {
          setStats({
            status: 'ready',
            data: payload,
            error: null,
          })
        }
      } catch (error) {
        if (!cancelled) {
          setStats({
            status: 'error',
            data: null,
            error: error instanceof Error ? error.message : 'Stats request failed',
          })
        }
      }
    }

    void loadStats()

    return () => {
      cancelled = true
    }
  }, [])

  function runSearch(nextQuery?: string) {
    const finalQuery = (nextQuery ?? query).trim()
    if (!finalQuery) {
      setResult({
        status: 'error',
        data: null,
        error: 'Write a year/topic/paper query first.',
      })
      return
    }

    startTransition(async () => {
      setResult({
        status: 'loading',
        data: null,
        error: null,
      })

      try {
        const payload = await postJson<SearchResponse>('/api/qbank/search', {
          query: finalQuery,
        })

        setResult({
          status: 'ready',
          data: payload,
          error: null,
        })
      } catch (error) {
        setResult({
          status: 'error',
          data: null,
          error: error instanceof Error ? error.message : 'Search failed',
        })
      }
    })
  }

  function runCatalogSearch(nextFilters = catalogFilters) {
    startTransition(async () => {
      setCatalog({
        status: 'loading',
        data: null,
        error: null,
      })

      try {
        const params = new URLSearchParams()
        if (nextFilters.board) params.set('board', nextFilters.board)
        if (nextFilters.level) params.set('level', nextFilters.level)
        if (nextFilters.subject) params.set('subject', nextFilters.subject)
        if (nextFilters.year) params.set('year', nextFilters.year)
        params.set('limit', '12')

        const response = await fetch(`/api/qbank/catalog?${params.toString()}`, {
          cache: 'no-store',
        })
        const payload = await response.json()

        if (!response.ok) {
          throw new Error(payload?.error || 'Catalog request failed')
        }

        setCatalog({
          status: 'ready',
          data: payload,
          error: null,
        })
      } catch (error) {
        setCatalog({
          status: 'error',
          data: null,
          error: error instanceof Error ? error.message : 'Catalog request failed',
        })
      }
    })
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
      <div className="mb-6 rounded-2xl border border-cyan-300/12 bg-slate-950/45 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">
              Coverage Snapshot
            </p>
            <h3 className="mt-2 text-xl font-semibold">Live QBank data strength</h3>
            <p className="mt-2 max-w-2xl text-sm text-white/65">
              This shows how much structured QBank data is currently loaded into the
              product layer.
            </p>
          </div>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full border border-white/10 px-4 py-2 text-xs text-white/70 transition hover:border-cyan-300/60 hover:text-cyan-100"
          >
            Refresh
          </button>
        </div>

        {stats.status === 'error' ? (
          <p className="mt-4 text-sm text-rose-200">{stats.error}</p>
        ) : null}

        {stats.status === 'loading' ? (
          <p className="mt-4 text-sm text-white/55">Loading QBank stats...</p>
        ) : null}

        {stats.status === 'ready' && stats.data ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr,1fr]">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ['Topics', stats.data.counts.topics],
                ['Questions', stats.data.counts.questions],
                ['Papers', stats.data.counts.papers],
                ['Paper Pairs', stats.data.paperPairs.fullPairs],
                ['Exact Answers', stats.data.counts.exactAnswers],
                ['Answer Ready', stats.data.counts.answerReady],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-white/45">
                    {label}
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/45">
                  Seed Boards
                </p>
                <div className="mt-3 space-y-2 text-sm text-white/75">
                  {Object.entries(stats.data.breakdown.seedBoards).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between gap-3">
                      <span>{key}</span>
                      <span className="text-cyan-100">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/45">
                  Paper Boards
                </p>
                <div className="mt-3 space-y-2 text-sm text-white/75">
                  {Object.entries(stats.data.breakdown.paperBoards).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between gap-3">
                      <span>{key}</span>
                      <span className="text-cyan-100">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/45">
                  Paper Pair Health
                </p>
                <div className="mt-3 space-y-2 text-sm text-white/75">
                  <div className="flex items-center justify-between gap-3">
                    <span>Full pairs</span>
                    <span className="text-cyan-100">{stats.data.paperPairs.fullPairs}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Partial pairs</span>
                    <span className="text-cyan-100">{stats.data.paperPairs.partialPairs}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Total indexed pairs</span>
                    <span className="text-cyan-100">{stats.data.paperPairs.totalPairs}</span>
                  </div>
                  <div className="mt-4 border-t border-white/10 pt-4" />
                  <div className="flex items-center justify-between gap-3">
                    <span>Exact answer links</span>
                    <span className="text-cyan-100">{stats.data.counts.exactAnswers}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Partial links</span>
                    <span className="text-cyan-100">{stats.data.counts.partialAnswers}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Question-only rows</span>
                    <span className="text-cyan-100">{stats.data.counts.questionOnly}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">
            QBank Search
          </p>
          <h2 className="mt-2 text-2xl font-semibold">
            Year-wise, subject-wise, paper-wise retrieval
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-white/70">
            Ask like a real student. The engine parses messy prompts, pulls matching
            questions and topics, and points to the best source layer first.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => {
                setQuery(example)
                runSearch(example)
              }}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 transition hover:border-cyan-300/60 hover:text-white"
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 md:flex-row">
        <textarea
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Try: 2021 physics edexl or important questions of vector"
          className="min-h-28 flex-1 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none ring-0 placeholder:text-white/35"
        />
        <button
          type="button"
          onClick={() => runSearch()}
          disabled={isPending}
          className="rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? 'Searching...' : 'Search'}
        </button>
        <Link
          href={`/qbank?prompt=${encodeURIComponent(query)}`}
          className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-center text-sm font-medium text-white transition hover:border-cyan-300/60 hover:text-cyan-100"
        >
          Open in chat
        </Link>
      </div>

      {result.status === 'error' ? (
        <p className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {result.error}
        </p>
      ) : null}

      {result.status === 'ready' && result.data ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr,1fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-white/45">
                Parsed Query
              </p>
              <div className="mt-3 grid gap-2 text-sm text-white/80 md:grid-cols-2">
                <span>Board: {result.data.parsedQuery?.board || 'Unknown'}</span>
                <span>Level: {result.data.parsedQuery?.level || 'Unknown'}</span>
                <span>Subject: {result.data.parsedQuery?.subject || 'Unknown'}</span>
                <span>Year: {result.data.parsedQuery?.year || 'Unknown'}</span>
                <span>Paper: {result.data.parsedQuery?.paper || 'Unknown'}</span>
                <span>Intent: {result.data.parsedQuery?.intent || 'general'}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-white/45">
                Question Matches
              </p>
              <div className="mt-3 space-y-3">
                {(result.data.questionMatches || []).length === 0 ? (
                  <p className="text-sm text-white/55">No direct question matches yet.</p>
                ) : (
                  result.data.questionMatches?.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium text-white">
                          {item.board} {item.level} {item.subject}
                          {item.year ? ` ${item.year}` : ''}
                          {item.paper ? ` ${item.paper}` : ''}
                          {item.questionLabel ? ` ${item.questionLabel}` : ''}
                        </p>
                        <span
                          className={`rounded-full border px-2 py-1 text-[11px] uppercase tracking-[0.16em] ${
                            item.linkQuality === 'exact'
                              ? 'border-emerald-300/30 text-emerald-100'
                              : item.linkQuality === 'hierarchical'
                                ? 'border-amber-300/30 text-amber-100'
                                : 'border-white/10 text-white/55'
                          }`}
                        >
                          {item.linkQuality === 'exact'
                            ? 'exact'
                            : item.linkQuality === 'hierarchical'
                              ? item.linkConfidence === 'medium'
                                ? 'partial+'
                                : 'partial'
                              : 'question only'}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-cyan-100/80">{item.topic}</p>
                      <p className="mt-2 text-sm text-white/70">{item.questionText}</p>
                      <p className="mt-2 text-sm text-white/70">{item.answerSummary}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-white/55">
                        <span className="rounded-full border border-white/10 px-2 py-1">
                          confidence: {item.linkConfidence}
                        </span>
                        <span className="rounded-full border border-white/10 px-2 py-1">
                          ready: {item.answerReady ? 'yes' : 'no'}
                        </span>
                      </div>
                      {item.repeatSignal ? (
                        <p className="mt-2 text-xs text-amber-200/80">{item.repeatSignal}</p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-3 text-xs">
                        {item.answerSourceUrl ? (
                          <a
                            href={item.answerSourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-200 transition hover:text-emerald-100"
                          >
                            Open answer source
                          </a>
                        ) : null}
                        {item.sourceUrl ? (
                          <a
                            href={item.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-cyan-200 transition hover:text-cyan-100"
                          >
                            Open question source
                          </a>
                        ) : null}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-white/45">
                Paper Matches
              </p>
              <div className="mt-3 space-y-3">
                {(result.data.paperMatches || []).length === 0 ? (
                  <p className="text-sm text-white/55">No paper-level matches yet.</p>
                ) : (
                  result.data.paperMatches?.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-white">
                            {item.board} {item.level} {item.subject}
                          </p>
                          <p className="mt-1 text-sm text-cyan-100/80">
                            {item.year ? `${item.year} ` : ''}{item.paper}
                            {item.paperCode ? ` | ${item.paperCode}` : ''}
                          </p>
                        </div>
                        {item.session ? (
                          <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-white/55">
                            {item.session}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm text-white/70">{item.paperTitle}</p>
                      {item.focusTopics.length > 0 ? (
                        <p className="mt-2 text-xs text-amber-200/80">
                          Focus: {item.focusTopics.join(', ')}
                        </p>
                      ) : null}
                      {item.sourceUrl ? (
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-block text-sm text-cyan-200 transition hover:text-cyan-100"
                        >
                          Open source
                        </a>
                      ) : null}
                    </article>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-white/45">
                Official Paper Pairs
              </p>
              <div className="mt-3 space-y-3">
                {(result.data.paperPairMatches || []).length === 0 ? (
                  <p className="text-sm text-white/55">
                    No full question-paper and mark-scheme pairs found yet.
                  </p>
                ) : (
                  result.data.paperPairMatches?.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-white">
                            {item.board} {item.level} {item.subject}
                          </p>
                          <p className="mt-1 text-sm text-cyan-100/80">
                            {item.year ? `${item.year} ` : ''}{item.paperCode || 'paper unknown'}
                          </p>
                        </div>
                        <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-white/55">
                          {item.completeness}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-white/55">
                        {item.session || 'Session unknown'}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.questionPaperUrl ? (
                          <a
                            href={item.questionPaperUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-cyan-300/20 px-3 py-1.5 text-xs text-cyan-100 transition hover:border-cyan-300/60"
                          >
                            Question paper
                          </a>
                        ) : null}
                        {item.markSchemeUrl ? (
                          <a
                            href={item.markSchemeUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-cyan-300/20 px-3 py-1.5 text-xs text-cyan-100 transition hover:border-cyan-300/60"
                          >
                            Mark scheme
                          </a>
                        ) : null}
                        {item.examinerReportUrl ? (
                          <a
                            href={item.examinerReportUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/80 transition hover:border-cyan-300/60 hover:text-cyan-100"
                          >
                            Examiner report
                          </a>
                        ) : null}
                        {item.confidentialInstructionsUrl ? (
                          <a
                            href={item.confidentialInstructionsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/80 transition hover:border-cyan-300/60 hover:text-cyan-100"
                          >
                            Practical notes
                          </a>
                        ) : null}
                        {item.specimenMarkSchemeUrl ? (
                          <a
                            href={item.specimenMarkSchemeUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/80 transition hover:border-cyan-300/60 hover:text-cyan-100"
                          >
                            Specimen scheme
                          </a>
                        ) : null}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-white/45">
                Official Paper Content
              </p>
              <div className="mt-3 space-y-3">
                {(result.data.pdfChunkMatches || []).length === 0 ? (
                  <p className="text-sm text-white/55">No extracted official paper chunks yet.</p>
                ) : (
                  result.data.pdfChunkMatches?.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-white">
                            {item.board} {item.level} {item.subject}
                            {item.year ? ` ${item.year}` : ''}
                          </p>
                          <p className="mt-1 text-sm text-cyan-100/80">
                            {item.resourceType.replace(/_/g, ' ')}
                          </p>
                        </div>
                        {item.visualRich ? (
                          <span className="rounded-full border border-amber-300/20 px-2 py-1 text-[11px] text-amber-100/80">
                            visual {item.visualRisk || 'medium'}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm text-white/70">{item.title}</p>
                      <p className="mt-2 text-sm text-white/65">{item.content.slice(0, 320)}...</p>
                      {item.visualTags.length > 0 ? (
                        <p className="mt-2 text-xs text-cyan-100/80">
                          Visual tags: {item.visualTags.join(', ')}
                        </p>
                      ) : null}
                      {item.imageObjects > 0 ? (
                        <p className="mt-2 text-xs text-amber-200/80">
                          Image objects detected: {item.imageObjects}
                        </p>
                      ) : null}
                      {item.sourceUrl ? (
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-block text-sm text-cyan-200 transition hover:text-cyan-100"
                        >
                          Open source
                        </a>
                      ) : null}
                    </article>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-white/45">
                Coverage Warnings
              </p>
              <div className="mt-3 space-y-3">
                {(result.data.gapMatches || []).length === 0 ? (
                  <p className="text-sm text-white/55">No active coverage warnings for this query.</p>
                ) : (
                  result.data.gapMatches?.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-2xl border border-amber-300/15 bg-amber-400/5 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium text-white">
                          {item.board} {item.level} {item.subject}
                          {item.year ? ` ${item.year}` : ''} {item.resourceType.replace(/_/g, ' ')}
                        </p>
                        <span className="rounded-full border border-amber-300/20 px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-amber-100/80">
                          {item.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-white/70">
                        {item.status === 'access_blocked'
                          ? `Official listing exists, but the file is blocked${item.httpStatus ? ` (HTTP ${item.httpStatus})` : ''}.`
                          : item.status === 'source_page_available'
                            ? 'Official source page exists, but the exact PDF is not loaded yet.'
                            : 'This item is not published in the current official window yet.'}
                      </p>
                      {item.sourceUrls[0] ? (
                        <a
                          href={item.sourceUrls[0]}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-block text-sm text-cyan-200 transition hover:text-cyan-100"
                        >
                          Open official source
                        </a>
                      ) : null}
                    </article>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-white/45">
                Blocked Exact Files
              </p>
              <div className="mt-3 space-y-3">
                {(result.data.blockedRecoveryMatches || []).length === 0 ? (
                  <p className="text-sm text-white/55">No exact blocked-file rows for this query.</p>
                ) : (
                  result.data.blockedRecoveryMatches?.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-2xl border border-rose-300/15 bg-rose-400/5 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-white">
                            {item.board} {item.level} {item.subject}
                            {item.year ? ` ${item.year}` : ''} {item.resourceType.replace(/_/g, ' ')}
                          </p>
                          <p className="mt-1 text-xs text-white/55">
                            {item.exactFilename || item.officialTitle || 'Exact filename tracked'}
                          </p>
                        </div>
                        <span className="rounded-full border border-rose-300/20 px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-rose-100/80">
                          {item.mirrorPageUrl ? 'mirror support' : 'blocked'}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-white/70">
                        Official file exists but is externally blocked
                        {item.officialHttpStatus ? ` (HTTP ${item.officialHttpStatus})` : ''}.
                      </p>
                      {item.mirrorPageUrl ? (
                        <p className="mt-2 text-xs text-cyan-100/80">
                          {item.mirrorProvider || 'Mirror'} page found
                          {item.mirrorEvidenceType === 'exact_file_name'
                            ? ' with matching file-name evidence.'
                            : ' for the same subject/year range.'}
                        </p>
                      ) : null}
                      {item.mirrorFileNames.length ? (
                        <p className="mt-2 text-xs text-white/55">
                          Mirror files: {item.mirrorFileNames.slice(0, 3).join(', ')}
                        </p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.officialUrl ? (
                          <a
                            href={item.officialUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/75 transition hover:border-cyan-300/50 hover:text-cyan-100"
                          >
                            Official URL
                          </a>
                        ) : null}
                        {item.supportSourceUrls[0] ? (
                          <a
                            href={item.supportSourceUrls[0]}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/75 transition hover:border-cyan-300/50 hover:text-cyan-100"
                          >
                            Official page
                          </a>
                        ) : null}
                        {item.mirrorPageUrl ? (
                          <a
                            href={item.mirrorPageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-cyan-300/25 px-3 py-1.5 text-xs text-cyan-100 transition hover:border-cyan-300/50"
                          >
                            Mirror page
                          </a>
                        ) : null}
                        {item.publicListingUrls[0] ? (
                          <a
                            href={item.publicListingUrls[0]}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-amber-300/20 px-3 py-1.5 text-xs text-amber-100 transition hover:border-amber-300/50"
                          >
                            Listing search
                          </a>
                        ) : null}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-white/45">
                Closest Official Alternatives
              </p>
              <div className="mt-3 space-y-3">
                {(result.data.nearbyResourceMatches || []).length === 0 ? (
                  <p className="text-sm text-white/55">No nearby official fallback rows for this query.</p>
                ) : (
                  result.data.nearbyResourceMatches?.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-2xl border border-emerald-300/15 bg-emerald-400/5 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-white">{item.title}</p>
                          <p className="mt-1 text-xs text-white/55">
                            {item.yearDistance === null
                              ? 'Closest official fallback'
                              : `${item.yearDistance} year${item.yearDistance === 1 ? '' : 's'} away`}
                            {item.samePaper ? ' | Same paper code' : ''}
                            {item.session ? ` | ${item.session}` : ''}
                          </p>
                        </div>
                        <span className="rounded-full border border-emerald-300/20 px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-emerald-100/80">
                          {item.completeness}
                        </span>
                      </div>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-sm text-cyan-200 transition hover:text-cyan-100"
                      >
                        Open official fallback
                      </a>
                    </article>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-white/45">
                Topic Matches
              </p>
              <div className="mt-3 space-y-3">
                {(result.data.topicMatches || []).length === 0 ? (
                  <p className="text-sm text-white/55">No topic summary matches yet.</p>
                ) : (
                  result.data.topicMatches?.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                    >
                      <p className="text-sm font-medium text-white">
                        {item.board} {item.level} {item.subject}
                      </p>
                      <p className="mt-1 text-sm text-cyan-100/80">
                        {item.chapter} - {item.topic}
                      </p>
                      <p className="mt-2 text-sm text-white/70">{item.summary}</p>
                      {item.repeatYears.length > 0 ? (
                        <p className="mt-2 text-xs text-amber-200/80">
                          Repeat years: {item.repeatYears.join(', ')}
                        </p>
                      ) : null}
                    </article>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-white/45">
                Best Source Layer
              </p>
              <div className="mt-3 space-y-3">
                {(result.data.sourceMatches || []).length === 0 ? (
                  <p className="text-sm text-white/55">No source suggestions yet.</p>
                ) : (
                  result.data.sourceMatches?.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-white">{item.title}</p>
                        <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] uppercase tracking-[0.2em] text-white/55">
                          {item.qualityTier}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-white/55">
                        {item.provider} | {item.allowedUse}
                      </p>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-sm text-cyan-200 transition hover:text-cyan-100"
                      >
                        Open source
                      </a>
                    </article>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-8 rounded-2xl border border-white/10 bg-slate-950/45 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">
              Paper Catalog
            </p>
            <h3 className="mt-2 text-xl font-semibold">Browse indexed papers cheaply</h3>
            <p className="mt-2 max-w-2xl text-sm text-white/65">
              This lets students browse by board, level, subject, and year before going
              into chat.
            </p>
          </div>

          <button
            type="button"
            onClick={() => runCatalogSearch()}
            disabled={isPending}
            className="rounded-2xl border border-cyan-300/40 bg-cyan-300/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/20"
          >
            {catalog.status === 'loading' ? 'Loading catalog...' : 'Load catalog'}
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {[
            ['board', 'Board'],
            ['level', 'Level'],
            ['subject', 'Subject'],
            ['year', 'Year'],
          ].map(([key, label]) => (
            <label key={key} className="text-sm text-white/70">
              <span className="mb-2 block text-xs uppercase tracking-[0.22em] text-white/40">
                {label}
              </span>
              <input
                value={catalogFilters[key as keyof typeof catalogFilters]}
                onChange={(event) =>
                  setCatalogFilters((prev) => ({
                    ...prev,
                    [key]: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none"
              />
            </label>
          ))}
        </div>

        {catalog.status === 'error' ? (
          <p className="mt-4 text-sm text-rose-200">{catalog.error}</p>
        ) : null}

        {catalog.status === 'ready' && catalog.data ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {catalog.data.matches.length === 0 ? (
              <p className="text-sm text-white/55">No catalog matches for these filters.</p>
            ) : (
              catalog.data.matches.map((item) => (
                <article
                  key={item.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {item.board} {item.level} {item.subject}
                      </p>
                      <p className="mt-1 text-sm text-cyan-100/80">
                        {item.year ? `${item.year} ` : ''}{item.paper}
                        {item.paperCode ? ` | ${item.paperCode}` : ''}
                      </p>
                    </div>
                    {item.session ? (
                      <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-white/55">
                        {item.session}
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-2 text-sm text-white/70">{item.paperTitle}</p>
                  {item.focusTopics.length > 0 ? (
                    <p className="mt-2 text-xs text-amber-200/80">
                      Focus: {item.focusTopics.join(', ')}
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={`/qbank?prompt=${encodeURIComponent(
                        `${item.year ?? ''} ${item.subject} ${item.board} ${item.paper}`.trim()
                      )}`}
                      className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/80 transition hover:border-cyan-300/60 hover:text-cyan-100"
                    >
                      Ask in chat
                    </Link>
                    {item.sourceUrl ? (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-cyan-300/20 px-3 py-1.5 text-xs text-cyan-100 transition hover:border-cyan-300/60"
                      >
                        Open source
                      </a>
                    ) : null}
                  </div>
                </article>
              ))
            )}
          </div>
        ) : null}
      </div>
    </section>
  )
}
