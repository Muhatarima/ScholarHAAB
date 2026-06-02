'use client'

import LatexRenderer from '@/components/math/LatexRenderer'

type MathBlockProps = {
  title?: string
  latex?: string
  steps?: string[]
  tip?: string
}

export default function MathBlock({ title = 'Math engine', latex, steps = [], tip }: MathBlockProps) {
  return (
    <section className="rounded-3xl border border-violet-500/25 bg-[#100B24]/80 p-4 text-slate-100 shadow-[0_0_40px_rgba(147,51,234,0.12)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-violet-200">{title}</p>
        <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200">
          AI reasoning
        </span>
      </div>
      {latex ? (
        <div className="mb-3 rounded-2xl border border-violet-400/20 bg-black/20 px-3 py-2 text-violet-50">
          <LatexRenderer latex={latex} display />
        </div>
      ) : null}
      {steps.length ? (
        <ol className="space-y-2 text-sm text-slate-200">
          {steps.map((step, index) => (
            <li key={`${step}-${index}`} className="rounded-2xl bg-white/[0.03] px-3 py-2">
              {step}
            </li>
          ))}
        </ol>
      ) : null}
      {tip ? <p className="mt-3 text-sm text-violet-200">{tip}</p> : null}
    </section>
  )
}
