import type { Metadata } from 'next'
import AuthSessionSync from '@/components/AuthSessionSync'
import './globals.css'

export const metadata: Metadata = {
  title: 'ScholarHAAB',
  description: 'AI help for scholarships, study abroad planning, and O/A Level exam preparation.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>
        <AuthSessionSync />
        {children}
      </body>
    </html>
  )
}
