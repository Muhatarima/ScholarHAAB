import { safeSelect, text } from '@/lib/knowledge/db'
import type { KnowledgeFilter, MisconceptionKnowledge } from '@/lib/knowledge/types'

const LOCAL_MISCONCEPTIONS: MisconceptionKnowledge[] = [
  { subject: 'Physics', topic: 'speed and velocity', misconception: 'Speed and velocity mean the same thing.', correction: 'Velocity includes direction; speed does not.', examWarning: 'Mention direction for velocity.', example: null, source: 'local_knowledge' },
  { subject: 'Physics', topic: 'mass and weight', misconception: 'Mass and weight are the same.', correction: 'Mass is amount of matter in kg; weight is gravitational force in N.', examWarning: 'Use W = mg for weight.', example: null, source: 'local_knowledge' },
  { subject: 'Chemistry', topic: 'ionic vs covalent', misconception: 'Covalent bonds transfer electrons.', correction: 'Covalent bonds share pairs of electrons; ionic bonds transfer electrons.', examWarning: 'Use electron language.', example: null, source: 'local_knowledge' },
  { subject: 'Biology', topic: 'diffusion vs osmosis', misconception: 'Osmosis is any particle movement.', correction: 'Osmosis is water movement through a partially permeable membrane.', examWarning: 'Say water molecules.', example: null, source: 'local_knowledge' },
  { subject: 'Accounting', topic: 'asset vs expense', misconception: 'Assets and expenses are both costs.', correction: 'Assets provide future economic benefit; expenses are consumed costs.', examWarning: 'Link asset to future benefit.', example: null, source: 'local_knowledge' },
  { subject: 'Economics', topic: 'demand vs quantity demanded', misconception: 'Demand and quantity demanded are identical.', correction: 'Demand is the whole curve; quantity demanded is one point at a price.', examWarning: 'Mention curve vs point.', example: null, source: 'local_knowledge' },
  { subject: 'English', topic: 'tone vs mood', misconception: 'Tone and mood are the same.', correction: 'Tone is writer attitude; mood is reader feeling/atmosphere.', examWarning: 'Separate writer and reader.', example: null, source: 'local_knowledge' },
]

export async function retrieveMisconceptions(filter: KnowledgeFilter): Promise<MisconceptionKnowledge[]> {
  const topic = filter.topic || filter.query || ''
  const rows = await safeSelect(
    'misconception_bank',
    'subject, topic, misconception, correction, exam_warning, example',
    filter,
    6
  )
  if (rows.length) {
    return rows.map((row) => ({
      subject: text(row.subject, filter.subject || 'General'),
      topic: text(row.topic, topic),
      misconception: text(row.misconception),
      correction: text(row.correction),
      examWarning: row.exam_warning ? text(row.exam_warning) : null,
      example: row.example ? text(row.example) : null,
      source: 'database',
    }))
  }
  const needle = `${filter.subject || ''} ${topic} ${filter.query || ''}`.toLowerCase()
  return LOCAL_MISCONCEPTIONS.filter((item) => needle.includes(item.topic) || item.topic.includes(topic.toLowerCase())).slice(0, 3)
}
