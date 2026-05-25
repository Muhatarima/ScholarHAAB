'use client'

import { useMemo, useState } from 'react'
import GraphFrame from './GraphFrame'
import { defaultExamTip, mapX, mapY, pointsToPath, sampleRange, type Point, type Range } from './graphUtils'

type ChemistryGraphType =
  | 'energy-profile'
  | 'rate'
  | 'titration'
  | 'ph'
  | 'maxwell-boltzmann'
  | 'concentration-time'

export type ChemistryGraphProps = {
  type?: ChemistryGraphType
  title?: string
  interactive?: boolean
}

const WIDTH = 760
const HEIGHT = 420
const PADDING = 48
const RANGE: Range = { x: [0, 10], y: [0, 10] }

function energyProfile(catalyst: boolean): Point[] {
  return sampleRange(0, 10, 180).map((x) => ({
    x,
    y: 2 + 2.2 / (1 + Math.exp(-(x - 1.6))) + (catalyst ? 2.2 : 4.1) * Math.exp(-((x - 4.5) ** 2) / 2.2) - 1.6 / (1 + Math.exp(-(x - 7.2))),
  }))
}

function graphPoints(type: ChemistryGraphType): Point[] {
  if (type === 'titration' || type === 'ph') {
    return sampleRange(0, 10, 220).map((x) => ({ x, y: 2 + 8 / (1 + Math.exp(-(x - 5) * 3.3)) }))
  }
  if (type === 'maxwell-boltzmann') {
    return sampleRange(0.1, 10, 220).map((x) => ({ x, y: 15 * x ** 2 * Math.exp(-x / 1.15) }))
  }
  if (type === 'rate') {
    return sampleRange(0, 10, 180).map((x) => ({ x, y: 9 * (1 - Math.exp(-x / 2.2)) }))
  }
  if (type === 'concentration-time') {
    return sampleRange(0, 10, 180).map((x) => ({ x, y: 9 * Math.exp(-x / 4) + 0.5 }))
  }
  return energyProfile(false)
}

export default function ChemistryGraph({ type = 'energy-profile', title, interactive = true }: ChemistryGraphProps) {
  const [hover, setHover] = useState<Point | null>(null)
  const points = useMemo(() => graphPoints(type), [type])
  const catalyst = useMemo(() => (type === 'energy-profile' ? energyProfile(true) : []), [type])
  const titleText = title ?? chemistryTitle(type)
  const equivalence = { x: 5, y: 6 }

  return (
    <GraphFrame title={titleText} subtitle="Cambridge-style chemistry visual with hover labels and exam annotations.">
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          style={{ width: '100%', minWidth: '520px', borderRadius: '16px', background: '#070713' }}
          onPointerMove={(event) => {
            if (!interactive) return
            const rect = event.currentTarget.getBoundingClientRect()
            const x = ((event.clientX - rect.left) / rect.width) * 10
            const nearest = points.reduce((best, point) => (Math.abs(point.x - x) < Math.abs(best.x - x) ? point : best), points[0])
            setHover(nearest)
          }}
          onPointerLeave={() => setHover(null)}
        >
          <Axes xLabel={xLabel(type)} yLabel={yLabel(type)} />
          <path d={pointsToPath(points, RANGE, WIDTH, HEIGHT, PADDING)} fill="none" stroke="#22d3ee" strokeWidth="4" />
          {catalyst.length ? <path d={pointsToPath(catalyst, RANGE, WIDTH, HEIGHT, PADDING)} fill="none" stroke="#34d399" strokeWidth="3" strokeDasharray="7 7" /> : null}
          {type === 'energy-profile' ? (
            <g>
              <line x1={mapX(2.1, RANGE, WIDTH, PADDING)} x2={mapX(2.1, RANGE, WIDTH, PADDING)} y1={mapY(4, RANGE, HEIGHT, PADDING)} y2={mapY(8.1, RANGE, HEIGHT, PADDING)} stroke="#facc15" strokeWidth="2" />
              <text x={mapX(2.25, RANGE, WIDTH, PADDING)} y={mapY(6.2, RANGE, HEIGHT, PADDING)} fill="#facc15" fontSize="13">Ea</text>
              <line x1={mapX(8.2, RANGE, WIDTH, PADDING)} x2={mapX(8.2, RANGE, WIDTH, PADDING)} y1={mapY(4, RANGE, HEIGHT, PADDING)} y2={mapY(2.6, RANGE, HEIGHT, PADDING)} stroke="#fb7185" strokeWidth="2" />
              <text x={mapX(8.35, RANGE, WIDTH, PADDING)} y={mapY(3.3, RANGE, HEIGHT, PADDING)} fill="#fb7185" fontSize="13">ΔH</text>
              <text x={mapX(5.4, RANGE, WIDTH, PADDING)} y={mapY(6, RANGE, HEIGHT, PADDING)} fill="#34d399" fontSize="12">catalyst: lower Ea</text>
            </g>
          ) : null}
          {type === 'titration' || type === 'ph' ? (
            <g>
              <line x1={mapX(equivalence.x, RANGE, WIDTH, PADDING)} x2={mapX(equivalence.x, RANGE, WIDTH, PADDING)} y1={PADDING} y2={HEIGHT - PADDING} stroke="#facc15" strokeDasharray="6 6" />
              <circle cx={mapX(equivalence.x, RANGE, WIDTH, PADDING)} cy={mapY(equivalence.y, RANGE, HEIGHT, PADDING)} r="6" fill="#facc15" />
              <text x={mapX(equivalence.x, RANGE, WIDTH, PADDING) + 12} y={mapY(equivalence.y, RANGE, HEIGHT, PADDING)} fill="#facc15" fontSize="12">equivalence point</text>
            </g>
          ) : null}
          {hover ? (
            <g>
              <circle cx={mapX(hover.x, RANGE, WIDTH, PADDING)} cy={mapY(hover.y, RANGE, HEIGHT, PADDING)} r="6" fill="#fff" />
              <rect x={mapX(hover.x, RANGE, WIDTH, PADDING) + 10} y={mapY(hover.y, RANGE, HEIGHT, PADDING) - 34} width="118" height="28" rx="8" fill="rgba(15,23,42,0.92)" />
              <text x={mapX(hover.x, RANGE, WIDTH, PADDING) + 18} y={mapY(hover.y, RANGE, HEIGHT, PADDING) - 16} fill="#f8fafc" fontSize="12">
                x {hover.x.toFixed(2)}, y {hover.y.toFixed(2)}
              </text>
            </g>
          ) : null}
        </svg>
      </div>
      <p style={{ margin: 0, color: '#c7c4e7', fontSize: '12px', lineHeight: 1.5 }}>{defaultExamTip(titleText)}</p>
    </GraphFrame>
  )
}

function Axes({ xLabel, yLabel }: { xLabel: string; yLabel: string }) {
  return (
    <g>
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
        <g key={ratio}>
          <line x1={PADDING + ratio * (WIDTH - PADDING * 2)} x2={PADDING + ratio * (WIDTH - PADDING * 2)} y1={PADDING} y2={HEIGHT - PADDING} stroke="rgba(255,255,255,0.07)" />
          <line x1={PADDING} x2={WIDTH - PADDING} y1={PADDING + ratio * (HEIGHT - PADDING * 2)} y2={PADDING + ratio * (HEIGHT - PADDING * 2)} stroke="rgba(255,255,255,0.07)" />
        </g>
      ))}
      <line x1={PADDING} x2={WIDTH - PADDING} y1={HEIGHT - PADDING} y2={HEIGHT - PADDING} stroke="#d8b4fe" strokeWidth="2" />
      <line x1={PADDING} x2={PADDING} y1={PADDING} y2={HEIGHT - PADDING} stroke="#d8b4fe" strokeWidth="2" />
      <text x={WIDTH / 2} y={HEIGHT - 10} fill="#c4b5fd" fontSize="12" textAnchor="middle">{xLabel}</text>
      <text x="14" y={HEIGHT / 2} fill="#c4b5fd" fontSize="12" transform={`rotate(-90 14 ${HEIGHT / 2})`} textAnchor="middle">{yLabel}</text>
    </g>
  )
}

function chemistryTitle(type: ChemistryGraphType) {
  return {
    'energy-profile': 'Energy profile diagram',
    rate: 'Rate of reaction graph',
    titration: 'Titration curve',
    ph: 'pH curve',
    'maxwell-boltzmann': 'Maxwell-Boltzmann distribution',
    'concentration-time': 'Concentration-time graph',
  }[type]
}

function xLabel(type: ChemistryGraphType) {
  return type === 'titration' || type === 'ph' ? 'volume added / cm³' : type === 'maxwell-boltzmann' ? 'molecular energy' : 'reaction progress / time'
}

function yLabel(type: ChemistryGraphType) {
  return type === 'titration' || type === 'ph' ? 'pH' : type === 'maxwell-boltzmann' ? 'number of molecules' : 'energy / concentration'
}
