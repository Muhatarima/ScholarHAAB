import { retrieveTheory, type TheoryRetrieval } from '@/lib/rag/retrieveTheory'
import type { QuestionAnalysis } from '@/lib/paper-solver/questionAnalyzer'

const LOCAL_THEORY: Array<{ test: (analysis: QuestionAnalysis) => boolean; theory: TheoryRetrieval }> = [
  {
    test: (analysis) => analysis.concepts.includes('resistance') && analysis.concepts.includes('temperature'),
    theory: {
      subject: 'Physics',
      chapter: 'Electricity',
      topic: 'Resistance in Metals',
      shortExplanation: 'In a metal, higher temperature makes lattice ions vibrate more, so electrons collide more often and resistance increases.',
      detailedExplanation: 'Metals contain free electrons moving through a lattice of positive ions. Heating the wire makes the ions vibrate more. The electrons collide with the vibrating ions more often, so charge flow is opposed more strongly.',
      examKeywords: ['lattice ions vibrate more', 'electrons collide more often', 'resistance increases'],
      misconceptions: ['Do not say electrons slow down without explaining collisions.'],
      source: 'local_knowledge',
    },
  },
  {
    test: (analysis) => analysis.concepts.includes('cracking'),
    theory: {
      subject: 'Chemistry',
      chapter: 'Organic Chemistry',
      topic: 'Cracking',
      shortExplanation: 'Cracking breaks long-chain hydrocarbons into shorter alkanes and alkenes, which are more useful and in higher demand.',
      detailedExplanation: 'Long-chain hydrocarbons are less useful. Cracking produces shorter-chain fuels and alkenes. Shorter fuels are easier to use, and alkenes can be made into polymers.',
      examKeywords: ['long-chain hydrocarbons', 'shorter chains', 'alkenes', 'polymers', 'higher demand'],
      misconceptions: ['Do not forget alkenes; they are a key reason cracking is useful.'],
      source: 'local_knowledge',
    },
  },
]

export async function retrieveSolverTheory(analysis: QuestionAnalysis): Promise<TheoryRetrieval[]> {
  const topic = analysis.topic ?? analysis.chapter ?? analysis.concepts[0] ?? analysis.normalizedQuestion
  const [bankTheory, localTheory] = await Promise.all([
    retrieveTheory(analysis.normalizedQuestion, analysis.subject ?? 'General', topic),
    Promise.resolve(LOCAL_THEORY.filter((entry) => entry.test(analysis)).map((entry) => entry.theory)),
  ])

  return [...localTheory, ...bankTheory].slice(0, 6)
}
