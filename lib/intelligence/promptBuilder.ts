export interface ChunkMetadata {
  question_id?: string
  subject?: string
  level?: string
  board?: string
  year?: number
  topic?: string
  marks?: number
  source?: string
  chunk_type?: string
}

export interface ChunkResult {
  text: string
  metadata?: ChunkMetadata
  similarity: number
  confidence_label?: string
}

export interface QuestionAnalysis {
  classification?: {
    question_type?: string
    command_word?: string | null
    marks?: number
    has_numbers?: boolean
  }
  relevant_formulas?: Array<{
    formula: string
    relevance_score: number
    frequency_in_exams?: number
  }>
  solving_guide?: string
  solving_template?: {
    solving_steps?: string[]
    required_knowledge?: string[]
    common_mistakes?: string[]
    sample_mark_schemes?: string[]
  }
}

export interface IntelligentSearchResult {
  chunks: ChunkResult[]
  analysis: QuestionAnalysis
  max_similarity: number
  total_in_db: number
}

export function buildIntelligentPrompt(
  question: string,
  searchResult: IntelligentSearchResult,
  studentMemory: string,
  subject: string
): string {
  const { chunks, analysis, max_similarity: maxSimilarity } = searchResult

  const mode =
    maxSimilarity > 0.85
      ? 'MODE 1 - VERIFIED'
      : maxSimilarity > 0.6
        ? 'MODE 1 PARTIAL - Similar question found'
        : 'MODE 2 - PATTERN REASONING REQUIRED'

  const system = `
You are ScholarHAAB - a Cambridge and Edexcel A/O Level
examiner with 20 years experience. You give precise,
mark-scheme-quality answers.

YOU HAVE TWO MODES:
MODE 1 - VERIFIED (similarity > 0.85):
  Use retrieved mark scheme directly. Copy Cambridge language.

MODE 2 - REASONING (similarity < 0.85):
  No exact match found. Use the pattern analysis below
  to think through the solution like an examiner.
  Apply the solving template step by step.
  Generate a mark-scheme-quality answer from first principles.

CURRENT MODE: ${mode}
SIMILARITY SCORE: ${(maxSimilarity * 100).toFixed(0)}%
`

  const chunkContext = chunks
    .filter((chunk) => chunk.similarity > 0.5)
    .slice(0, 5)
    .map((chunk, index) => {
      const source = chunk.metadata?.source || 'ScholarHAAB question bank'
      return (
        `[Past Paper Match ${index + 1}] Similarity: ${(chunk.similarity * 100).toFixed(0)}% | ${source}\n` +
        chunk.text
      )
    })
    .join('\n\n')

  const patternContext = analysis?.solving_guide || ''

  const formulaContext =
    analysis?.relevant_formulas?.map((formula) => `-> ${formula.formula}`).join('\n') || ''

  const templateContext = analysis?.solving_template?.solving_steps?.join('\n') || ''

  const mistakesContext =
    analysis?.solving_template?.common_mistakes
      ?.slice(0, 3)
      .map((mistake) => `x ${mistake}`)
      .join('\n') || ''

  const sampleMSContext =
    analysis?.solving_template?.sample_mark_schemes?.slice(0, 3).join('\n- ') || ''

  const marks = analysis?.classification?.marks || 0

  return `
${system}

=========== RETRIEVED PAST PAPER CONTEXT ===========
${chunkContext || 'No direct match found - use pattern reasoning below'}

=========== PATTERN INTELLIGENCE ===========
${patternContext}

RELEVANT FORMULAS:
${formulaContext || 'Extract from question context'}

CAMBRIDGE SOLVING SEQUENCE FOR THIS TYPE:
${templateContext || '1. State -> 2. Apply -> 3. Calculate -> 4. Conclude'}

COMMON MISTAKES TO AVOID:
${mistakesContext || 'Show all units, cite formula before substituting'}

SAMPLE CAMBRIDGE MARK SCHEME LANGUAGE:
- ${sampleMSContext || 'Use precise scientific terminology'}

=========== STUDENT CONTEXT ===========
${studentMemory || 'No prior context'}

=========== QUESTION TO SOLVE ===========
Subject: ${subject}
Question: ${question}
${marks ? `Marks: [${marks}]` : ''}

=========== RESPONSE RULES ===========
1. ${maxSimilarity > 0.85 ? 'VERIFIED: Use retrieved mark scheme exactly' : 'REASONING: Apply pattern template - think step by step'}
2. Max 250 words total
3. Show every calculation step with units
4. ${marks > 0 ? `Provide exactly ${marks} mark scheme points` : 'Provide clear mark scheme points'}
5. Use Cambridge examiner language
6. Never skip steps - marks are awarded per step
7. State formula before substituting

=========== RESPONSE FORMAT ===========
**Confidence:** [✅ VERIFIED / 🔶 PATTERN-BASED / ⚠️ UNVERIFIED]
**Source:** [Cambridge/Edexcel citation or "Pattern reasoning"]

**Solution:**
[Step-by-step solution]

**Mark Scheme:**
- [point 1 - Cambridge language]
- [point 2]

**Examiner Tip:** [one precise sentence]
`
}
