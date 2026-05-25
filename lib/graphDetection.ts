export type GraphIntent =
  | { kind: 'function'; title: string; functions: string[]; showArea?: boolean; areaRange?: [number, number] }
  | { kind: 'physics'; title: string; type: 'distance-time' | 'velocity-time' | 'force-extension' | 'wave' | 'electric-field' | 'projectile' | 'shm' }
  | { kind: 'chemistry'; title: string; type: 'energy-profile' | 'rate' | 'titration' | 'ph' | 'maxwell-boltzmann' | 'concentration-time' }
  | { kind: 'statistics'; title: string; type: 'normal' | 'histogram' | 'box' | 'scatter' | 'probability-tree' | 'cumulative-frequency' }
  | { kind: 'physics-gallery'; title: string }

const FUNCTION_PATTERN = /\b(?:plot|sketch|graph)\s+(?:the\s+)?(?:graph\s+of\s+)?(?:y\s*=\s*)?([A-Za-z0-9π+\-*/^().\s]+?)(?=$|[,.!?;\n])/i
const EQUATION_PATTERN = /\by\s*=\s*([A-Za-z0-9π+\-*/^().\s]+?)(?=$|[,.!?;\n])/i

export function detectGraphIntents(text: string): GraphIntent[] {
  const lower = text.toLowerCase()
  const intents: GraphIntent[] = []

  if (/show me all graph types.*a level physics|all common graph types.*physics|physics graph gallery/i.test(text)) {
    intents.push({ kind: 'physics-gallery', title: 'A Level Physics graph gallery' })
    return intents
  }

  const functionMatch = text.match(FUNCTION_PATTERN) ?? text.match(EQUATION_PATTERN)
  if (functionMatch && /(plot|sketch|graph|y\s*=)/i.test(text)) {
    const expression = cleanFunction(functionMatch[1])
    if (expression) {
      intents.push({
        kind: 'function',
        title: `Graph of y = ${expression}`,
        functions: [expression],
        showArea: /area under|integrat|∫/i.test(text),
        areaRange: parseAreaRange(text) ?? [0, 3],
      })
    }
  }

  if (/integration area|area under.*y\s*=\s*x\^?2|∫.*x[²^]2/i.test(text)) {
    intents.push({ kind: 'function', title: 'Area under y = x²', functions: ['x^2'], showArea: true, areaRange: [0, 3] })
  }

  if (/velocity[- ]time|v[- ]t graph/i.test(lower)) {
    intents.push({ kind: 'physics', title: 'Velocity-time graph', type: 'velocity-time' })
  } else if (/distance[- ]time|displacement[- ]time/i.test(lower)) {
    intents.push({ kind: 'physics', title: 'Distance-time graph', type: 'distance-time' })
  } else if (/force[- ]extension|hooke/i.test(lower)) {
    intents.push({ kind: 'physics', title: 'Force-extension graph', type: 'force-extension' })
  } else if (/wave motion|wavelength|amplitude|sine wave/i.test(lower)) {
    intents.push({ kind: 'physics', title: 'Wave diagram with λ and A', type: 'wave' })
  } else if (/projectile/i.test(lower)) {
    intents.push({ kind: 'physics', title: 'Projectile motion path', type: 'projectile' })
  } else if (/simple harmonic|s\.h\.m|shm/i.test(lower)) {
    intents.push({ kind: 'physics', title: 'Simple harmonic motion', type: 'shm' })
  } else if (/electric field lines|field lines/i.test(lower)) {
    intents.push({ kind: 'physics', title: 'Electric field lines', type: 'electric-field' })
  }

  if (/energy profile|activation energy|enthalpy|catalyst/i.test(lower)) {
    intents.push({ kind: 'chemistry', title: 'Energy profile with Ea and ΔH', type: 'energy-profile' })
  } else if (/titration|equivalence point/i.test(lower)) {
    intents.push({ kind: 'chemistry', title: 'Titration curve', type: 'titration' })
  } else if (/maxwell|boltzmann/i.test(lower)) {
    intents.push({ kind: 'chemistry', title: 'Maxwell-Boltzmann distribution', type: 'maxwell-boltzmann' })
  } else if (/rate of reaction|reaction rate/i.test(lower)) {
    intents.push({ kind: 'chemistry', title: 'Rate of reaction graph', type: 'rate' })
  } else if (/concentration.*time|concentration-time/i.test(lower)) {
    intents.push({ kind: 'chemistry', title: 'Concentration-time graph', type: 'concentration-time' })
  }

  if (/normal distribution|bell curve|z-score/i.test(lower)) {
    intents.push({ kind: 'statistics', title: 'Normal distribution curve', type: 'normal' })
  } else if (/histogram/i.test(lower)) {
    intents.push({ kind: 'statistics', title: 'Histogram', type: 'histogram' })
  } else if (/box plot|box-and-whisker/i.test(lower)) {
    intents.push({ kind: 'statistics', title: 'Box plot', type: 'box' })
  } else if (/scatter|regression/i.test(lower)) {
    intents.push({ kind: 'statistics', title: 'Scatter graph with regression line', type: 'scatter' })
  } else if (/probability tree/i.test(lower)) {
    intents.push({ kind: 'statistics', title: 'Probability tree', type: 'probability-tree' })
  } else if (/cumulative frequency/i.test(lower)) {
    intents.push({ kind: 'statistics', title: 'Cumulative frequency curve', type: 'cumulative-frequency' })
  }

  const unique = new Map<string, GraphIntent>()
  for (const intent of intents) {
    unique.set(`${intent.kind}-${intent.title}`, intent)
  }
  return [...unique.values()].slice(0, 3)
}

function cleanFunction(value: string) {
  return value
    .replace(/\bfrom\s+.*$/i, '')
    .replace(/\bfor\s+.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseAreaRange(text: string): [number, number] | null {
  const match = text.match(/from\s+(-?\d+(?:\.\d+)?)\s+to\s+(-?\d+(?:\.\d+)?)/i)
  if (!match) {
    return null
  }
  return [Number(match[1]), Number(match[2])]
}

export const graphDetectionTestCases = [
  { input: 'plot the graph of y = x^2', kind: 'function' },
  { input: 'sketch y = sin(x)', kind: 'function' },
  { input: 'velocity-time graph with area shaded', kind: 'physics', type: 'velocity-time' },
  { input: 'wave motion showing wavelength and amplitude', kind: 'physics', type: 'wave' },
  { input: 'energy profile with activation energy and enthalpy', kind: 'chemistry', type: 'energy-profile' },
  { input: 'normal distribution with z-score', kind: 'statistics', type: 'normal' },
  { input: 'Show me all graph types for A Level Physics', kind: 'physics-gallery' },
]
