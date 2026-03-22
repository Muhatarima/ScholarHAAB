'use client'

import Link from 'next/link'
import { useState } from 'react'

type ResultState = {
  summary: string
  issues: Array<{ label: string; severity: 'high' | 'medium' | 'low'; detail: string }>
  nextSteps: string[]
  similarCases: Array<{
    id: string
    rubricType: string
    qualityBand: string
    outputText: string
    matchScore: number
    matchReasons: string[]
  }>
}

const SAMPLE_SUMMARY =
  "Passport name is 'Md. Samiul Islam', transcript name is 'Samiul Islam', one semester mark sheet missing, and CV says top 5 percent without proof."

export function AbroadDocumentCheckWorkbench() {
  const [summary, setSummary] = useState(SAMPLE_SUMMARY)
  const [result, setResult] = useState<ResultState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const runCheck = async () => {
    if (!summary.trim()) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/abroad/document-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? 'Could not run the checklist.')
      }
      setResult(data)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not run the checklist.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="rounded-[28px] border border-white/10 bg-slate-950/60 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.35)]">
        <p className="text-xs uppercase tracking-[0.28em] text-fuchsia-200/70">
          Document checklist
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-white">
          Transcript and document consistency
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-white/70">
          Check name mismatch, missing records, unsupported claims, and other quiet application blockers.
        </p>

        <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
          <textarea
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            rows={8}
            className="w-full resize-none bg-transparent text-sm text-white outline-none placeholder:text-white/35"
            placeholder="Describe the document situation..."
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={() => void runCheck()}
              disabled={loading}
              className="rounded-full bg-fuchsia-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-fuchsia-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Checking...' : 'Run document check'}
            </button>
            <Link
              href={`/abroad?prompt=${encodeURIComponent(`Check these documents: ${summary}`)}`}
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/75 transition hover:border-fuchsia-300/60 hover:text-white"
            >
              Send to Abroad chat
            </Link>
          </div>
        </div>
      </section>

      <aside className="space-y-4">
        {error ? <p className="text-sm text-rose-200">{error}</p> : null}
        {!result && !error ? (
          <div className="rounded-[28px] border border-white/10 bg-slate-950/60 p-5 text-sm text-white/55">
            Run the check to see issues, next steps, and similar review cases.
          </div>
        ) : null}
        {result ? (
          <>
            <div className="rounded-[28px] border border-white/10 bg-slate-950/60 p-5">
              <p className="text-xs uppercase tracking-[0.28em] text-fuchsia-200/70">
                Issues
              </p>
              <div className="mt-4 space-y-3">
                {result.issues.map((item, index) => (
                  <div key={`${item.label}-${index}`} className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-sm text-white">
                      {item.label} <span className="text-xs text-fuchsia-100/80">({item.severity})</span>
                    </p>
                    <p className="mt-1 text-xs text-white/60">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-slate-950/60 p-5">
              <p className="text-xs uppercase tracking-[0.28em] text-fuchsia-200/70">
                Next steps
              </p>
              <div className="mt-4 space-y-2">
                {result.nextSteps.map((item, index) => (
                  <p key={`${item}-${index}`} className="text-sm text-white/72">
                    {index + 1}. {item}
                  </p>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-slate-950/60 p-5">
              <p className="text-xs uppercase tracking-[0.28em] text-fuchsia-200/70">
                Similar cases
              </p>
              <div className="mt-4 space-y-3">
                {result.similarCases.length === 0 ? (
                  <p className="text-sm text-white/55">No similar cases matched.</p>
                ) : (
                  result.similarCases.map((item) => (
                    <div key={item.id} className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-sm text-white">
                        {item.rubricType} | {item.qualityBand}
                      </p>
                      <p className="mt-2 text-xs leading-6 text-white/60">
                        {item.outputText.slice(0, 420)}
                        {item.outputText.length > 420 ? '...' : ''}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        ) : null}
      </aside>
    </div>
  )
}
