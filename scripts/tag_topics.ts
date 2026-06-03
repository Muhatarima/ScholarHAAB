import { analyzeQuestion } from '../lib/paper-solver/questionAnalyzer'
import { ensureDatasetDirs, jsonlPath, readJsonl, writeJsonl } from './dataset_common'

type ExtractedQuestion = {
  text: string
  subject: string
  marks: number | null
  [key: string]: unknown
}

async function main() {
  ensureDatasetDirs()
  const questions = readJsonl<ExtractedQuestion>(jsonlPath('extracted_text/questions.jsonl'))
  const tagged = questions.map((question) => {
    const analysis = analyzeQuestion(question.text)
    const confidence = analysis.topic || analysis.concepts.length ? 82 : 45
    return {
      ...question,
      topic: analysis.topic ?? analysis.chapter ?? analysis.concepts[0] ?? null,
      chapter: analysis.chapter,
      subtopic: analysis.subtopic,
      command_word: analysis.commandWord,
      question_type: analysis.questionType,
      difficulty: analysis.difficulty,
      formulas_needed: analysis.formulasNeeded,
      tag_confidence: confidence,
      needs_review: confidence < 75,
    }
  })

  writeJsonl(jsonlPath('processed/tagged_questions.jsonl'), tagged)
  console.log(JSON.stringify({
    tagged: tagged.length,
    needsReview: tagged.filter((item) => item.needs_review).length,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
