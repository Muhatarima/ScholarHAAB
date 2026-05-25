export type SyllabusTopic = {
  subject: string
  topics: string[]
}

export const SYLLABUS_TOPICS: Record<string, string[]> = {
  physics: [
    'Measurements',
    'Kinematics',
    'Dynamics',
    'Forces',
    'Energy',
    'Momentum',
    'Circular motion',
    'Gravitational fields',
    'Thermal physics',
    'Waves',
    'Superposition',
    'Electricity',
    'Electric fields',
    'Magnetism',
    'Nuclear physics',
    'Quantum physics',
  ],
  mathematics: [
    'Algebra',
    'Functions',
    'Coordinate geometry',
    'Trigonometry',
    'Differentiation',
    'Integration',
    'Integration by parts',
    'Vectors',
    'Sequences and series',
    'Probability',
    'Statistics',
    'Mechanics',
  ],
  maths: [
    'Algebra',
    'Functions',
    'Coordinate geometry',
    'Trigonometry',
    'Differentiation',
    'Integration',
    'Integration by parts',
    'Vectors',
    'Sequences and series',
    'Probability',
    'Statistics',
    'Mechanics',
  ],
  chemistry: [
    'Atomic structure',
    'Chemical bonding',
    'Moles',
    'Energetics',
    'Kinetics',
    'Equilibria',
    'Acids and bases',
    'Redox',
    'Periodicity',
    'Organic chemistry',
    'Analytical chemistry',
    'Transition metals',
  ],
  biology: [
    'Cell structure',
    'Biological molecules',
    'Enzymes',
    'Transport in plants',
    'Transport in mammals',
    'Gas exchange',
    'Immunity',
    'Homeostasis',
    'Inheritance',
    'Evolution',
    'Ecology',
    'Genetic technology',
  ],
  economics: [
    'Demand and supply',
    'Elasticity',
    'Market failure',
    'Government intervention',
    'Macroeconomic indicators',
    'Inflation',
    'Unemployment',
    'Exchange rates',
    'International trade',
  ],
}

export const PREREQUISITES: Record<string, string[]> = {
  'integration': ['Differentiation', 'Algebra'],
  'integration by parts': ['Integration', 'Differentiation', 'Algebra'],
  'projectile motion': ['Kinematics', 'Vectors', 'Trigonometry'],
  'circular motion': ['Forces', 'Dynamics'],
  'electric fields': ['Forces', 'Electricity'],
  'superposition': ['Waves'],
  'standing waves': ['Waves', 'Superposition'],
  'organic chemistry': ['Chemical bonding', 'Moles'],
  'equilibria': ['Moles', 'Kinetics'],
  'osmosis': ['Cell structure', 'Transport across membranes'],
}

export function normalizeTopic(value: string | null | undefined) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeSubject(value: string | null | undefined) {
  const normalized = normalizeTopic(value)
  if (normalized === 'math' || normalized === 'maths') {
    return 'mathematics'
  }
  return normalized
}

export function getSyllabusTopics(subject: string | null | undefined) {
  const normalized = normalizeSubject(subject)
  return SYLLABUS_TOPICS[normalized] ?? []
}

export function getPrerequisites(topic: string | null | undefined) {
  return PREREQUISITES[normalizeTopic(topic)] ?? []
}

export function inferSubjectFromText(text: string) {
  const normalized = normalizeTopic(text)
  if (/\b(force|wave|velocity|current|voltage|momentum|projectile|field)\b/.test(normalized)) {
    return 'Physics'
  }
  if (/\b(integrat|differentiat|trig|vector|probability|statistics|function|algebra)\b/.test(normalized)) {
    return 'Mathematics'
  }
  if (/\b(mole|acid|base|organic|reaction|enthalpy|equilibrium|bond)\b/.test(normalized)) {
    return 'Chemistry'
  }
  if (/\b(osmosis|cell|enzyme|photosynthesis|respiration|genetic)\b/.test(normalized)) {
    return 'Biology'
  }
  return null
}

export function inferTopicFromText(text: string) {
  const normalized = normalizeTopic(text)
  const candidates = Array.from(
    new Set(Object.values(SYLLABUS_TOPICS).flat().concat(Object.keys(PREREQUISITES)))
  )
  return (
    candidates.find((topic) => normalized.includes(normalizeTopic(topic))) ??
    normalized
      .split(' ')
      .filter((word) => word.length > 3)
      .slice(0, 3)
      .join(' ') ??
    'General'
  )
}
