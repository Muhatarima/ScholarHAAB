import { list, safeSelect, text } from '@/lib/knowledge/db'
import type { ConceptGraphKnowledge, KnowledgeFilter } from '@/lib/knowledge/types'

const LOCAL_PREREQS: Record<string, string[]> = {
  'differential equations': ['integration', 'differentiation'],
  calculus: ['algebra', 'functions'],
  bonding: ['atomic structure', 'electron shells'],
  waves: ['frequency', 'wavelength'],
}

export async function retrieveConceptGraph(filter: KnowledgeFilter): Promise<ConceptGraphKnowledge[]> {
  const topic = filter.topic || filter.query || ''
  const rows = await safeSelect(
    'concept_graph',
    'subject, concept, prerequisite_concepts, dependent_concepts, related_topics, difficulty',
    { ...filter, topic: null },
    8
  )
  const matches = rows.filter((row) => {
    const concept = text(row.concept).toLowerCase()
    return !topic || concept.includes(topic.toLowerCase()) || topic.toLowerCase().includes(concept)
  })
  if (matches.length) {
    return matches.map((row) => ({
      subject: text(row.subject, filter.subject || 'General'),
      concept: text(row.concept, topic),
      prerequisiteConcepts: list(row.prerequisite_concepts),
      dependentConcepts: list(row.dependent_concepts),
      relatedTopics: list(row.related_topics),
      difficulty: row.difficulty ? text(row.difficulty) : null,
      source: 'database',
    }))
  }
  const key = Object.keys(LOCAL_PREREQS).find((item) => topic.toLowerCase().includes(item) || item.includes(topic.toLowerCase()))
  if (!key) return []
  return [{
    subject: filter.subject || 'General',
    concept: key,
    prerequisiteConcepts: LOCAL_PREREQS[key],
    dependentConcepts: [],
    relatedTopics: [topic],
    difficulty: 'core',
    source: 'local_knowledge',
  }]
}
