import Link from 'next/link'
import { AbroadDocumentCheckWorkbench } from '@/components/AbroadDocumentCheckWorkbench'

export default function AbroadDocumentCheckPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(217,70,239,0.18),_transparent_40%),linear-gradient(180deg,_#07111f_0%,_#020617_100%)] px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-fuchsia-200/70">
              ScholarHAAB Abroad
            </p>
            <h1 className="mt-2 text-3xl font-semibold">
              Document check workbench
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-white/70">
              Catch quiet document risks before they damage the application.
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/abroad"
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/75 transition hover:border-fuchsia-300/60 hover:text-white"
            >
              Back to Abroad
            </Link>
            <Link
              href="/abroad/review"
              className="rounded-full border border-fuchsia-300/20 px-4 py-2 text-sm text-fuchsia-100 transition hover:border-fuchsia-300/60"
            >
              Draft review
            </Link>
          </div>
        </div>

        <AbroadDocumentCheckWorkbench />
      </div>
    </main>
  )
}
