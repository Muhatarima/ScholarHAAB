'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type ApiState<T> = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  data: T | null
  error: string | null
}

type GuidanceResponse = {
  query: string
  parsedQuery?: {
    jurisdiction: string | null
    topicHints: string[]
  }
  matches?: Array<{
    id: string
    recordType: string
    jurisdiction: string
    topic: string
    title: string
    content: string
    sourceUrl: string | null
    sourceKind: string
    lastChecked: string | null
    tags: string[]
    matchScore: number
    matchReasons: string[]
  }>
  stats?: {
    total: number
    byJurisdiction: Record<string, number>
    byType: Record<string, number>
  }
}

const EXAMPLES = [
  'UK student visa proof of funds for London',
  'Can I cover Toronto rent with part-time work in Canada',
  'Australia work rights while studying masters',
  'IELTS online accepted for visa or not',
]

export function AbroadGuidanceWorkbench() {
  const [query, setQuery] = useState(EXAMPLES[0])
  const [result, setResult] = useState<ApiState<GuidanceResponse>>({
    status: 'idle',
    data: null,
    error: null,
  })

  useEffect(() => {
    void (async () => {
      setResult({ status: 'loading', data: null, error: null })

      try {
        const res = await fetch('/api/abroad/guidance-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: EXAMPLES[0] }),
        })
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error ?? 'Could not search right now.')
        }

        setResult({ status: 'ready', data, error: null })
      } catch (error) {
        setResult({
          status: 'error',
          data: null,
          error: error instanceof Error ? error.message : 'Could not search right now.',
        })
      }
    })()
  }, [])

  const runSearch = async (nextQuery?: string) => {
    const resolvedQuery = (nextQuery ?? query).trim()
    if (!resolvedQuery) {
      return
    }

    setResult({ status: 'loading', data: null, error: null })

    try {
      const res = await fetch('/api/abroad/guidance-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: resolvedQuery }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? 'Could not search right now.')
      }

      setResult({ status: 'ready', data, error: null })
    } catch (error) {
      setResult({
        status: 'error',
        data: null,
        error: error instanceof Error ? error.message : 'Could not search right now.',
      })
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="rounded-[28px] border border-white/10 bg-slate-950/60 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.35)]">
        <p className="text-xs uppercase tracking-[0.28em] text-sky-200/70">
          Visa and finance guidance
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-white">
          Practical official-backed guidance search
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-white/70">
          Retrieve concise guidance for visa rules, work rights, budgeting, and test-policy questions.
        </p>

        <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
          <textarea
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            rows={4}
            className="w-full resize-none bg-transparent text-sm text-white outline-none placeholder:text-white/35"
            placeholder="Ask a visa, finance, or exam-policy question..."
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={() => void runSearch()}
              disabled={result.status === 'loading'}
              className="rounded-full bg-sky-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {result.status === 'loading' ? 'Searching...' : 'Run guidance search'}
            </button>
            <Link
              href={`/abroad?prompt=${encodeURIComponent(query)}`}
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/75 transition hover:border-sky-300/60 hover:text-white"
            >
              Send to Abroad chat
            </Link>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              onClick={() => {
                setQuery(example)
                void runSearch(example)
              }}
              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-xs text-white/70 transition hover:border-sky-300/40 hover:text-white"
            >
              {example}
            </button>
          ))}
        </div>

        {result.status === 'error' ? (
          <p className="mt-4 text-sm text-rose-200">{result.error}</p>
        ) : null}

        <div className="mt-6 space-y-4">
          {(result.data?.matches || []).length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] p-5 text-sm text-white/50">
              Run a guidance query to see practical, source-backed guidance rows.
            </div>
          ) : (
            result.data?.matches?.map((item) => (
              <article
                key={item.id}
                className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-base font-semibold text-white">{item.title}</p>
                    <p className="mt-1 text-sm text-sky-100/80">
                      {item.jurisdiction} | {item.recordType.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <span className="rounded-full border border-sky-300/20 px-3 py-1 text-xs uppercase tracking-[0.16em] text-sky-100/85">
                    score {item.matchScore}
                  </span>
                </div>

                <p className="mt-3 text-sm leading-6 text-white/72">{item.content}</p>

                {item.matchReasons.length > 0 ? (
                  <p className="mt-2 text-xs text-amber-100/80">
                    Match reasons: {item.matchReasons.join(', ')}
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {item.sourceUrl ? (
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-cyan-200 transition hover:text-cyan-100"
                    >
                      Open source
                    </a>
                  ) : null}
                  {item.lastChecked ? (
                    <span className="text-xs text-white/45">Checked {item.lastChecked}</span>
                  ) : null}
                  <span className="text-xs text-white/45">{item.sourceKind}</span>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <aside className="space-y-4">
        <div className="rounded-[28px] border border-white/10 bg-slate-950/60 p-5">
          <p className="text-xs uppercase tracking-[0.28em] text-sky-200/70">
            Parsed query
          </p>
          <div className="mt-4 space-y-3 text-sm text-white/75">
            <p>Country: {result.data?.parsedQuery?.jurisdiction ?? 'Not detected'}</p>
            <p>
              Topic hints:{' '}
              {(result.data?.parsedQuery?.topicHints || []).length > 0
                ? result.data?.parsedQuery?.topicHints?.join(', ')
                : 'None'}
            </p>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-slate-950/60 p-5">
          <p className="text-xs uppercase tracking-[0.28em] text-sky-200/70">
            Guidance coverage
          </p>
          <div className="mt-4 space-y-3 text-sm text-white/75">
            <p>Total guidance rows: {result.data?.stats?.total ?? '...'}</p>
            <p>
              Countries:{' '}
              {result.data?.stats
                ? Object.entries(result.data.stats.byJurisdiction)
                    .slice(0, 5)
                    .map(([key, value]) => `${key} (${value})`)
                    .join(', ')
                : 'Loading...'}
            </p>
            <p>
              Types:{' '}
              {result.data?.stats
                ? Object.entries(result.data.stats.byType)
                    .slice(0, 5)
                    .map(([key, value]) => `${key} (${value})`)
                    .join(', ')
                : 'Loading...'}
            </p>
          </div>
        </div>
      </aside>
    </div>
  )
}
