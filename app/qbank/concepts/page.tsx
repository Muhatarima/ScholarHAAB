import Link from 'next/link'
import { QbankConceptWorkbench } from '@/components/QbankConceptWorkbench'

export default function QbankConceptsPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),_transparent_40%),linear-gradient(180deg,_#07111f_0%,_#020617_100%)] px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">
              ScholarHAAB QBank
            </p>
            <h1 className="mt-2 text-3xl font-semibold">
              Concept and formula workbench
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-white/70">
              Search concept cards and formula hints across major QBank subjects before sending the query into chat.
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
              className="rounded-full border border-cyan-300/20 px-4 py-2 text-sm text-cyan-100 transition hover:border-cyan-300/60"
            >
              Search workbench
            </Link>
          </div>
        </div>

        <QbankConceptWorkbench />
      </div>
    </main>
  )
}
