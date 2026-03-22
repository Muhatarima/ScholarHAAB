import Link from 'next/link'
import { AbroadGuidanceWorkbench } from '@/components/AbroadGuidanceWorkbench'

export default function AbroadGuidancePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_40%),linear-gradient(180deg,_#07111f_0%,_#020617_100%)] px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sky-200/70">
              ScholarHAAB Abroad
            </p>
            <h1 className="mt-2 text-3xl font-semibold">
              Guidance workbench
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-white/70">
              Search practical official-backed guidance for visa, finance, living, and exam-policy questions.
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/abroad"
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/75 transition hover:border-sky-300/60 hover:text-white"
            >
              Back to Abroad
            </Link>
            <Link
              href="/abroad/search"
              className="rounded-full border border-sky-300/20 px-4 py-2 text-sm text-sky-100 transition hover:border-sky-300/60"
            >
              Scholarship search
            </Link>
          </div>
        </div>

        <AbroadGuidanceWorkbench />
      </div>
    </main>
  )
}
