/**
 * Module 6 — Theory Engine (unified facade over theory_bank + local fallback)
 */
import type { QuestionAnalysis } from '@/lib/paper-solver/questionAnalyzer'
import { retrieveTheoryKnowledge } from '@/lib/knowledge/retrieveTheory'
import type { KnowledgeFilter, TheoryKnowledge } from '@/lib/knowledge/types'

export type TheoryEngineResult = {
  items: TheoryKnowledge[]
  topic: string | null
  subject: string | null
  examKeywords: string[]
  misconceptions: string[]
  examinerTips: string[]
}

export async function retrieveTheoryForQuestion(
  analysis: QuestionAnalysis,
  profile?: { board?: string | null; level?: string | null; subject?: string | null }
): Promise<TheoryEngineResult> {
  const filter: KnowledgeFilter = {
    board: analysis.board || profile?.board || null,
    level: analysis.level || profile?.level || null,
    subject: analysis.subject || profile?.subject || null,
    topic: analysis.topic || analysis.chapter || analysis.subtopic || null,
    query: analysis.normalizedQuestion,
  }

  const items = await retrieveTheoryKnowledge(filter)

  const examKeywords = items
    .flatMap((t) => t.examKeywords ?? [])
    .filter(Boolean)

  const misconceptions = items
    .flatMap((t) => t.commonMisconceptions ?? [])
    .filter(Boolean)

  const examinerTips = items
    .map((t) => t.detailedExplanation?.split('.')[0] ?? t.shortExplanation)
    .filter(Boolean) as string[]

  return {
    items,
    topic: filter.topic ?? null,
    subject: filter.subject ?? null,
    examKeywords: Array.from(new Set(examKeywords)).slice(0, 12),
    misconceptions: Array.from(new Set(misconceptions)).slice(0, 8),
    examinerTips: Array.from(new Set(examinerTips)).slice(0, 6),
  }
}