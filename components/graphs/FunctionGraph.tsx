'use client'

import { useMemo, useState } from 'react'
import GraphFrame from './GraphFrame'
import {
  GRAPH_COLORS,
  clamp,
  compileFunction,
  defaultExamTip,
  findRoots,
  findTurningPoints,
  mapX,
  mapY,
  pointsToPath,
  polygonForArea,
  sampleRange,
  unmapX,
  type Point,
  type Range,
} from './graphUtils'

export type FunctionGraphProps = {
  functions: string[]
  range?: Range
  showArea?: boolean
  areaRange?: [number, number]
  title?: string
}

const WIDTH = 760
const HEIGHT = 430
const PADDING = 44

function GraphGrid({ range }: { range: Range }) {
  const xTicks = sampleRange(Math.ceil(range.x[0]), Math.floor(range.x[1]), 9)
  const yTicks = sampleRange(Math.ceil(range.y[0]), Math.floor(range.y[1]), 7)
  return (
    <g>
      {xTicks.map((tick) => (
        <g key={`x-${tick}`}>
          <line x1={mapX(tick, range, WIDTH, PADDING)} x2={mapX(tick, range, WIDTH, PADDING)} y1={PADDING} y2={HEIGHT - PADDING} stroke="rgba(255,255,255,0.06)" />
          <text x={mapX(tick, range, WIDTH, PADDING)} y={HEIGHT - 14} fill="#8f8db4" fontSize="10" textAnchor="middle">
            {Number(tick.toFixed(1))}
          </text>
        </g>
      ))}
      {yTicks.map((tick) => (
        <g key={`y-${tick}`}>
          <line x1={PADDING} x2={WIDTH - PADDING} y1={mapY(tick, range, HEIGHT, PADDING)} y2={mapY(tick, range, HEIGHT, PADDING)} stroke="rgba(255,255,255,0.06)" />
          <text x="12" y={mapY(tick, range, HEIGHT, PADDING) + 4} fill="#8f8db4" fontSize="10">
            {Number(tick.toFixed(1))}
          </text>
        </g>
      ))}
      <line x1={PADDING} x2={WIDTH - PADDING} y1={mapY(0, range, HEIGHT, PADDING)} y2={mapY(0, range, HEIGHT, PADDING)} stroke="rgba(255,255,255,0.22)" />
      <line x1={mapX(0, range, WIDTH, PADDING)} x2={mapX(0, range, WIDTH, PADDING)} y1={PADDING} y2={HEIGHT - PADDING} stroke="rgba(255,255,255,0.22)" />
    </g>
  )
}

export default function FunctionGraph({
  functions,
  range = { x: [-10, 10], y: [-10, 10] },
  showArea = false,
  areaRange = [0, 3],
  title = 'Function graph',
}: FunctionGraphProps) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [probeX, setProbeX] = useState((range.x[0] + range.x[1]) / 2)

  const viewRange = useMemo<Range>(() => {
    const xHalf = (range.x[1] - range.x[0]) / (2 * zoom)
    const yHalf = (range.y[1] - range.y[0]) / (2 * zoom)
    const xCenter = (range.x[0] + range.x[1]) / 2 + pan.x
    const yCenter = (range.y[0] + range.y[1]) / 2 + pan.y
    return { x: [xCenter - xHalf, xCenter + xHalf], y: [yCenter - yHalf, yCenter + yHalf] }
  }, [pan.x, pan.y, range.x, range.y, zoom])

  const plotted = useMemo(() => {
    return functions.map((expression) => {
      const fn = compileFunction(expression)
      const points = sampleRange(viewRange.x[0], viewRange.x[1], 320).map((x) => ({ x, y: fn(x) }))
      return { expression, fn, points, roots: findRoots(points), turns: findTurningPoints(points) }
    })
  }, [functions, viewRange])

  const first = plotted[0]
  const probeY = first ? first.fn(probeX) : 0
  const h = Math.max(0.0001, (viewRange.x[1] - viewRange.x[0]) / 500)
  const slope = first ? (first.fn(probeX + h) - first.fn(probeX - h)) / (2 * h) : 0
  const tangentPoints: Point[] = [
    { x: probeX - 2, y: probeY - 2 * slope },
    { x: probeX + 2, y: probeY + 2 * slope },
  ]
  const areaPoints = first
    ? first.points.filter((point) => point.x >= areaRange[0] && point.x <= areaRange[1])
    : []

  const moveProbeFromPointer = (clientX: number, rectLeft: number, rectWidth: number) => {
    const svgX = ((clientX - rectLeft) / rectWidth) * WIDTH
    setProbeX(clamp(unmapX(svgX, viewRange, WIDTH, PADDING), viewRange.x[0], viewRange.x[1]))
  }

  return (
    <GraphFrame title={title} subtitle="Zoom, pan, inspect values, tangent, roots, and area under the curve.">
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => setZoom((value) => Math.min(5, value * 1.25))} style={buttonStyle}>Zoom in</button>
        <button type="button" onClick={() => setZoom((value) => Math.max(0.5, value / 1.25))} style={buttonStyle}>Zoom out</button>
        <button type="button" onClick={() => setPan((value) => ({ ...value, x: value.x - 1 / zoom }))} style={buttonStyle}>Left</button>
        <button type="button" onClick={() => setPan((value) => ({ ...value, x: value.x + 1 / zoom }))} style={buttonStyle}>Right</button>
        <button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }} style={buttonStyle}>Reset</button>
      </div>
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg
          role="img"
          aria-label={title}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          style={{ width: '100%', minWidth: '520px', borderRadius: '16px', background: '#070713', touchAction: 'none' }}
          onPointerMove={(event) => {
            if (event.buttons !== 1) return
            const rect = event.currentTarget.getBoundingClientRect()
            moveProbeFromPointer(event.clientX, rect.left, rect.width)
          }}
          onPointerDown={(event) => {
            const rect = event.currentTarget.getBoundingClientRect()
            moveProbeFromPointer(event.clientX, rect.left, rect.width)
          }}
        >
          <GraphGrid range={viewRange} />
          {showArea && areaPoints.length > 2 ? (
            <polygon points={polygonForArea(areaPoints, viewRange, WIDTH, HEIGHT, PADDING)} fill="rgba(34,211,238,0.2)" stroke="rgba(34,211,238,0.5)" />
          ) : null}
          {plotted.map((plot, index) => (
            <g key={plot.expression}>
              <path d={pointsToPath(plot.points, viewRange, WIDTH, HEIGHT, PADDING)} fill="none" stroke={GRAPH_COLORS[index % GRAPH_COLORS.length]} strokeWidth="3" />
              {plot.roots.map((root, rootIndex) => (
                <circle key={`root-${rootIndex}`} cx={mapX(root.x, viewRange, WIDTH, PADDING)} cy={mapY(root.y, viewRange, HEIGHT, PADDING)} r="5" fill="#facc15" />
              ))}
              {plot.turns.map((turn, turnIndex) => (
                <rect key={`turn-${turnIndex}`} x={mapX(turn.x, viewRange, WIDTH, PADDING) - 5} y={mapY(turn.y, viewRange, HEIGHT, PADDING) - 5} width="10" height="10" rx="3" fill="#fb7185" />
              ))}
            </g>
          ))}
          {Number.isFinite(probeY) ? (
            <g>
              <path d={pointsToPath(tangentPoints, viewRange, WIDTH, HEIGHT, PADDING)} fill="none" stroke="#facc15" strokeWidth="2" strokeDasharray="6 6" />
              <circle cx={mapX(probeX, viewRange, WIDTH, PADDING)} cy={mapY(probeY, viewRange, HEIGHT, PADDING)} r="7" fill="#ffffff" stroke="#8b5cf6" strokeWidth="3" />
              <text x={mapX(probeX, viewRange, WIDTH, PADDING) + 12} y={mapY(probeY, viewRange, HEIGHT, PADDING) - 10} fill="#f8fafc" fontSize="12">
                ({probeX.toFixed(2)}, {probeY.toFixed(2)})
              </text>
            </g>
          ) : null}
        </svg>
      </div>
      <div style={{ display: 'grid', gap: '6px', color: '#c7c4e7', fontSize: '12px' }}>
        <div>{functions.map((fn, index) => <span key={fn} style={{ marginRight: 14, color: GRAPH_COLORS[index % GRAPH_COLORS.length] }}>y = {fn}</span>)}</div>
        <div>Tangent gradient at x = {probeX.toFixed(2)} is about {Number.isFinite(slope) ? slope.toFixed(3) : 'undefined'}.</div>
        <div>{defaultExamTip(title)}</div>
      </div>
    </GraphFrame>
  )
}

const buttonStyle = {
  border: '1px solid rgba(139,92,246,0.35)',
  background: 'rgba(139,92,246,0.12)',
  color: '#ddd6fe',
  borderRadius: '999px',
  padding: '7px 11px',
  cursor: 'pointer',
  fontSize: '12px',
  fontWeight: 800,
}
