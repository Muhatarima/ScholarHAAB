export type KnowledgeSource = 'database' | 'local_knowledge' | 'none'

export type KnowledgeFilter = {
  board?: string | null
  level?: string | null
  subject?: string | null
  topic?: string | null
  query?: string | null
}

export type FormulaKnowledge = {
  formula: string
  subject: string
  topic: string
  variables: Record<string, unknown>
  units: string | null
  meaning: string
  whenToUse: string | null
  commonMistake: string
  example: string | null
  source: KnowledgeSource
}

export type TheoryKnowledge = {
  subject: string
  chapter: string | null
  topic: string
  shortExplanation: string
  detailedExplanation: string
  examKeywords: string[]
  commonMisconceptions: string[]
  examinerTip: string | null
  source: KnowledgeSource
}

export type SyllabusKnowledge = {
  board: string
  level: string
  subject: string
  chapter: string | null
  topic: string
  learningObjectives: string[]
  specificationRef: string | null
  commandWords: string[]
  source: KnowledgeSource
}

export type ConceptGraphKnowledge = {
  subject: string
  concept: string
  prerequisiteConcepts: string[]
  dependentConcepts: string[]
  relatedTopics: string[]
  difficulty: string | null
  source: KnowledgeSource
}

export type MisconceptionKnowledge = {
  subject: string
  topic: string
  misconception: string
  correction: string
  examWarning: string | null
  example: string | null
  source: KnowledgeSource
}

export type PublicEducationKnowledge = {
  subject: string
  chapter: string | null
  topic: string | null
  content: string
  chunkType: string
  license: string
  source: KnowledgeSource
}

export type KnowledgeRouterResult = {
  route: 'past_paper_first' | 'formula_first' | 'theory_first' | 'confusion_support' | 'general_support'
  formulas: FormulaKnowledge[]
  theory: TheoryKnowledge[]
  syllabus: SyllabusKnowledge[]
  concepts: ConceptGraphKnowledge[]
  misconceptions: MisconceptionKnowledge[]
  publicEducation: PublicEducationKnowledge[]
  supportLevel: 'THEORY_SUPPORTED' | 'AI_REASONING'
  notes: string[]
}
