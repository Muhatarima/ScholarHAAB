/**
 * ScholarHAAB knowledge trust layers (highest → lowest).
 * Retrieval and reasoning must prefer lower layer numbers before LLM fallback.
 */

export const KNOWLEDGE_LAYERS = {
  1: {
    id: 1,
    name: 'Official exam papers',
    sources: ['papers', 'questions', 'question_chunks'],
    retrievers: ['retrievePastPaper'],
    trust: 'highest',
  },
  2: {
    id: 2,
    name: 'Mark schemes & examiner reports',
    sources: ['mark_schemes', 'examiner_reports'],
    retrievers: ['retrieveMarkScheme'],
    trust: 'highest',
  },
  3: {
    id: 3,
    name: 'Syllabus / specification',
    sources: ['syllabus_topics'],
    retrievers: ['retrieveSyllabus', 'retrieveSpecification'],
    trust: 'high',
  },
  4: {
    id: 4,
    name: 'Formula bank',
    sources: ['formula_bank'],
    retrievers: ['retrieveFormula'],
    trust: 'high',
  },
  5: {
    id: 5,
    name: 'Theory bank',
    sources: ['theory_bank'],
    retrievers: ['retrieveTheory'],
    trust: 'high',
  },
  6: {
    id: 6,
    name: 'Concept graph',
    sources: ['concept_graph', 'concept_bank'],
    retrievers: ['retrieveConceptGraph'],
    trust: 'medium',
  },
  7: {
    id: 7,
    name: 'Misconception database',
    sources: ['misconception_bank'],
    retrievers: ['retrieveMisconceptions'],
    trust: 'medium',
  },
  8: {
    id: 8,
    name: 'Curated public education (HF proxy)',
    sources: ['public_education_chunks', 'paper_patterns'],
    retrievers: ['retrievePublicEducation', 'retrievePatterns'],
    trust: 'low',
  },
  9: {
    id: 9,
    name: 'LLM reasoning',
    sources: [],
    retrievers: ['generateAIReasoning', 'examinerSolver'],
    trust: 'fallback_only',
  },
} as const

export type KnowledgeLayerId = keyof typeof KNOWLEDGE_LAYERS

export const LAYER_ORDER: KnowledgeLayerId[] = [1, 2, 3, 4, 5, 6, 7, 8, 9]

export function layerLabel(layer: KnowledgeLayerId) {
  return KNOWLEDGE_LAYERS[layer].name
}
