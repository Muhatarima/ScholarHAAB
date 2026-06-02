export type GraphSpec =
  | {
      type: 'function'
      title: string
      expression: string
      xLabel: string
      yLabel: string
      points: Array<{ x: number; y: number }>
      features: string[]
    }
  | {
      type: 'physics' | 'statistics' | 'economics'
      title: string
      xLabel: string
      yLabel: string
      series: Array<{ name: string; points: Array<{ x: number; y: number }> }>
      features: string[]
    }

function safeEval(expression: string, x: number) {
  const expr = expression
    .replace(/\^/g, '**')
    .replace(/(\d)([a-zA-Z])/g, '$1*$2')
    .replace(/([a-zA-Z])(\d)/g, '$1*$2')
    .replace(/\)([a-zA-Z0-9])/g, ')*$1')
    .replace(/([0-9x])\(/gi, '$1*(')
    .replace(/\bsin\b/gi, 'Math.sin')
    .replace(/\bcos\b/gi, 'Math.cos')
    .replace(/\btan\b/gi, 'Math.tan')
    .replace(/\blog\b/gi, 'Math.log')
    .replace(/\bln\b/gi, 'Math.log')
    .replace(/\be\b/gi, 'Math.E')
  if (!/^[0-9x+\-*/().\sMathsincotagleE]+$/.test(expr)) return Number.NaN
  try {
    return Function('x', `"use strict"; return (${expr})`)(x) as number
  } catch {
    return Number.NaN
  }
}

function sampleFunction(expression: string) {
  const points: Array<{ x: number; y: number }> = []
  for (let i = -80; i <= 80; i += 1) {
    const x = i / 8
    const y = safeEval(expression, x)
    if (Number.isFinite(y) && Math.abs(y) < 1_000) {
      points.push({ x, y: Number(y.toFixed(4)) })
    }
  }
  return points
}

export function generateGraphSpec(input: {
  type?: 'function' | 'physics' | 'statistics' | 'economics'
  expression?: string
  title?: string
}): GraphSpec {
  if (input.type === 'physics') {
    return {
      type: 'physics',
      title: input.title ?? 'Velocity-time graph',
      xLabel: 'time / s',
      yLabel: 'velocity / m s^-1',
      series: [{ name: 'motion', points: [{ x: 0, y: 0 }, { x: 2, y: 6 }, { x: 5, y: 6 }, { x: 7, y: 0 }] }],
      features: ['zoom', 'pan', 'responsive', 'export-ready-svg'],
    }
  }

  if (input.type === 'statistics') {
    return {
      type: 'statistics',
      title: input.title ?? 'Frequency distribution',
      xLabel: 'class interval',
      yLabel: 'frequency',
      series: [{ name: 'frequency', points: [{ x: 1, y: 3 }, { x: 2, y: 8 }, { x: 3, y: 12 }, { x: 4, y: 6 }] }],
      features: ['zoom', 'pan', 'responsive', 'export-ready-svg'],
    }
  }

  if (input.type === 'economics') {
    return {
      type: 'economics',
      title: input.title ?? 'Supply and demand',
      xLabel: 'quantity',
      yLabel: 'price',
      series: [
        { name: 'demand', points: [{ x: 0, y: 10 }, { x: 10, y: 0 }] },
        { name: 'supply', points: [{ x: 0, y: 1 }, { x: 10, y: 9 }] },
      ],
      features: ['zoom', 'pan', 'responsive', 'export-ready-svg'],
    }
  }

  const expression = input.expression ?? 'x^2'
  return {
    type: 'function',
    title: input.title ?? `Graph of y = ${expression}`,
    expression,
    xLabel: 'x',
    yLabel: 'y',
    points: sampleFunction(expression),
    features: ['zoom', 'pan', 'responsive', 'export-ready-svg'],
  }
}
