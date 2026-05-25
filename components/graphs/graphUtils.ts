'use client'

export type Point = { x: number; y: number }
export type Range = { x: [number, number]; y: [number, number] }

export const GRAPH_COLORS = ['#8b5cf6', '#22d3ee', '#f97316', '#34d399', '#f472b6', '#facc15']

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function mapX(x: number, range: Range, width: number, padding: number) {
  const [xMin, xMax] = range.x
  return padding + ((x - xMin) / (xMax - xMin)) * (width - padding * 2)
}

export function mapY(y: number, range: Range, height: number, padding: number) {
  const [yMin, yMax] = range.y
  return height - padding - ((y - yMin) / (yMax - yMin)) * (height - padding * 2)
}

export function unmapX(px: number, range: Range, width: number, padding: number) {
  const [xMin, xMax] = range.x
  return xMin + ((px - padding) / (width - padding * 2)) * (xMax - xMin)
}

export function pointsToPath(points: Point[], range: Range, width: number, height: number, padding: number) {
  return points
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${mapX(point.x, range, width, padding)} ${mapY(point.y, range, height, padding)}`)
    .join(' ')
}

export function polygonForArea(points: Point[], range: Range, width: number, height: number, padding: number) {
  if (points.length < 2) {
    return ''
  }
  const baseY = mapY(0, range, height, padding)
  const first = points[0]
  const last = points[points.length - 1]
  return [
    `${mapX(first.x, range, width, padding)},${baseY}`,
    ...points.map((point) => `${mapX(point.x, range, width, padding)},${mapY(point.y, range, height, padding)}`),
    `${mapX(last.x, range, width, padding)},${baseY}`,
  ].join(' ')
}

export function sampleRange(xMin: number, xMax: number, count = 240) {
  return Array.from({ length: count }, (_, index) => xMin + ((xMax - xMin) * index) / Math.max(1, count - 1))
}

export function compileFunction(expression: string) {
  const normalized = expression
    .replace(/^y\s*=\s*/i, '')
    .replace(/\^/g, '**')
    .replace(/\bln\s*\(/gi, 'Math.log(')
    .replace(/\blog\s*\(/gi, 'Math.log10(')
    .replace(/\bsin\s*\(/gi, 'Math.sin(')
    .replace(/\bcos\s*\(/gi, 'Math.cos(')
    .replace(/\btan\s*\(/gi, 'Math.tan(')
    .replace(/\bsqrt\s*\(/gi, 'Math.sqrt(')
    .replace(/\bpi\b/gi, 'Math.PI')
    .replace(/π/g, 'Math.PI')

  return (x: number) => {
    try {
      // Function expressions are student-entered graph formulas; only x and Math are exposed.
      const value = Function('x', `"use strict"; return (${normalized})`)(x) as number
      return Number.isFinite(value) ? value : Number.NaN
    } catch {
      return Number.NaN
    }
  }
}

export function findRoots(points: Point[]) {
  const roots: Point[] = []
  for (let index = 1; index < points.length; index += 1) {
    const prev = points[index - 1]
    const current = points[index]
    if (!Number.isFinite(prev.y) || !Number.isFinite(current.y)) {
      continue
    }
    if (prev.y === 0 || prev.y * current.y < 0) {
      const t = Math.abs(prev.y) / (Math.abs(prev.y) + Math.abs(current.y))
      roots.push({ x: prev.x + (current.x - prev.x) * t, y: 0 })
    }
  }
  return roots.slice(0, 6)
}

export function findTurningPoints(points: Point[]) {
  const turns: Point[] = []
  for (let index = 2; index < points.length - 2; index += 1) {
    const prevSlope = points[index].y - points[index - 2].y
    const nextSlope = points[index + 2].y - points[index].y
    if (Number.isFinite(prevSlope) && Number.isFinite(nextSlope) && prevSlope * nextSlope < 0) {
      turns.push(points[index])
    }
  }
  return turns.slice(0, 4)
}

export function defaultExamTip(title: string) {
  if (/velocity/i.test(title)) {
    return 'Exam tip: gradient gives acceleration; area under the graph gives displacement.'
  }
  if (/wave/i.test(title)) {
    return 'Exam tip: label amplitude from centre line to crest, and wavelength crest-to-crest.'
  }
  if (/energy/i.test(title)) {
    return 'Exam tip: catalyst lowers activation energy but does not change ΔH.'
  }
  return 'Exam tip: label axes, units, key points, and the shape clearly.'
}
