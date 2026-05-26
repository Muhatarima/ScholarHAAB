import type { Metadata } from 'next'
import AuthSessionSync from '@/components/AuthSessionSync'
import PwaRegister from '@/components/PwaRegister'
import PageViewTracker from '@/components/analytics/PageViewTracker'
import OfflineBanner from '@/components/ui/OfflineBanner'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/seo'
import 'katex/dist/katex.min.css'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    'ScholarHAAB',
    'AI tutor Bangladesh',
    'A Level exam prep',
    'O Level exam prep',
    'O Level past paper solver',
    'A Level past paper solver',
    'Edexcel past papers',
    'Cambridge past papers',
  ],
  openGraph: {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>
        <OfflineBanner />
        <ErrorBoundary>
          <PageViewTracker />
          <AuthSessionSync />
          <PwaRegister />
          {children}
        </ErrorBoundary>
      </body>
    </html>
  )
}
