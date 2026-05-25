'use client'

import { useMemo, useState } from 'react'
import GraphFrame from './GraphFrame'
import { mapX, mapY, pointsToPath, sampleRange, type Point, type Range } from './graphUtils'

type StatisticsGraphType = 'normal' | 'histogram' | 'box' | 'scatter' | 'probability-tree' | 'cumulative-frequency'

export type StatisticsGraphProps = {
  type?: StatisticsGraphType
  title?: string
}

const WIDTH = 760
const HEIGHT = 420
const PADDING = 48
const RANGE: Range = { x: [-4, 4], y: [0, 0.45] }

export default function StatisticsGraph({ type = 'normal', title }: StatisticsGraphProps) {
  const [z, setZ] = useState(1)
  const titleText = title ?? statisticsTitle(type)
  const normal = useMemo(() => sampleRange(-4, 4, 240).map((x) => ({ x, y: Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI) })), [])
  const histogram = [8, 14, 22, 18, 11, 5]
  const scatter: Point[] = [
    { x: -3, y: 0.08 },
    { x: -2, y: 0.13 },
    { x: -1, y: 0.18 },
    { x: 0, y: 0.22 },
    { x: 1, y: 0.29 },
    { x: 2, y: 0.34 },
    { x: 3, y: 0.38 },
  ]

  if (type === 'probability-tree') {
    return (
      <GraphFrame title={titleText} subtitle="Interactive-style probability tree for conditional probability.">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={svgStyle}>
          <TreeNode x={90} y={210} label="Start" />
          <Branch x1={130} y1={210} x2={330} y2={120} label="P(A)=0.6" />
          <Branch x1={130} y1={210} x2={330} y2={300} label="P(A')=0.4" />
          <TreeNode x={350} y={120} label="A" />
          <TreeNode x={350} y={300} label="A'" />
          <Branch x1={390} y1={120} x2={610} y2={70} label="P(B|A)=0.7" />
          <Branch x1={390} y1={120} x2={610} y2={170} label="P(B'|A)=0.3" />
          <Branch x1={390} y1={300} x2={610} y2={250} label="P(B|A')=0.2" />
          <Branch x1={390} y1={300} x2={610} y2={350} label="P(B'|A')=0.8" />
          <TreeNode x={635} y={70} label="AB" />
          <TreeNode x={635} y={170} label="AB'" />
          <TreeNode x={635} y={250} label="A'B" />
          <TreeNode x={635} y={350} label="A'B'" />
        </svg>
        <p style={captionStyle}>Exam tip: multiply along branches; add final branches for “or”.</p>
      </GraphFrame>
    )
  }

  return (
    <GraphFrame title={titleText} subtitle="A Level statistics visual with exam-style labels.">
      {type === 'normal' ? (
        <label style={{ color: '#d8d5ff', fontSize: '12px' }}>
          Shade up to z = {z.toFixed(1)}
          <input type="range" min="-2.5" max="2.5" step="0.1" value={z} onChange={(event) => setZ(Number(event.target.value))} style={{ width: '100%' }} />
        </label>
      ) : null}
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={svgStyle}>
        <Axes range={type === 'normal' ? RANGE : { x: [0, 10], y: [0, 25] }} />
        {type === 'normal' ? (
          <>
            <polygon
              points={[
                `${mapX(-4, RANGE, WIDTH, PADDING)},${mapY(0, RANGE, HEIGHT, PADDING)}`,
                ...normal.filter((point) => point.x <= z).map((point) => `${mapX(point.x, RANGE, WIDTH, PADDING)},${mapY(point.y, RANGE, HEIGHT, PADDING)}`),
                `${mapX(z, RANGE, WIDTH, PADDING)},${mapY(0, RANGE, HEIGHT, PADDING)}`,
              ].join(' ')}
              fill="rgba(34,211,238,0.2)"
            />
            <path d={pointsToPath(normal, RANGE, WIDTH, HEIGHT, PADDING)} fill="none" stroke="#22d3ee" strokeWidth="4" />
            <text x={mapX(z, RANGE, WIDTH, PADDING) + 8} y={mapY(0.18, RANGE, HEIGHT, PADDING)} fill="#facc15" fontSize="13">z</text>
          </>
        ) : null}
        {type === 'histogram'
          ? histogram.map((height, index) => (
              <rect key={index} x={mapX(index + 1, { x: [0, 8], y: [0, 25] }, WIDTH, PADDING)} y={mapY(height, { x: [0, 8], y: [0, 25] }, HEIGHT, PADDING)} width="62" height={mapY(0, { x: [0, 8], y: [0, 25] }, HEIGHT, PADDING) - mapY(height, { x: [0, 8], y: [0, 25] }, HEIGHT, PADDING)} fill="rgba(139,92,246,0.65)" />
            ))
          : null}
        {type === 'box' ? <BoxPlot /> : null}
        {type === 'scatter' ? (
          <>
            {scatter.map((point) => <circle key={`${point.x}-${point.y}`} cx={mapX(point.x, RANGE, WIDTH, PADDING)} cy={mapY(point.y, RANGE, HEIGHT, PADDING)} r="6" fill="#facc15" />)}
            <line x1={mapX(-3.2, RANGE, WIDTH, PADDING)} y1={mapY(0.08, RANGE, HEIGHT, PADDING)} x2={mapX(3.2, RANGE, WIDTH, PADDING)} y2={mapY(0.38, RANGE, HEIGHT, PADDING)} stroke="#34d399" strokeWidth="3" />
          </>
        ) : null}
        {type === 'cumulative-frequency' ? (
          <path d={pointsToPath(sampleRange(0, 10, 120).map((x) => ({ x, y: 25 / (1 + Math.exp(-(x - 5))) })), { x: [0, 10], y: [0, 25] }, WIDTH, HEIGHT, PADDING)} fill="none" stroke="#22d3ee" strokeWidth="4" />
        ) : null}
      </svg>
      <p style={captionStyle}>Exam tip: quote probability areas, use clear scales, and show units or class widths where needed.</p>
    </GraphFrame>
  )
}

function Axes({ range }: { range: Range }) {
  return (
    <g>
      <line x1={PADDING} x2={WIDTH - PADDING} y1={HEIGHT - PADDING} y2={HEIGHT - PADDING} stroke="#d8b4fe" strokeWidth="2" />
      <line x1={PADDING} x2={PADDING} y1={PADDING} y2={HEIGHT - PADDING} stroke="#d8b4fe" strokeWidth="2" />
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
        <g key={ratio}>
          <line x1={PADDING + ratio * (WIDTH - PADDING * 2)} x2={PADDING + ratio * (WIDTH - PADDING * 2)} y1={PADDING} y2={HEIGHT - PADDING} stroke="rgba(255,255,255,0.07)" />
          <line x1={PADDING} x2={WIDTH - PADDING} y1={PADDING + ratio * (HEIGHT - PADDING * 2)} y2={PADDING + ratio * (HEIGHT - PADDING * 2)} stroke="rgba(255,255,255,0.07)" />
        </g>
      ))}
      <text x={WIDTH / 2} y={HEIGHT - 12} fill="#c4b5fd" fontSize="12" textAnchor="middle">value</text>
      <text x="16" y={HEIGHT / 2} fill="#c4b5fd" fontSize="12" transform={`rotate(-90 16 ${HEIGHT / 2})`} textAnchor="middle">frequency / density</text>
    </g>
  )
}

function BoxPlot() {
  const y = 210
  return (
    <g>
      <line x1="130" x2="630" y1={y} y2={y} stroke="#e9d5ff" strokeWidth="3" />
      <rect x="250" y={y - 45} width="245" height="90" fill="rgba(139,92,246,0.35)" stroke="#c4b5fd" strokeWidth="3" />
      <line x1="380" x2="380" y1={y - 45} y2={y + 45} stroke="#facc15" strokeWidth="3" />
      <text x="250" y={y + 66} fill="#c4b5fd" fontSize="12">Q1</text>
      <text x="380" y={y + 66} fill="#facc15" fontSize="12">median</text>
      <text x="495" y={y + 66} fill="#c4b5fd" fontSize="12">Q3</text>
    </g>
  )
}

function Branch({ x1, y1, x2, y2, label }: { x1: number; y1: number; x2: number; y2: number; label: string }) {
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#22d3ee" strokeWidth="3" />
      <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 8} fill="#facc15" fontSize="12" textAnchor="middle">{label}</text>
    </g>
  )
}

function TreeNode({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r="28" fill="#8b5cf6" />
      <text x={x} y={y + 4} fill="white" fontSize="13" textAnchor="middle">{label}</text>
    </g>
  )
}

function statisticsTitle(type: StatisticsGraphType) {
  return {
    normal: 'Normal distribution curve',
    histogram: 'Histogram',
    box: 'Box plot',
    scatter: 'Scatter graph with regression line',
    'probability-tree': 'Probability tree',
    'cumulative-frequency': 'Cumulative frequency curve',
  }[type]
}

const svgStyle = { width: '100%', minWidth: '520px', borderRadius: '16px', background: '#070713' }
const captionStyle = { margin: 0, color: '#c7c4e7', fontSize: '12px', lineHeight: 1.5 }
