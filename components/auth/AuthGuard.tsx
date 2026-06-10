'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createSupabaseClient } from '@/lib/supabase/clientClient'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [checking, setChecking] = useState(true)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    let active = true
    const bypassAuth =
      process.env.NODE_ENV !== 'production' &&
      process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

    if (bypassAuth) {
      queueMicrotask(() => {
        if (!active) return
        setAuthed(true)
        setChecking(false)
      })
      return () => {
        active = false
      }
    }

    const supabase = createSupabaseClient()

    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return

      if (!data.user) {
        const next = pathname ? `?next=${encodeURIComponent(pathname)}` : ''
        router.replace(`/login${next}`)
        setAuthed(false)
      } else {
        setAuthed(true)
      }
      setChecking(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      if (!session?.user) {
        const next = pathname ? `?next=${encodeURIComponent(pathname)}` : ''
        router.replace(`/login${next}`)
        setAuthed(false)
      } else {
        setAuthed(true)
        setChecking(false)
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [pathname, router])

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="flex gap-1">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
              style={{ animationDelay: `${index * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (!authed) return null

  return <>{children}</>
}
