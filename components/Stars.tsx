'use client'

import { useEffect, useRef } from 'react'

export default function Stars() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    for (let i = 0; i < 160; i++) {
      const star = document.createElement('div')
      const size = Math.random() * 2.2 + 0.3
      const dur = 1.5 + Math.random() * 5
      const delay = Math.random() * 7

      star.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        left: ${Math.random() * 100}%;
        top: ${Math.random() * 100}%;
        background: white;
        border-radius: 50%;
        opacity: ${0.1 + Math.random() * 0.8};
        animation: twinkle ${dur}s ${delay}s infinite;
      `
      container.appendChild(star)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  )
}