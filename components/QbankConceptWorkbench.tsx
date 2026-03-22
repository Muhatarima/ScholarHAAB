'use client'

import Link from 'next/link'
import { useState } from 'react'

type ApiState<T> = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  data: T | null
  error: string | null
}

type ConceptResponse = {
  query: string
  sourceMode: string
  parsedQuery?: {
    board: string | null
    level: string | null
    subject: string | null
    year: number | null
    paper: string | null
    intent: string
    topicHints: string[]
  }
  matches: Array<{
    id: string
    board: string
    level: string
    subject: string
    chapter: string
    topic: string
    conceptSummary: string
    examTips: string[]
    repeatYears: string[]
    formulaCandidates: string[]
    questionExamples: string[]
    answerPatterns: string[]
    importanceScore: number
    sourceUrls: string[]
    sourceLabels: string[]
  }>
  stats: {
    totalConcepts: number
    bySubject: Record<string, number>
  }
}

const EXAMPLES = [
  'edexcel a level physics electricity formulas and repeated concepts',
  'cambridge chemistry periodic table key concepts',
  'biology cell transport important concept',
  'economics elasticity repeated topic',
  'accounting ledger and trial balance concept',
]

export function QbankConceptWorkbench() {
  const [query, setQuery] = useState(EXAMPLES[0])
  const [result, setResult] = useState<ApiState<ConceptResponse>>({
    status: 'idle',
    data: null,
    error: null,
  })

  const runSearch = async (nextQuery?: string) => {
    const resolvedQuery = (nextQuery ?? query).trim()
    if (!resolvedQuery) {
      return
    }

    setResult({ status: 'loading', data: null, error: null })

    try {
      const res = await fetch('/api/qbank/concept-search', {
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
          Formula and concept layer
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-white">
          Subject concept search
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-white/70">
          Search normalized concept cards across Physics, Math, Chemistry, Economics, Biology, and Accounting.
        </p>

        <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
          <textarea
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            rows={4}
            className="w-full resize-none bg-transparent text-sm text-white outline-none placeholder:text-white/35"
            placeholder="Ask for a concept, formula, or repeated topic..."
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={() => void runSearch()}
              disabled={result.status === 'loading'}
              className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {result.status === 'loading' ? 'Searching...' : 'Search concepts'}
            </button>
            <Link
              href={`/qbank?prompt=${encodeURIComponent(query)}`}
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/75 transition hover:border-cyan-300/60 hover:text-white"
            >
              Send to QBank chat
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
              Run a query to see concept cards and formula hints.
            </div>
          ) : (
            result.data?.matches.map((item) => (
              <article
                key={item.id}
                className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-base font-semibold text-white">
                      {item.board} {item.level} {item.subject}
                    </p>
                    <p className="mt-1 text-sm text-cyan-100/80">
                      {item.chapter} - {item.topic}
                    </p>
                  </div>
                  <span className="rounded-full border border-cyan-300/20 px-3 py-1 text-xs uppercase tracking-[0.16em] text-cyan-100/85">
                    importance {item.importanceScore}
                  </span>
                </div>

                <p className="mt-3 text-sm text-white/72">{item.conceptSummary}</p>

                {item.formulaCandidates.length > 0 ? (
                  <p className="mt-3 text-xs text-amber-100/85">
                    Formula hints: {item.formulaCandidates.join(' | ')}
                  </p>
                ) : null}

                {item.examTips.length > 0 ? (
                  <p className="mt-2 text-xs text-white/60">
                    Exam tips: {item.examTips.join(' | ')}
                  </p>
                ) : null}

                {item.repeatYears.length > 0 ? (
                  <p className="mt-2 text-xs text-white/60">
                    Repeat years: {item.repeatYears.join(', ')}
                  </p>
                ) : null}
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
            <p>Board: {result.data?.parsedQuery?.board ?? 'Not detected'}</p>
            <p>Level: {result.data?.parsedQuery?.level ?? 'Not detected'}</p>
            <p>Subject: {result.data?.parsedQuery?.subject ?? 'Not detected'}</p>
            <p>
              Topic hints:{' '}
              {(result.data?.parsedQuery?.topicHints || []).length > 0
                ? result.data?.parsedQuery?.topicHints?.join(', ')
                : 'None'}
            </p>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-slate-950/60 p-5">
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">
            Coverage
          </p>
          <div className="mt-4 space-y-3 text-sm text-white/75">
            <p>Total concept cards: {result.data?.stats?.totalConcepts ?? '...'}</p>
            <p>
              Subjects:{' '}
              {result.data?.stats
                ? Object.entries(result.data.stats.bySubject)
                    .slice(0, 6)
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
