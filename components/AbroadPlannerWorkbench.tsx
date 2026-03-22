'use client'

import { useState } from 'react'

type PlannerResult = {
  stage: 'research' | 'applying' | 'admitted' | 'visa_ready'
  cityMatch: {
    city: string
    country: string
    avgRentUsd: number
    foodUsd: number
    transportUsd: number
    totalMonthlyCostUsd: number
    sourceKind: string
    caution: string
  } | null
  arrivalBufferUsd: number
  costRisk: 'high' | 'medium' | 'lower'
  roadmap: string[]
  partTimeWarning: string
}

const EXAMPLE =
  'I got an offer from a university in London and now I need visa and budget planning for masters.'

export function AbroadPlannerWorkbench() {
  const [query, setQuery] = useState(EXAMPLE)
  const [result, setResult] = useState<PlannerResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const runPlanner = async () => {
    if (!query.trim()) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/abroad/planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? 'Could not build the plan.')
      }
      setResult(data)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not build the plan.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="rounded-[28px] border border-white/10 bg-slate-950/60 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.35)]">
        <p className="text-xs uppercase tracking-[0.28em] text-lime-200/70">
          Budget and roadmap planner
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-white">
          City, money, and next-step planning
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-white/70">
          Turn a rough situation into a realistic budget warning and step-by-step action plan.
        </p>

        <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
          <textarea
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            rows={6}
            className="w-full resize-none bg-transparent text-sm text-white outline-none placeholder:text-white/35"
            placeholder="Describe the student's current stage, city, and concern..."
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={() => void runPlanner()}
              disabled={loading}
              className="rounded-full bg-lime-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Planning...' : 'Build plan'}
            </button>
          </div>
        </div>
      </section>

      <aside className="space-y-4">
        {error ? <p className="text-sm text-rose-200">{error}</p> : null}
        {!result && !error ? (
          <div className="rounded-[28px] border border-white/10 bg-slate-950/60 p-5 text-sm text-white/55">
            Run the planner to see stage, city budget estimate, and a realistic roadmap.
          </div>
        ) : null}
        {result ? (
          <>
            <div className="rounded-[28px] border border-white/10 bg-slate-950/60 p-5">
              <p className="text-xs uppercase tracking-[0.28em] text-lime-200/70">
                Planning summary
              </p>
              <div className="mt-4 space-y-2 text-sm text-white/75">
                <p>Stage: {result.stage}</p>
                <p>Arrival buffer target: ~${result.arrivalBufferUsd}</p>
                <p>Cost risk: {result.costRisk}</p>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-slate-950/60 p-5">
              <p className="text-xs uppercase tracking-[0.28em] text-lime-200/70">
                City estimate
              </p>
              {result.cityMatch ? (
                <div className="mt-4 space-y-2 text-sm text-white/75">
                  <p>
                    {result.cityMatch.city}, {result.cityMatch.country}
                  </p>
                  <p>Rent: ~${result.cityMatch.avgRentUsd}</p>
                  <p>Food: ~${result.cityMatch.foodUsd}</p>
                  <p>Transport: ~${result.cityMatch.transportUsd}</p>
                  <p>Total monthly: ~${result.cityMatch.totalMonthlyCostUsd}</p>
                  <p className="text-xs text-white/50">{result.cityMatch.caution}</p>
                </div>
              ) : (
                <p className="mt-4 text-sm text-white/55">No city-specific estimate detected from the query.</p>
              )}
            </div>

            <div className="rounded-[28px] border border-white/10 bg-slate-950/60 p-5">
              <p className="text-xs uppercase tracking-[0.28em] text-lime-200/70">
                Roadmap
              </p>
              <div className="mt-4 space-y-2">
                {result.roadmap.map((item, index) => (
                  <p key={`${item}-${index}`} className="text-sm text-white/72">
                    {index + 1}. {item}
                  </p>
                ))}
              </div>
              <p className="mt-4 text-xs text-amber-100/80">{result.partTimeWarning}</p>
            </div>
          </>
        ) : null}
      </aside>
    </div>
  )
}
