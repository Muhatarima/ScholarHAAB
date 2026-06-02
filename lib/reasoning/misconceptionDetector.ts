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
    regex: /\bspeed\b.*\bvelocity\b|\bvelocity\b.*\bspeed\b/i,
    alert: 'Common Mistake Alert: speed and velocity are not the same.',
    correction: 'Speed is scalar; velocity includes direction.',
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
    concept: 'Inflation vs price level',
    regex: /\binflation\b.*\bprice level\b|\bprice level\b.*\binflation\b/i,
    alert: 'Common Mistake Alert: inflation is the rate of increase, not simply a high price.',
    correction: 'Inflation means sustained rise in the general price level over time.',
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
