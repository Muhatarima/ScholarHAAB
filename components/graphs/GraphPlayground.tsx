'use client'

import { useRef, useState } from 'react'
import FunctionGraph from './FunctionGraph'
import PhysicsGraph from './PhysicsGraph'
import ChemistryGraph from './ChemistryGraph'
import StatisticsGraph from './StatisticsGraph'

export default function GraphPlayground() {
  const [input, setInput] = useState('x^2, sin(x), 2*x+1')
  const [explanation, setExplanation] = useState('')
  const [loading, setLoading] = useState(false)
  const shareInput = useRef<HTMLInputElement>(null)
  const playgroundRef = useRef<HTMLDivElement>(null)
  const functions = input
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

  const explainGraph = async () => {
    setLoading(true)
    setExplanation('')
    try {
      const response = await fetch('/api/qbank/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Explain what these graphs tell a Cambridge A/O Level student: ${functions.join(', ')}`,
        }),
      })
      const data = (await response.json()) as { answer?: string; error?: string }
      setExplanation(data.answer || localExplanation(functions))
    } catch {
      setExplanation(localExplanation(functions))
    } finally {
      setLoading(false)
    }
  }

  const shareUrl = typeof window === 'undefined'
    ? ''
    : `${window.location.origin}/qbank/graphs?f=${encodeURIComponent(input)}`

  const downloadPng = async () => {
    const svg = playgroundRef.current?.querySelector('svg')
    if (!svg) return
    const xml = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 1200
      canvas.height = 680
      const context = canvas.getContext('2d')
      if (!context) return
      context.fillStyle = '#070713'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      const link = document.createElement('a')
      link.download = 'scholarhaab-graph.png'
      link.href = canvas.toDataURL('image/png')
      link.click()
    }
    image.src = url
  }

  return (
    <div style={{ display: 'grid', gap: '18px' }}>
      <section
        style={{
          display: 'grid',
          gap: '12px',
          padding: '16px',
          borderRadius: '22px',
          border: '1px solid rgba(139,92,246,0.25)',
          background: 'rgba(255,255,255,0.035)',
        }}
      >
        <label style={{ color: '#f4f0ff', fontWeight: 800 }}>
          Type functions separated by commas
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="x^2, sin(x), ln(x)"
            style={{
              marginTop: '8px',
              width: '100%',
              borderRadius: '14px',
              border: '1px solid rgba(139,92,246,0.28)',
              background: '#080812',
              color: '#f4f0ff',
              padding: '12px 14px',
              fontSize: '14px',
            }}
          />
        </label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" onClick={explainGraph} style={buttonStyle}>{loading ? 'Thinking...' : 'What does this graph tell us?'}</button>
          <button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(shareUrl)}
            style={buttonStyle}
          >
            Share graph link
          </button>
          <button
            type="button"
            onClick={() => void downloadPng()}
            style={buttonStyle}
          >
            Download PNG
          </button>
        </div>
        <input ref={shareInput} readOnly value={shareUrl} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
      </section>

      <div ref={playgroundRef}>
        <FunctionGraph title="Graph playground" functions={functions.length ? functions : ['x^2']} showArea={/x\^?2/i.test(input)} areaRange={[0, 3]} />
      </div>

      {explanation ? (
        <section style={{ borderRadius: '18px', background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.2)', padding: '14px', color: '#dffcff', lineHeight: 1.65 }}>
          {explanation}
        </section>
      ) : null}

      <section style={{ display: 'grid', gap: '14px' }}>
        <h2 style={{ color: '#f4f0ff', margin: 0, fontSize: '20px' }}>Exam graph quick gallery</h2>
        <PhysicsGraph type="velocity-time" title="Velocity-time graph with area" />
        <PhysicsGraph type="wave" title="Sine wave with λ and A marked" />
        <ChemistryGraph type="energy-profile" title="Energy profile with Ea and ΔH" />
        <ChemistryGraph type="titration" title="Titration curve with equivalence point" />
        <StatisticsGraph type="normal" title="Normal distribution curve" />
      </section>
    </div>
  )
}

function localExplanation(functions: string[]) {
  return `Look at the shape first. ${functions.join(', ')} helps you compare gradient, intercepts, turning points, and area under the curve. In Cambridge answers, label axes and quote exact coordinates where possible.`
}

const buttonStyle = {
  border: '1px solid rgba(139,92,246,0.35)',
  background: 'rgba(139,92,246,0.14)',
  color: '#f4f0ff',
  borderRadius: '999px',
  padding: '9px 13px',
  cursor: 'pointer',
  fontSize: '12px',
  fontWeight: 900,
}
