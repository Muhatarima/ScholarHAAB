import { searchRag } from '@/lib/ai/ragBridge'

type ConversationEntry = {
  role: 'user' | 'assistant'
  content: string
}

type ChapterCoachKind = 'plan' | 'skip' | 'reteach' | 'example'

type ChapterCoachIntent = {
  kind: ChapterCoachKind
  subject: string
  chapter: string
  topic: string
}

type TopicPlan = {
  title: string
  why: string
  formulas: string[]
  overview: string
  example: string
  markScheme: string[]
}

const FORCES_TOPICS: TopicPlan[] = [
  {
    title: "Resultant force and Newton's laws",
    why: 'Most Forces questions start by checking whether forces are balanced or unbalanced.',
    formulas: ['Resultant force = sum of forces in one direction - sum in opposite direction'],
    overview: 'Balanced force means no change in motion. Unbalanced/resultant force means acceleration in the direction of the resultant force.',
    example: 'A 12 N force acts right and a 7 N friction force acts left. Find the resultant force.',
    markScheme: ['12 - 7 = 5 N', 'Direction stated: to the right'],
  },
  {
    title: 'F = ma calculations',
    why: 'Very frequent because Cambridge can award marks for formula, substitution, answer and unit.',
    formulas: ['F = ma', 'a = F / m', 'm = F / a'],
    overview: 'Use this when a mass accelerates because of a resultant force. Resultant force is the force you put into F = ma.',
    example: 'A 4.0 kg trolley has a resultant force of 10 N. Calculate its acceleration.',
    markScheme: ['States F = ma', 'a = 10 / 4.0', 'a = 2.5 m/s^2'],
  },
  {
    title: 'Weight and gravitational field strength',
    why: 'Often appears as a quick calculation or as the difference between mass and weight.',
    formulas: ['W = mg'],
    overview: 'Mass is amount of matter in kg. Weight is a force caused by gravity, measured in N.',
    example: 'Calculate the weight of a 6.0 kg object where g = 10 N/kg.',
    markScheme: ['W = mg', 'W = 6.0 x 10', 'W = 60 N'],
  },
  {
    title: 'Friction, drag and terminal velocity',
    why: 'Common explanation topic: students lose marks if they only say speed changes without explaining resultant force.',
    formulas: ['At terminal velocity: upward forces = downward forces', 'Resultant force = 0'],
    overview: 'As speed increases, drag increases. Terminal velocity happens when drag/air resistance balances weight, so acceleration becomes zero.',
    example: 'Explain why a falling object reaches terminal velocity.',
    markScheme: ['Weight initially greater than air resistance', 'Object accelerates so air resistance increases', 'Forces become balanced', 'Resultant force is zero so speed becomes constant'],
  },
  {
    title: 'Moments and equilibrium',
    why: 'High-yield structured questions often ask for turning effect or balance conditions.',
    formulas: ['Moment = force x perpendicular distance from pivot', 'Clockwise moments = anticlockwise moments at equilibrium'],
    overview: 'A moment is the turning effect of a force. Use perpendicular distance from the pivot, not the length of the object unless it is perpendicular.',
    example: 'A 20 N force acts 0.30 m from a pivot. Calculate the moment.',
    markScheme: ['Moment = force x distance', 'Moment = 20 x 0.30', 'Moment = 6.0 N m'],
  },
  {
    title: 'Momentum and impulse',
    why: 'Usually appears in harder Forces questions and rewards clear formula use.',
    formulas: ['p = mv', 'Impulse = FΔt = change in momentum'],
    overview: 'Momentum depends on mass and velocity. In collisions, total momentum is conserved if no external resultant force acts.',
    example: 'A 0.50 kg ball moves at 8.0 m/s. Calculate its momentum.',
    markScheme: ['p = mv', 'p = 0.50 x 8.0', 'p = 4.0 kg m/s'],
  },
  {
    title: 'Pressure from force',
    why: 'Often linked with everyday explanations such as sharp knives, snow shoes and pressure on surfaces.',
    formulas: ['Pressure = force / area'],
    overview: 'For the same force, smaller area gives larger pressure. For the same area, larger force gives larger pressure.',
    example: 'A force of 120 N acts on an area of 0.030 m^2. Calculate the pressure.',
    markScheme: ['P = F / A', 'P = 120 / 0.030', 'P = 4000 Pa'],
  },
]

function normalize(text: string) {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

function isForcesChapter(text: string) {
  const q = normalize(text)
  return /\bforces?\b/.test(q) || /chapter\s*5/.test(q)
}

function detectSubject(text: string) {
  const q = normalize(text)
  if (/\bphysics\b|force|forces|newton|momentum|acceleration|friction/.test(q)) return 'Physics'
  return 'Physics'
}

function lastCoachTopic(history: ConversationEntry[]) {
  const recent = [...history].reverse().find((entry) => entry.role === 'assistant' && /Current topic:/.test(entry.content))
  const match = recent?.content.match(/Current topic:\s*([^\n]+)/i)
  return match?.[1]?.trim()
}

function topicIndexFromHistory(history: ConversationEntry[]) {
  const current = lastCoachTopic(history)
  if (!current) return 0
  const index = FORCES_TOPICS.findIndex((topic) => topic.title.toLowerCase() === current.toLowerCase())
  return index >= 0 ? index : 0
}

export function detectChapterCoachIntent(message: string, history: ConversationEntry[] = []): ChapterCoachIntent | null {
  const q = normalize(message)
  const hadCoachContext = history.some((entry) => /Chapter 5 Forces|Current topic:|High-yield order/i.test(entry.content))

  if (/\b(skip|next|porer|pore|bad dao|bad)\b/.test(q) && hadCoachContext) {
    return { kind: 'skip', subject: 'Physics', chapter: 'Chapter 5', topic: 'Forces' }
  }

  if (/(bujhini|bujhi nai|bujhlam na|understand.*nai|didn.?t understand|confused|arek bhabe|different method)/i.test(q) && hadCoachContext) {
    return { kind: 'reteach', subject: 'Physics', chapter: 'Chapter 5', topic: 'Forces' }
  }

  if (/(example dao|question dao|past paper|example|practice question|proshno)/i.test(q) && hadCoachContext) {
    return { kind: 'example', subject: 'Physics', chapter: 'Chapter 5', topic: 'Forces' }
  }

  const examSoon = /(kal|tomorrow|ajke|tonight|exam|porikkha)/i.test(q)
  if (examSoon && isForcesChapter(q)) {
    return { kind: 'plan', subject: detectSubject(q), chapter: 'Chapter 5', topic: 'Forces' }
  }

  return null
}

function formatFormulaSheet(topics: TopicPlan[]) {
  return Array.from(new Set(topics.flatMap((topic) => topic.formulas)))
    .slice(0, 10)
    .map((formula) => `- ${formula}`)
    .join('\n')
}

function formatTopic(topic: TopicPlan, index: number) {
  return [
    `Current topic: ${topic.title}`,
    `Why important: ${topic.why}`,
    '',
    'Quick concept:',
    topic.overview,
    '',
    'Key formula(s):',
    ...topic.formulas.map((formula) => `- ${formula}`),
    '',
    'Say `skip` to move next, `bujhini` for another explanation, or `example dao` for a past-paper-style question.',
    `Progress: topic ${index + 1}/${FORCES_TOPICS.length}`,
  ].join('\n')
}

function buildPlanAnswer() {
  const ranked = FORCES_TOPICS.map((topic, index) => `${index + 1}. ${topic.title} - ${topic.why}`).join('\n')
  return [
    '**Confidence:** 🧠 EXPERT',
    '**Source:** Cambridge Forces past-paper pattern + ScholarHAAB topic intelligence',
    '',
    'Kal exam hole Forces er jonno fast plan eta:',
    '',
    '**High-yield order:**',
    ranked,
    '',
    '**Formula Sheet:**',
    formatFormulaSheet(FORCES_TOPICS),
    '',
    '**Start here:**',
    formatTopic(FORCES_TOPICS[0], 0),
  ].join('\n')
}

function buildReteachAnswer(topic: TopicPlan) {
  return [
    '**Confidence:** 🧠 EXPERT',
    '**Source:** Cambridge expert reasoning',
    '',
    `Current topic: ${topic.title}`,
    '',
    'Different method e boli:',
    `Think of it like this: ${topic.overview}`,
    '',
    'Exam wording:',
    topic.why,
    '',
    'Tiny example:',
    topic.example,
    '',
    '**Mark Scheme:**',
    ...topic.markScheme.map((point) => `- ${point}`),
    '',
    '**Examiner Tip:** Ek line e reason dile hobe na; force, motion, and result link korte hobe.',
  ].join('\n')
}

async function buildExampleAnswer(topic: TopicPlan) {
  const rag = await searchRag(`${topic.title} Cambridge Physics Forces past paper question`, 'Physics', 'O Level', 3)
  const match = rag.chunks.find((chunk) => chunk.similarity >= 0.5)
  const sourceLine = match?.metadata?.source || 'Cambridge-style past paper pattern'
  const retrieved = match ? `\nClosest retrieved context:\n${match.text.slice(0, 500)}` : ''

  return [
    '**Confidence:** 🔶 PARTIAL',
    `**Source:** ${sourceLine}`,
    '',
    `Current topic: ${topic.title}`,
    '',
    '**Past-paper-style question:**',
    topic.example,
    '',
    '**Mark Scheme:**',
    ...topic.markScheme.map((point) => `- ${point}`),
    '',
    '**How to score full marks:**',
    'Write the formula first, substitute values clearly, then include the final unit.',
    retrieved,
  ].join('\n')
}

export async function buildChapterCoachAnswer(message: string, history: ConversationEntry[] = []) {
  const intent = detectChapterCoachIntent(message, history)
  if (!intent) return null

  const currentIndex = topicIndexFromHistory(history)
  const nextIndex = intent.kind === 'skip' ? Math.min(currentIndex + 1, FORCES_TOPICS.length - 1) : currentIndex
  const topic = FORCES_TOPICS[nextIndex]

  if (intent.kind === 'plan') return buildPlanAnswer()
  if (intent.kind === 'skip') {
    return [
      '**Confidence:** 🧠 EXPERT',
      '**Source:** Cambridge Forces topic priority',
      '',
      `Skip korlam. Next high-yield topic:`,
      '',
      formatTopic(topic, nextIndex),
    ].join('\n')
  }
  if (intent.kind === 'reteach') return buildReteachAnswer(topic)
  return buildExampleAnswer(topic)
}
