'use client'

import { useMemo, useState } from 'react'
import GraphFrame from './GraphFrame'
import { defaultExamTip, mapX, mapY, pointsToPath, sampleRange, type Point, type Range } from './graphUtils'

type PhysicsGraphType =
  | 'distance-time'
  | 'velocity-time'
  | 'force-extension'
  | 'wave'
  | 'electric-field'
  | 'projectile'
  | 'shm'

export type PhysicsGraphProps = {
  type: PhysicsGraphType
  data?: Point[]
  labels?: Record<string, string>
  interactive?: boolean
  title?: string
}

const WIDTH = 760
const HEIGHT = 420
const PADDING = 46

function buildDefaultData(type: PhysicsGraphType, amplitude: number, frequency: number): { points: Point[]; range: Range } {
  if (type === 'wave') {
    const wavelength = 2 * Math.PI / frequency
    return {
      points: sampleRange(0, 4 * Math.PI, 260).map((x) => ({ x, y: amplitude * Math.sin(frequency * x) })),
      range: { x: [0, 4 * Math.PI], y: [-Math.max(2, amplitude * 1.4), Math.max(2, amplitude * 1.4)] },
    }
  }
  if (type === 'projectile') {
    const points = sampleRange(0, 10, 180).map((x) => ({ x, y: -0.18 * (x - 5) ** 2 + 5 }))
    return { points, range: { x: [0, 10], y: [0, 6] } }
  }
  if (type === 'shm') {
    return {
      points: sampleRange(0, 8, 220).map((x) => ({ x, y: amplitude * Math.cos(2 * x) })),
      range: { x: [0, 8], y: [-3, 3] },
    }
  }
  if (type === 'force-extension') {
    return { points: sampleRange(0, 8, 80).map((x) => ({ x, y: 1.7 * x })), range: { x: [0, 8], y: [0, 15] } }
  }
  if (type === 'velocity-time') {
    return {
      points: [
        { x: 0, y: 0 },
        { x: 2, y: 8 },
        { x: 5, y: 8 },
        { x: 8, y: 0 },
      ],
      range: { x: [0, 8], y: [0, 10] },
    }
  }
  return {
    points: [
      { x: 0, y: 0 },
      { x: 2, y: 4 },
      { x: 5, y: 10 },
      { x: 8, y: 14 },
    ],
    range: { x: [0, 8], y: [0, 16] },
  }
}

function Axes({ range, xLabel, yLabel }: { range: Range; xLabel: string; yLabel: string }) {
  return (
    <g>
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const x = PADDING + ratio * (WIDTH - PADDING * 2)
        const y = PADDING + ratio * (HEIGHT - PADDING * 2)
        return (
          <g key={ratio}>
            <line x1={x} x2={x} y1={PADDING} y2={HEIGHT - PADDING} stroke="rgba(255,255,255,0.07)" />
            <line x1={PADDING} x2={WIDTH - PADDING} y1={y} y2={y} stroke="rgba(255,255,255,0.07)" />
          </g>
        )
      })}
      <line x1={PADDING} x2={WIDTH - PADDING} y1={HEIGHT - PADDING} y2={HEIGHT - PADDING} stroke="#d8b4fe" strokeWidth="2" />
      <line x1={PADDING} x2={PADDING} y1={PADDING} y2={HEIGHT - PADDING} stroke="#d8b4fe" strokeWidth="2" />
      <text x={WIDTH / 2} y={HEIGHT - 10} fill="#c4b5fd" fontSize="12" textAnchor="middle">{xLabel}</text>
      <text x="14" y={HEIGHT / 2} fill="#c4b5fd" fontSize="12" transform={`rotate(-90 14 ${HEIGHT / 2})`} textAnchor="middle">{yLabel}</text>
    </g>
  )
}

export default function PhysicsGraph({ type, data, labels = {}, interactive = true, title }: PhysicsGraphProps) {
  const [amplitude, setAmplitude] = useState(2)
  const [frequency, setFrequency] = useState(1)
  const graph = useMemo(() => {
    const defaults = buildDefaultData(type, amplitude, frequency)
    return data?.length ? { points: data, range: defaults.range } : defaults
  }, [amplitude, data, frequency, type])
  const titleText = title ?? physicsTitle(type)
  const xLabel = labels.x ?? (type.includes('time') || type === 'shm' ? 'time / s' : 'x')
  const yLabel = labels.y ?? physicsYLabel(type)

  if (type === 'electric-field') {
    return (
      <GraphFrame title={titleText} subtitle="Field lines show direction and relative strength.">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={svgStyle}>
          <defs>
            <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
              <path d="M0,0 L0,6 L9,3 z" fill="#67e8f9" />
            </marker>
          </defs>
          <circle cx="250" cy="210" r="28" fill="#8b5cf6" />
          <text x="250" y="216" textAnchor="middle" fill="white" fontSize="22">+</text>
          <circle cx="510" cy="210" r="28" fill="#f97316" />
          <text x="510" y="216" textAnchor="middle" fill="white" fontSize="22">−</text>
          {[-100, -60, -25, 0, 25, 60, 100].map((offset) => (
            <path key={offset} d={`M278 ${210 + offset * 0.55} C360 ${110 + offset}, 420 ${110 + offset}, 482 ${210 + offset * 0.55}`} fill="none" stroke="#67e8f9" strokeWidth="2" markerEnd="url(#arrow)" />
          ))}
        </svg>
        <p style={captionStyle}>Exam tip: arrows point from positive to negative; closer lines mean stronger field.</p>
      </GraphFrame>
    )
  }

  const areaPolygon = type === 'velocity-time'
    ? [
        `${mapX(graph.points[0].x, graph.range, WIDTH, PADDING)},${mapY(0, graph.range, HEIGHT, PADDING)}`,
        ...graph.points.map((point) => `${mapX(point.x, graph.range, WIDTH, PADDING)},${mapY(point.y, graph.range, HEIGHT, PADDING)}`),
        `${mapX(graph.points[graph.points.length - 1].x, graph.range, WIDTH, PADDING)},${mapY(0, graph.range, HEIGHT, PADDING)}`,
      ].join(' ')
    : ''

  const wavelength = 2 * Math.PI / frequency

  return (
    <GraphFrame title={titleText} subtitle={interactive ? 'Use the controls and hover/drag mentally like an exam sketch.' : undefined}>
      {type === 'wave' && interactive ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', color: '#d8d5ff', fontSize: '12px' }}>
          <label>Amplitude A: {amplitude.toFixed(1)}<input type="range" min="0.5" max="4" step="0.1" value={amplitude} onChange={(event) => setAmplitude(Number(event.target.value))} style={{ width: '100%' }} /></label>
          <label>Frequency: {frequency.toFixed(1)}<input type="range" min="0.5" max="2.5" step="0.1" value={frequency} onChange={(event) => setFrequency(Number(event.target.value))} style={{ width: '100%' }} /></label>
        </div>
      ) : null}
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={svgStyle}>
        <defs>
          <marker id="waveArrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
            <path d="M0,0 L0,6 L9,3 z" fill="#facc15" />
          </marker>
        </defs>
        <Axes range={graph.range} xLabel={xLabel} yLabel={yLabel} />
        {areaPolygon ? <polygon points={areaPolygon} fill="rgba(34,211,238,0.18)" stroke="rgba(34,211,238,0.5)" /> : null}
        <path d={pointsToPath(graph.points, graph.range, WIDTH, HEIGHT, PADDING)} fill="none" stroke="#22d3ee" strokeWidth="4" />
        {type === 'wave' ? (
          <g>
            <line x1={mapX(0, graph.range, WIDTH, PADDING)} x2={mapX(wavelength, graph.range, WIDTH, PADDING)} y1={mapY(-amplitude * 1.18, graph.range, HEIGHT, PADDING)} y2={mapY(-amplitude * 1.18, graph.range, HEIGHT, PADDING)} stroke="#facc15" strokeWidth="2" markerEnd="url(#waveArrow)" />
            <line x1={mapX(Math.PI / (2 * frequency), graph.range, WIDTH, PADDING)} x2={mapX(Math.PI / (2 * frequency), graph.range, WIDTH, PADDING)} y1={mapY(0, graph.range, HEIGHT, PADDING)} y2={mapY(amplitude, graph.range, HEIGHT, PADDING)} stroke="#fb7185" strokeWidth="2" />
            <text x={mapX(wavelength / 2, graph.range, WIDTH, PADDING)} y={mapY(-amplitude * 1.28, graph.range, HEIGHT, PADDING)} fill="#facc15" textAnchor="middle">λ</text>
            <text x={mapX(Math.PI / (2 * frequency), graph.range, WIDTH, PADDING) + 12} y={mapY(amplitude / 2, graph.range, HEIGHT, PADDING)} fill="#fb7185">A</text>
          </g>
        ) : null}
        {type === 'projectile' ? <text x="520" y="88" fill="#facc15" fontSize="13">parabolic path</text> : null}
      </svg>
      <p style={captionStyle}>{defaultExamTip(titleText)}</p>
    </GraphFrame>
  )
}

function physicsTitle(type: PhysicsGraphType) {
  return {
    'distance-time': 'Distance-time graph',
    'velocity-time': 'Velocity-time graph',
    'force-extension': 'Force-extension graph',
    wave: 'Wave diagram',
    'electric-field': 'Electric field lines',
    projectile: 'Projectile motion path',
    shm: 'Simple harmonic motion',
  }[type]
}

function physicsYLabel(type: PhysicsGraphType) {
  return {
    'distance-time': 'distance / m',
    'velocity-time': 'velocity / m s⁻¹',
    'force-extension': 'force / N',
    wave: 'displacement',
    'electric-field': 'field strength',
    projectile: 'height / m',
    shm: 'displacement',
  }[type]
}

const svgStyle = {
  width: '100%',
  minWidth: '520px',
  borderRadius: '16px',
  background: '#070713',
  overflow: 'visible',
}

const captionStyle = {
  margin: 0,
  color: '#c7c4e7',
  fontSize: '12px',
  lineHeight: 1.5,
}
