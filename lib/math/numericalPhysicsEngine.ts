export type NumericalPhysicsResult = {
  kind:
    | 'maximum_height'
    | 'acceleration_force_energy'
    | 'kinetic_energy'
    | 'force'
    | 'work_done'
    | 'ohms_law'
    | 'momentum'
  topic: string
  formulaPath: string[]
  working: string[]
  markAllocation: string[]
  finalAnswer: string
  numericValue: number
  unit: string
  latex?: string
  significantFigures?: number
}

function normalizeQuestion(raw: string) {
  return raw
    .toLowerCase()
    .replace(/×/g, '*')
    .replace(/−/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

function numberBeforeUnit(text: string, unitPattern: string) {
  const match = new RegExp(`(-?\\d+(?:\\.\\d+)?)\\s*${unitPattern}`, 'i').exec(text)
  return match ? Number(match[1]) : null
}

function firstNumberAfter(text: string, marker: RegExp) {
  const index = text.search(marker)
  if (index < 0) return null
  const match = /(-?\d+(?:\.\d+)?)/.exec(text.slice(index))
  return match ? Number(match[1]) : null
}

function roundForExam(value: number, digits = 3) {
  return Number(value.toPrecision(digits))
}

function formatNumber(value: number, digits = 3) {
  const rounded = roundForExam(value, digits)
  return Number.isInteger(rounded) ? String(rounded) : String(rounded)
}

export function isLikelyNumericalPhysicsQuestion(raw: string) {
  const q = normalizeQuestion(raw)
  return /\b(physics|ball|thrown|projectile|velocity|speed|acceleration|force|mass|kinetic energy|momentum|work done|ohm|resistance|current|voltage)\b/.test(q) &&
    /\d/.test(q)
}

export function solveNumericalPhysics(raw: string): NumericalPhysicsResult | null {
  const q = normalizeQuestion(raw)
  if (!isLikelyNumericalPhysicsQuestion(q)) return null

  const mass = numberBeforeUnit(q, '(?:kg|kilogram|kilograms)\\b')
  const time = numberBeforeUnit(q, '(?:s|sec|second|seconds)\\b')
  const velocity = numberBeforeUnit(q, '(?:m\\s*/\\s*s|m\\s*s\\^-1|ms\\^-1|mps)\\b')
  const force = numberBeforeUnit(q, '(?:n|newton|newtons)\\b')
  const distance = numberBeforeUnit(q, '(?:m|metre|meter|metres|meters)\\b')
  const current = numberBeforeUnit(q, '(?:a|amp|amps|ampere|amperes)\\b')
  const voltage = numberBeforeUnit(q, '(?:v|volt|volts)\\b')
  const resistance = numberBeforeUnit(q, '(?:ohm|ohms|Ω)\\b')

  if (/\b(maximum height|highest point|max height)\b/.test(q) && /\b(thrown|projectile|upwards|upward)\b/.test(q)) {
    const u = velocity ?? firstNumberAfter(q, /thrown|speed|velocity/)
    if (u !== null) {
      const g = 9.8
      const height = u ** 2 / (2 * g)
      return {
        kind: 'maximum_height',
        topic: 'Projectile motion',
        formulaPath: ['At maximum height v = 0', 'Use v^2 = u^2 + 2as', 'Rearrange: s = u^2 / 2g'],
        working: [
          `u = ${u} m/s, v = 0, a = -9.8 m/s^2`,
          `0 = ${u}^2 - 2(9.8)s`,
          `s = ${u ** 2} / 19.6 = ${height.toFixed(4)} m`,
        ],
        markAllocation: ['formula v^2 = u^2 + 2as [1]', 'substitution with signs [1]', 'height calculated [1]', 'unit m [1]'],
        finalAnswer: `${formatNumber(height)} m`,
        numericValue: height,
        unit: 'm',
        latex: `s=\\frac{${u}^{2}}{2\\times 9.8}=${formatNumber(height)}\\text{ m}`,
      }
    }
  }

  if (/\baccelerat|from rest|kinetic energy|friction\b/.test(q) && mass !== null && velocity !== null && time !== null) {
    const acceleration = velocity / time
    const netForce = mass * acceleration
    const kineticEnergy = 0.5 * mass * velocity ** 2
    return {
      kind: 'acceleration_force_energy',
      topic: 'Forces and motion',
      formulaPath: ['a = (v - u) / t', 'F = ma', 'E_k = 1/2 mv^2'],
      working: [
        `a = (${velocity} - 0) / ${time} = ${formatNumber(acceleration)} m/s^2`,
        `F = ${mass} * ${formatNumber(acceleration)} = ${formatNumber(netForce)} N`,
        `E_k = 1/2 * ${mass} * ${velocity}^2 = ${formatNumber(kineticEnergy)} J`,
      ],
      markAllocation: ['acceleration formula [1]', 'force formula [1]', 'kinetic energy formula [1]', 'correct units [1]'],
      finalAnswer: `a = ${formatNumber(acceleration)} m/s^2; F = ${formatNumber(netForce)} N; E_k = ${formatNumber(kineticEnergy)} J`,
      numericValue: kineticEnergy,
      unit: 'J',
      latex: `a=${formatNumber(acceleration)}\\text{ m s}^{-2},\\ F=${formatNumber(netForce)}\\text{ N},\\ E_k=${formatNumber(kineticEnergy)}\\text{ J}`,
    }
  }

  if (/\bkinetic energy|ke\b/.test(q) && mass !== null && velocity !== null) {
    const kineticEnergy = 0.5 * mass * velocity ** 2
    return {
      kind: 'kinetic_energy',
      topic: 'Energy',
      formulaPath: ['E_k = 1/2 mv^2'],
      working: [`E_k = 1/2 * ${mass} * ${velocity}^2 = ${formatNumber(kineticEnergy)} J`],
      markAllocation: ['formula [1]', 'substitution [1]', 'answer [1]', 'unit J [1]'],
      finalAnswer: `${formatNumber(kineticEnergy)} J`,
      numericValue: kineticEnergy,
      unit: 'J',
      latex: `E_k=\\frac{1}{2}mv^2=${formatNumber(kineticEnergy)}\\text{ J}`,
    }
  }

  if (/\b(force|newtons?)\b/.test(q) && mass !== null) {
    const acceleration = numberBeforeUnit(q, '(?:m\\s*/\\s*s\\^2|m\\s*s\\^-2|m/s2|m/s\\^2)\\b') ?? firstNumberAfter(q, /acceleration/)
    if (acceleration !== null) {
      const result = mass * acceleration
      return {
        kind: 'force',
        topic: 'Forces',
        formulaPath: ['F = ma'],
        working: [`F = ${mass} * ${acceleration} = ${formatNumber(result)} N`],
        markAllocation: ['formula F = ma [1]', 'substitution [1]', 'answer [1]', 'unit N [1]'],
        finalAnswer: `${formatNumber(result)} N`,
        numericValue: result,
        unit: 'N',
        latex: `F=ma=${formatNumber(result)}\\text{ N}`,
      }
    }
  }

  if (/\bwork done|energy transferred\b/.test(q) && force !== null && distance !== null) {
    const result = force * distance
    return {
      kind: 'work_done',
      topic: 'Work and energy',
      formulaPath: ['W = Fd'],
      working: [`W = ${force} * ${distance} = ${formatNumber(result)} J`],
      markAllocation: ['formula W = Fd [1]', 'substitution [1]', 'answer [1]', 'unit J [1]'],
      finalAnswer: `${formatNumber(result)} J`,
      numericValue: result,
      unit: 'J',
      latex: `W=Fd=${formatNumber(result)}\\text{ J}`,
    }
  }

  if (/\b(ohm|resistance|current|voltage)\b/.test(q)) {
    if (voltage !== null && current !== null && /\bresistance|ohm/.test(q)) {
      const result = voltage / current
      return {
        kind: 'ohms_law',
        topic: 'Electricity',
        formulaPath: ['V = IR', 'R = V / I'],
        working: [`R = ${voltage} / ${current} = ${formatNumber(result)} ohm`],
        markAllocation: ['Ohm law formula [1]', 'rearrangement [1]', 'answer [1]', 'unit ohm [1]'],
        finalAnswer: `${formatNumber(result)} ohm`,
        numericValue: result,
        unit: 'ohm',
        latex: `R=\\frac{V}{I}=${formatNumber(result)}\\ \\Omega`,
      }
    }
    if (current !== null && resistance !== null) {
      const result = current * resistance
      return {
        kind: 'ohms_law',
        topic: 'Electricity',
        formulaPath: ['V = IR'],
        working: [`V = ${current} * ${resistance} = ${formatNumber(result)} V`],
        markAllocation: ['Ohm law formula [1]', 'substitution [1]', 'answer [1]', 'unit V [1]'],
        finalAnswer: `${formatNumber(result)} V`,
        numericValue: result,
        unit: 'V',
        latex: `V=IR=${formatNumber(result)}\\text{ V}`,
      }
    }
  }

  if (/\bmomentum\b/.test(q) && mass !== null && velocity !== null) {
    const result = mass * velocity
    return {
      kind: 'momentum',
      topic: 'Momentum',
      formulaPath: ['p = mv'],
      working: [`p = ${mass} * ${velocity} = ${formatNumber(result)} kg m/s`],
      markAllocation: ['formula p = mv [1]', 'substitution [1]', 'answer [1]', 'unit kg m/s [1]'],
      finalAnswer: `${formatNumber(result)} kg m/s`,
      numericValue: result,
      unit: 'kg m/s',
      latex: `p=mv=${formatNumber(result)}\\text{ kg m s}^{-1}`,
    }
  }

  return null
}
