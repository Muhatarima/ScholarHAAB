export type KnowledgeContext = {
  formula?: string
  meaning?: string
  units?: string
  theory: string
  examKeywords: string[]
  commonMistake: string
  pattern: string
}

const KNOWLEDGE: Record<string, KnowledgeContext> = {
  waves: {
    formula: 'v = f x wavelength',
    meaning: 'wave speed equals frequency multiplied by wavelength',
    units: 'v in m/s, f in Hz, wavelength in m',
    theory: 'A wave transfers energy without transferring matter overall.',
    examKeywords: ['energy transfer', 'oscillation', 'frequency', 'wavelength', 'amplitude'],
    commonMistake: 'Mixing up amplitude with wavelength.',
    pattern: 'Calculation plus explanation of wave terms.',
  },
  'wave motion': {
    formula: 'v = f x wavelength',
    meaning: 'wave speed equals frequency multiplied by wavelength',
    units: 'v in m/s, f in Hz, wavelength in m',
    theory: 'Particles oscillate about fixed positions while energy travels through the medium.',
    examKeywords: ['oscillation', 'energy transfer', 'wavelength', 'frequency', 'amplitude'],
    commonMistake: 'Saying matter travels with the wave.',
    pattern: 'Define terms, calculate wave speed, explain energy transfer.',
  },
  forces: {
    formula: 'F = ma',
    meaning: 'resultant force equals mass times acceleration',
    units: 'F in N, m in kg, a in m/s^2',
    theory: 'A resultant force changes motion by causing acceleration.',
    examKeywords: ['resultant force', 'mass', 'acceleration', 'newton'],
    commonMistake: 'Using weight instead of mass in F = ma.',
    pattern: 'Formula, substitution, final answer with units.',
  },
  bonding: {
    theory: 'Bonding makes atoms more stable by transfer or sharing of outer-shell electrons.',
    examKeywords: ['outer shell', 'electron transfer', 'shared pair', 'electrostatic attraction'],
    commonMistake: 'Forgetting to mention attraction between opposite charges in ionic bonding.',
    pattern: 'Describe particles first, then electron movement, then attraction.',
  },
  'chemical bonding': {
    theory: 'Ionic bonding transfers electrons; covalent bonding shares pairs of electrons.',
    examKeywords: ['ions', 'shared pair', 'electron transfer', 'full outer shell'],
    commonMistake: 'Saying covalent bonds transfer electrons.',
    pattern: 'Compare ionic and covalent bonding with electron language.',
  },
  photosynthesis: {
    formula: '6CO2 + 6H2O -> C6H12O6 + 6O2',
    meaning: 'carbon dioxide and water make glucose and oxygen using light energy',
    theory: 'Chlorophyll absorbs light energy for photosynthesis in chloroplasts.',
    examKeywords: ['chlorophyll', 'chloroplast', 'light energy', 'glucose', 'oxygen'],
    commonMistake: 'Leaving out light or chlorophyll in explanations.',
    pattern: 'Word equation, balanced symbol equation, limiting factors.',
  },
  integration: {
    theory: 'Integration reverses differentiation and finds an accumulated quantity such as area.',
    examKeywords: ['constant of integration', 'limits', 'area under curve', 'reverse differentiation'],
    commonMistake: 'Forgetting + C in indefinite integration.',
    pattern: 'Increase the power by 1, divide by the new power, add constant if needed.',
  },
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

export function getKnowledgeContext(subject: string, topic: string): KnowledgeContext {
  const normalized = normalizeKey(topic || subject)
  const direct = KNOWLEDGE[normalized]
  if (direct) return direct

  const match = Object.entries(KNOWLEDGE).find(([key]) => normalized.includes(key) || key.includes(normalized))
  if (match) return match[1]

  return {
    theory: `Know the definition, one example, and the mark-scheme keywords for ${topic || subject}.`,
    examKeywords: ['definition', 'method', 'evidence', 'conclusion'],
    commonMistake: 'Writing a general explanation without exam keywords.',
    pattern: 'Short definition, method point, application point, exam keyword.',
  }
}

export function formatKnowledgeContext(subject: string, topic: string) {
  const context = getKnowledgeContext(subject, topic)
  return [
    `Theory: ${context.theory}`,
    context.formula ? `Formula: ${context.formula}` : null,
    context.meaning ? `Meaning: ${context.meaning}` : null,
    context.units ? `Units: ${context.units}` : null,
    `Exam keywords: ${context.examKeywords.join(', ')}`,
    `Common mistake: ${context.commonMistake}`,
    `Pattern: ${context.pattern}`,
  ].filter(Boolean).join('\n')
}
