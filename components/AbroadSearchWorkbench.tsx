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
    jurisdiction: string | null
    degreeLevel: string | null
    field: string | null
    fundingNeed: 'full' | 'partial' | 'any'
    profileHints: string[]
  }
  matches?: Array<{
    id: string
    title: string
    provider: string | null
    jurisdiction: string | null
    degreeLevels: string[]
    fieldsOfStudy: string[]
    fundingType: string | null
    fundingAmountText: string | null
    deadlineAnnual: string | null
    deadlineNotes: string | null
    officialUrl: string | null
    lastChecked: string | null
    authenticityStatus: string | null
    liveAnswerMode: string | null
    caution: string | null
    matchScore: number
    matchReasons: string[]
  }>
  stats?: {
    total: number
    jurisdictions: Record<string, number>
    degrees: Record<string, number>
    fundingTypes: Record<string, number>
  }
}

const EXAMPLES = [
  'Fully funded masters scholarship in Australia for CSE student from Bangladesh',
  'PhD scholarship in Japan for economics and development',
  'Best women scholarship in USA for masters',
  'Low budget masters in Europe with funding for engineering',
]

export function AbroadSearchWorkbench() {
  const [query, setQuery] = useState(EXAMPLES[0])
  const [result, setResult] = useState<ApiState<SearchResponse>>({
    status: 'idle',
    data: null,
    error: null,
  })
  const [stats, setStats] = useState<ApiState<SearchResponse['stats']>>({
    status: 'idle',
    data: null,
    error: null,
  })
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    startTransition(() => {
      void (async () => {
        setStats({ status: 'loading', data: null, error: null })
        try {
          const res = await fetch('/api/abroad/stats', { cache: 'no-store' })
          const data = await res.json()
          setStats({ status: 'ready', data, error: null })
        } catch {
          setStats({ status: 'error', data: null, error: 'Could not load scholarship stats.' })
        }
      })()
    })
  }, [])

  const runSearch = async (nextQuery?: string) => {
    const resolvedQuery = (nextQuery ?? query).trim()
    if (!resolvedQuery) {
      return
    }

    setResult({ status: 'loading', data: null, error: null })

    try {
      const res = await fetch('/api/abroad/search', {
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
        <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">
          Scholarship matcher
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-white">
          Structured scholarship search
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-white/70">
          Test country, degree, field, and funding-based matching before sending the user into chat.
        </p>

        <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
          <textarea
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            rows={4}
            className="w-full resize-none bg-transparent text-sm text-white outline-none placeholder:text-white/35"
            placeholder="Describe the student profile or scholarship target..."
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={() => void runSearch()}
              disabled={result.status === 'loading' || isPending}
              className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {result.status === 'loading' ? 'Matching...' : 'Run match'}
            </button>
            <Link
              href={`/abroad?prompt=${encodeURIComponent(query)}`}
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/75 transition hover:border-cyan-300/60 hover:text-white"
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
              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-xs text-white/70 transition hover:border-cyan-300/40 hover:text-white"
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
              Run a query to see ranked official scholarship matches.
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
                    <p className="mt-1 text-sm text-cyan-100/80">
                      {item.provider ?? 'Unknown provider'} | {item.jurisdiction ?? 'Unknown country'}
                    </p>
                  </div>
                  <span className="rounded-full border border-cyan-300/20 px-3 py-1 text-xs uppercase tracking-[0.16em] text-cyan-100/85">
                    score {item.matchScore}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/70">
                  {item.degreeLevels.map((value) => (
                    <span key={value} className="rounded-full border border-white/10 px-2 py-1">
                      {value}
                    </span>
                  ))}
                  {item.fieldsOfStudy.slice(0, 3).map((value) => (
                    <span key={value} className="rounded-full border border-white/10 px-2 py-1">
                      {value}
                    </span>
                  ))}
                  {item.fundingType ? (
                    <span className="rounded-full border border-emerald-300/15 px-2 py-1 text-emerald-100/85">
                      {item.fundingType}
                    </span>
                  ) : null}
                </div>

                <p className="mt-3 text-sm text-white/70">
                  {item.fundingAmountText ? `Funding: ${item.fundingAmountText}. ` : ''}
                  {item.deadlineAnnual ? `Deadline: ${item.deadlineAnnual}. ` : 'Deadline varies. '}
                  {item.deadlineNotes ?? ''}
                </p>

                {item.matchReasons.length > 0 ? (
                  <p className="mt-2 text-xs text-amber-100/80">
                    Match reasons: {item.matchReasons.join(', ')}
                  </p>
                ) : null}

                {item.caution ? (
                  <p className="mt-2 text-xs text-white/55">{item.caution}</p>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {item.officialUrl ? (
                    <a
                      href={item.officialUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-cyan-200 transition hover:text-cyan-100"
                    >
                      Open official source
                    </a>
                  ) : null}
                  {item.lastChecked ? (
                    <span className="text-xs text-white/45">Checked {item.lastChecked}</span>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <aside className="space-y-4">
        <div className="rounded-[28px] border border-white/10 bg-slate-950/60 p-5">
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">
            Parsed query
          </p>
          <div className="mt-4 space-y-3 text-sm text-white/75">
            <p>Country: {result.data?.parsedQuery?.jurisdiction ?? 'Not detected'}</p>
            <p>Degree: {result.data?.parsedQuery?.degreeLevel ?? 'Not detected'}</p>
            <p>Field: {result.data?.parsedQuery?.field ?? 'Not detected'}</p>
            <p>Funding need: {result.data?.parsedQuery?.fundingNeed ?? 'any'}</p>
            <p>
              Profile hints:{' '}
              {(result.data?.parsedQuery?.profileHints || []).length > 0
                ? result.data?.parsedQuery?.profileHints?.join(', ')
                : 'None'}
            </p>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-slate-950/60 p-5">
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">
            Coverage
          </p>
          <div className="mt-4 space-y-3 text-sm text-white/75">
            <p>Total verified seed rows: {stats.data?.total ?? '...'}</p>
            <p>
              Top countries:{' '}
              {stats.data
                ? Object.entries(stats.data.jurisdictions)
                    .slice(0, 4)
                    .map(([key, value]) => `${key} (${value})`)
                    .join(', ')
                : 'Loading...'}
            </p>
            <p>
              Top degrees:{' '}
              {stats.data
                ? Object.entries(stats.data.degrees)
                    .slice(0, 4)
                    .map(([key, value]) => `${key} (${value})`)
                    .join(', ')
                : 'Loading...'}
            </p>
            <p>
              Funding types:{' '}
              {stats.data
                ? Object.entries(stats.data.fundingTypes)
                    .slice(0, 4)
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
