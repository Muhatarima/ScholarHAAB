'use client'

import { useEffect } from 'react'

function isLocalDevelopment() {
  return process.env.NODE_ENV !== 'production'
}

export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    if (isLocalDevelopment()) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          if (registration.scope.startsWith(window.location.origin)) {
            void registration.unregister()
          }
        })
      }).catch(() => {
        // Ignore unregister failures in unsupported environments.
      })

      if ('caches' in window) {
        caches.keys().then((keys) => {
          keys
            .filter((key) => key.startsWith('scholarhaab-'))
            .forEach((key) => void caches.delete(key))
        }).catch(() => {
          // Cache cleanup is best-effort only.
        })
      }

      return
    }

    navigator.serviceWorker.register('/sw.js').then((registration) => {
      void registration.update()
    }).catch(() => {
      // Ignore registration failures in unsupported environments.
    })
  }, [])

  return null
}
