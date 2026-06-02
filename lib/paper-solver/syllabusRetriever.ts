import { retrieveSpecification, type SpecificationRetrieval } from '@/lib/rag/retrieveSpecification'
import type { QuestionAnalysis } from '@/lib/paper-solver/questionAnalyzer'

export async function retrieveSyllabusObjectives(
  analysis: QuestionAnalysis,
  profile: { board?: string; level?: string }
): Promise<SpecificationRetrieval[]> {
  return retrieveSpecification({
    board: analysis.board ?? profile.board,
    level: analysis.level ?? profile.level,
    subject: analysis.subject ?? undefined,
    topic: analysis.topic ?? analysis.chapter ?? analysis.concepts[0] ?? undefined,
  })
}
