import { searchSimilarQuestions, type QuestionSearchFilters } from '@/lib/rag/ragSystem'

export async function retrievePastPaper(
  query: string,
  filters: QuestionSearchFilters = {},
  limit = 5
) {
  return searchSimilarQuestions(query, filters, limit)
}
