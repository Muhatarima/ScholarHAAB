'use client'

import { useState } from 'react'

type ReviewResponse = {
  documentType: 'sop' | 'lor' | 'cv'
  score: number
  verdict: 'strong' | 'promising' | 'weak'
  strengths: Array<{ label: string; detail: string }>
  issues: Array<{ label: string; severity: 'high' | 'medium' | 'low'; detail: string }>
  nextSteps: string[]
}

const SAMPLE_TEXT = {
  sop: `I want to pursue a master's degree in computer science because I worked on two data-driven campus projects and realized I want deeper training in applied machine learning. During my final year project, I led a small team, built the data pipeline, and improved classification accuracy from 71% to 84%.`,
  lor: `I taught Rahim in two upper-level economics courses and supervised his research assistant work for eight months. He ranked among the top 5% of students in my cohort, and his strongest quality was his ability to turn messy raw data into clear analysis.`,
  cv: `Education\nBSc in CSE, BRAC University\nProjects\nBuilt a web app used by 300+ students\nExperience\nResearch assistant for 8 months\nSkills\nPython, SQL, React`,
}

export function AbroadDocumentReviewWorkbench() {
  const [documentType, setDocumentType] = useState<'sop' | 'lor' | 'cv'>('sop')
  const [content, setContent] = useState(SAMPLE_TEXT.sop)
  const [result, setResult] = useState<ReviewResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const runReview = async () => {
    if (!content.trim()) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/abroad/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType,
          content,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? 'Could not review right now.')
      }
      setResult(data)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not review right now.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="rounded-[28px] border border-white/10 bg-slate-950/60 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.35)]">
        <p className="text-xs uppercase tracking-[0.28em] text-amber-200/70">
          Document reviewer
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-white">
          SOP, LOR, and CV review
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-white/70">
          Run a fast structured quality pass before sending the draft into chat for deeper rewriting.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {(['sop', 'lor', 'cv'] as const).map((value) => {
            const active = value === documentType
            return (
              <button
                key={value}
                onClick={() => {
                  setDocumentType(value)
                  setContent(SAMPLE_TEXT[value])
                }}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  active
                    ? 'bg-amber-300 text-slate-950'
                    : 'border border-white/10 bg-white/[0.03] text-white/75 hover:border-amber-300/40 hover:text-white'
                }`}
              >
                {value.toUpperCase()}
              </button>
            )
          })}
        </div>

        <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={14}
            className="w-full resize-none bg-transparent text-sm text-white outline-none placeholder:text-white/35"
            placeholder="Paste the draft here..."
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={() => void runReview()}
              disabled={loading}
              className="rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Reviewing...' : 'Run review'}
            </button>
          </div>
        </div>
      </section>

      <aside className="space-y-4">
        <div className="rounded-[28px] border border-white/10 bg-slate-950/60 p-5">
          <p className="text-xs uppercase tracking-[0.28em] text-amber-200/70">
            Review summary
          </p>
          {error ? <p className="mt-4 text-sm text-rose-200">{error}</p> : null}
          {!result && !error ? (
            <p className="mt-4 text-sm text-white/55">Run a review to see the score, issues, and next steps.</p>
          ) : null}
          {result ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm text-white/75">Score</p>
                <p className="mt-2 text-3xl font-semibold text-white">{result.score}/100</p>
                <p className="mt-2 text-sm text-amber-100/80">Verdict: {result.verdict}</p>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-white">Strengths</p>
                <div className="mt-3 space-y-3">
                  {result.strengths.map((item) => (
                    <div key={item.label}>
                      <p className="text-sm text-white">{item.label}</p>
                      <p className="mt-1 text-xs text-white/60">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-white">Issues</p>
                <div className="mt-3 space-y-3">
                  {result.issues.map((item) => (
                    <div key={`${item.label}-${item.severity}`}>
                      <p className="text-sm text-white">
                        {item.label} <span className="text-xs text-amber-100/80">({item.severity})</span>
                      </p>
                      <p className="mt-1 text-xs text-white/60">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-white">Next steps</p>
                <div className="mt-3 space-y-2">
                  {result.nextSteps.map((item, index) => (
                    <p key={`${item}-${index}`} className="text-sm text-white/70">
                      {index + 1}. {item}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  )
}
