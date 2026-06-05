export type Misconception = {
  subject: string
  concept: string
  alert: string
  correction: string
}

const MISCONCEPTIONS: Array<{ subject: string; concept: string; regex: RegExp; alert: string; correction: string }> = [
  {
    subject: 'Physics',
    concept: 'Speed vs velocity',
    regex: /\bspeed\b.*\bvelocity\b|\bvelocity\b.*\bspeed\b|\bspeed is a vector\b/i,
    alert: 'Common Mistake Alert: speed and velocity are not the same.',
    correction: 'Speed is scalar; velocity includes direction.',
  },
  {
    subject: 'Physics',
    concept: 'Current vs voltage',
    regex: /\bcurrent\b.*\bvoltage\b|\bvoltage\b.*\bcurrent\b|\bcurrent is the push\b/i,
    alert: 'Common Mistake Alert: current and voltage are being confused.',
    correction: 'Voltage (p.d.) drives current; current is rate of flow of charge (I = Q/t).',
  },
  {
    subject: 'Physics',
    concept: 'Wave transfer',
    regex: /\bwave\b.*\bmatter\b|\bparticles move with the wave\b/i,
    alert: 'Common Mistake Alert: waves transfer energy, not matter.',
    correction: 'Particles oscillate around fixed positions while energy travels.',
  },
  {
    subject: 'Chemistry',
    concept: 'Ionic vs covalent bonding',
    regex: /\bionic\b.*\bshare|\bcovalent\b.*\btransfer/i,
    alert: 'Common Mistake Alert: ionic and covalent bonding are being mixed.',
    correction: 'Ionic bonding transfers electrons; covalent bonding shares electron pairs.',
  },
  {
    subject: 'Chemistry',
    concept: 'Oxidation vs reduction',
    regex: /\boxidation\b.*\bgain.*electron|\breduction\b.*\blose.*electron|\boxidation is gain\b/i,
    alert: 'Common Mistake Alert: OIL RIG — oxidation is loss of electrons.',
    correction: 'Oxidation = loss of electrons; reduction = gain of electrons.',
  },
  {
    subject: 'Mathematics',
    concept: 'Chain rule',
    regex: /\bchain rule\b|\bdifferentiate\b.*\((?:[^)]*)\)\^/i,
    alert: 'Common Mistake Alert: do not forget to multiply by the derivative of the inside function.',
    correction: 'For y = f(g(x)), dy/dx = f′(g(x))g′(x).',
  },
  {
    subject: 'Biology',
    concept: 'Diffusion vs osmosis',
    regex: /\bdiffusion\b.*\bosmosis\b|\bosmosis\b.*\bdiffusion\b/i,
    alert: 'Common Mistake Alert: osmosis is a special case of diffusion.',
    correction: 'Osmosis is water movement through a partially permeable membrane.',
  },
  {
    subject: 'Economics',
    concept: 'Demand vs quantity demanded',
    regex: /\bdemand\b.*\bquantity demanded\b|\bshift.*demand curve.*price\b/i,
    alert: 'Common Mistake Alert: a price change causes movement along demand, not a shift.',
    correction: 'Demand shifts from non-price factors; quantity demanded changes with price.',
  },
  {
    subject: 'Economics',
    concept: 'Inflation vs price level',
    regex: /\binflation\b.*\bprice level\b|\bprice level\b.*\binflation\b/i,
    alert: 'Common Mistake Alert: inflation is the rate of increase, not simply a high price.',
    correction: 'Inflation means sustained rise in the general price level over time.',
  },
  {
    subject: 'Accounting',
    concept: 'Asset vs expense',
    regex: /\bexpense\b.*\basset\b|\basset\b.*\bexpense\b|\bcapital expenditure.*revenue expenditure\b/i,
    alert: 'Common Mistake Alert: assets and expenses affect the accounts differently.',
    correction: 'Assets bring future benefit; expenses are costs of the current period.',
  },
  {
    subject: 'English',
    concept: 'Tone vs mood',
    regex: /\btone\b.*\bmood\b|\bmood\b.*\btone\b|\bauthor.?s tone is sad\b/i,
    alert: 'Common Mistake Alert: tone and mood are not interchangeable.',
    correction: 'Tone is the writer\'s attitude; mood is the atmosphere felt by the reader.',
  },
]

export function detectMisconceptions(question: string, subject?: string | null): Misconception[] {
  return MISCONCEPTIONS
    .filter((item) => (!subject || item.subject.toLowerCase() === subject.toLowerCase()) && item.regex.test(question))
    .map(({ subject: itemSubject, concept, alert, correction }) => ({
      subject: itemSubject,
      concept,
      alert,
      correction,
    }))
}

export function misconceptionCoverage() {
  return MISCONCEPTIONS.map((item) => `${item.subject}: ${item.concept}`)
}
