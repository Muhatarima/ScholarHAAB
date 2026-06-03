import type { QuestionAnalysis } from '@/lib/paper-solver/questionAnalyzer'
import { retrieveFormulaKnowledge } from '@/lib/knowledge/retrieveFormula'
import { retrieveTheoryKnowledge } from '@/lib/knowledge/retrieveTheory'
import { retrieveSyllabusKnowledge } from '@/lib/knowledge/retrieveSyllabus'
import { retrieveConceptGraph } from '@/lib/knowledge/retrieveConceptGraph'
import { retrieveMisconceptions } from '@/lib/knowledge/retrieveMisconceptions'
import { retrievePublicEducation } from '@/lib/knowledge/retrievePublicEducation'
import type { KnowledgeFilter, KnowledgeRouterResult } from '@/lib/knowledge/types'

function routeFor(analysis: QuestionAnalysis): KnowledgeRouterResult['route'] {
  if (analysis.year || /paper|mark scheme|question/i.test(analysis.normalizedQuestion)) return 'past_paper_first'
  if (/formula|equation|calculate/i.test(analysis.normalizedQuestion) || analysis.formulasNeeded.length) return 'formula_first'
  if (analysis.emotionalState === 'confused' || /bujh|confus|don't understand|pari na/i.test(analysis.normalizedQuestion)) return 'confusion_support'
  if (/explain|define|difference|vs|why|how/i.test(analysis.normalizedQuestion)) return 'theory_first'
  return 'general_support'
}

export async function routeKnowledge(analysis: QuestionAnalysis, profile: { board?: string | null; level?: string | null; subject?: string | null }): Promise<KnowledgeRouterResult> {
  const filter: KnowledgeFilter = {
    board: analysis.board || profile.board || null,
    level: analysis.level || profile.level || null,
    subject: analysis.subject || profile.subject || null,
    topic: analysis.topic || analysis.subtopic || analysis.concepts[0] || analysis.chapter || null,
    query: analysis.normalizedQuestion,
  }
  const route = routeFor(analysis)
  const [formulas, theory, syllabus, concepts, misconceptions, publicEducation] = await Promise.all([
    retrieveFormulaKnowledge(filter),
    retrieveTheoryKnowledge(filter),
    retrieveSyllabusKnowledge(filter),
    retrieveConceptGraph(filter),
    retrieveMisconceptions(filter),
    retrievePublicEducation(filter),
  ])
  const databaseSupport = [...formulas, ...theory, ...syllabus, ...concepts, ...misconceptions, ...publicEducation]
    .some((item) => item.source === 'database')
  const localSupport = [...formulas, ...theory, ...concepts, ...misconceptions].length > 0
  return {
    route,
    formulas,
    theory,
    syllabus,
    concepts,
    misconceptions,
    publicEducation,
    supportLevel: databaseSupport || localSupport ? 'THEORY_SUPPORTED' : 'AI_REASONING',
    notes: databaseSupport
      ? ['Knowledge support found in database-backed academic tables.']
      : localSupport
        ? ['Only local deterministic tutor knowledge was available; not verified dataset coverage.']
        : ['No academic knowledge layer matched; AI reasoning fallback is required.'],
  }
}
