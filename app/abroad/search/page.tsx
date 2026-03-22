import Link from 'next/link'
import { AbroadSearchWorkbench } from '@/components/AbroadSearchWorkbench'

export default function AbroadSearchPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_40%),linear-gradient(180deg,_#07111f_0%,_#020617_100%)] px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">
              ScholarHAAB Abroad
            </p>
            <h1 className="mt-2 text-3xl font-semibold">
              Scholarship search workbench
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-white/70">
              Test country, degree, field, and funding matching before sending the student into chat.
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/abroad"
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/75 transition hover:border-emerald-300/60 hover:text-white"
            >
              Back to Abroad
            </Link>
            <Link
              href="/chat"
              className="rounded-full bg-emerald-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200"
            >
              Open Chat
            </Link>
          </div>
        </div>

        <AbroadSearchWorkbench />
      </div>
    </main>
  )
}
