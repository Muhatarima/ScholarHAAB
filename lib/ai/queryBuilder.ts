import type { Intent, Message } from '@/lib/ai/intentEngine'

const TOPIC_EXPANSIONS: Record<string, string> = {
  work: 'work done physics definition W=Fd force distance energy transferred joule',
  photosynthesis: 'photosynthesis biology process equation carbon dioxide water glucose oxygen chlorophyll light',
  forces: 'forces motion physics resultant force Newton laws F=ma acceleration mass weight friction',
  waves: 'waves physics wave speed frequency wavelength v=fλ amplitude transverse longitudinal',
  electricity: 'electricity physics current voltage resistance circuit Ohm law V=IR power',
  bonding: 'chemistry bonding ionic covalent metallic structure properties melting point',
  moles: 'chemistry moles mass Mr amount concentration stoichiometry formula',
  calculus: 'mathematics calculus differentiate integrate gradient rate of change area',
}

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function lastTopic(history: Message[]) {
  const recent = history
    .slice(-3)
    .map((entry) => entry.content)
    .join(' ')
    .toLowerCase()
  for (const topic of Object.keys(TOPIC_EXPANSIONS)) {
    if (recent.includes(topic)) return topic
  }
  const words = recent.match(/\b[a-z]{4,}\b/g) ?? []
  return words.slice(-3).join(' ')
}

function yearFromEntities(entities: string[]) {
  return entities.find((entity) => /^(?:19|20)\d{2}$/.test(entity))
}

function ensureMinimumWords(query: string, intent: Intent) {
  const words = query.split(/\s+/).filter(Boolean)
  if (words.length >= 5) return query
  const subject = intent.subject ?? 'Cambridge'
  const topic = intent.topic ?? intent.entities[0] ?? 'exam topic'
  return `${query} ${subject} ${topic} Cambridge definition formula explanation mark scheme`
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 15)
    .join(' ')
}

export function buildSearchQuery(intent: Intent, history: Message[] = []): string {
  const subject = intent.subject ?? 'Cambridge'
  const topic = intent.topic ?? lastTopic(history) ?? intent.entities[0] ?? 'exam topic'
  const topicExpansion = TOPIC_EXPANSIONS[normalize(topic)] ?? `${topic} ${subject} Cambridge A Level O Level`
  const year = yearFromEntities(intent.entities)

  let query: string
  switch (intent.type) {
    case 'define':
      query = `${topicExpansion} definition meaning key idea`
      break
    case 'formula':
      query = `${topicExpansion} formula equation symbols units`
      break
    case 'solve':
      query = `${topicExpansion} solved example calculation mark scheme method`
      break
    case 'explain':
      query = `${topicExpansion} explanation why how process Cambridge`
      break
    case 'example':
      query = `${topicExpansion} real life example past paper question`
      break
    case 'past_paper':
      query = `${subject} ${year ?? ''} Cambridge question paper ${topic} mark scheme`
      break
    case 'confused':
      query = `${topicExpansion} example analogy simple explanation step by step`
      break
    case 'skip':
    case 'confirm':
      query = `${subject} ${topic} next important topic Cambridge exam`
      break
    case 'test_me':
      query = `${topicExpansion} past paper style question marks`
      break
    case 'check_answer':
      query = `${topicExpansion} mark scheme answer examiner points`
      break
    case 'topic_change':
    case 'follow_up':
    default:
      query = `${topicExpansion} Cambridge explanation formula mark scheme`
      break
  }

  return ensureMinimumWords(query.replace(/\s+/g, ' ').trim(), intent)
}
