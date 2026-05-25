'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AuthGuard from '@/components/auth/AuthGuard'

export default function ChatHubPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/qbank')
  }, [router])

  return (
    <AuthGuard>
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        Redirecting to QBank...
      </main>
    </AuthGuard>
  )
}
