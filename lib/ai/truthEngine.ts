import { CAMBRIDGE_MASTER_PROMPT } from '@/lib/ai/adaptiveEngine'
import {
  detectBoard,
  getBoardContext,
  type Board,
} from '@/lib/boards/boardConfig'

// --- Types --------------------------------------------------

export type ConfidenceLevel =
  | 'VERIFIED'
  | 'PARTIAL'
  | 'REASONING'
  | 'EXPERT'

export interface RagChunk {
  text: string
  similarity: number
  metadata?: {
    source?: string
    subject?: string
    year?: number
    topic?: string
    marks?: number
    chunk_type?: string
    board?: string
  }
}

export interface TruthEngineInput {
  question: string
  subject: string
  level?: string
  ragChunks: RagChunk[]
  maxSimilarity: number
  studentMemory: string
  marks?: number
}

export interface TruthEngineOutput {
  prompt: string
  confidenceLevel: ConfidenceLevel
  confidenceBadge: '✅' | '🔶' | '⚠️' | '🧠'
  mode: string
  contextUsed: boolean
}

export type VerifiedContext = {
  context: string
  similarity: number
  sources: string[]
  docs: RagChunk[]
  lowConfidence: boolean
  bestSimilarity: number
  contextText: string
}

export type TruthValidationResult = {
  valid: boolean
  issues: string[]
  confidence: ConfidenceLevel
  confidenceScore: number
  source: string
  answer: string
}

// --- Confidence Classifier ----------------------------------

export function classifyConfidence(
  maxSimilarity: number,
  ragAvailable: boolean
): { level: ConfidenceLevel; badge: '✅' | '🔶' | '⚠️' | '🧠'; mode: string } {
  if (!ragAvailable) {
    return {
      level: 'EXPERT',
      badge: '🧠',
      mode: 'Cambridge expert reasoning - no database available',
    }
  }
  if (maxSimilarity >= 0.8) {
    return {
      level: 'VERIFIED',
      badge: '✅',
      mode: 'Direct mark scheme match found',
    }
  }
  if (maxSimilarity >= 0.5) {
    return {
      level: 'PARTIAL',
      badge: '🔶',
      mode: 'Similar question found - answer adapted',
    }
  }
  return {
    level: 'REASONING',
    badge: '⚠️',
    mode: 'No direct match - Cambridge expert reasoning applied',
  }
}

// --- Context Builder ----------------------------------------

function buildRagContext(chunks: RagChunk[]): string {
  if (!chunks || chunks.length === 0) {
    return ''
  }

  const relevant = chunks
    .filter((chunk) => chunk.similarity > 0.45)
    .slice(0, 5)

  if (relevant.length === 0) return ''

  return relevant
    .map((chunk, index) => {
      const source = chunk.metadata?.source || 'Cambridge Past Paper'
      const similarity = Math.round(chunk.similarity * 100)
      return `[Match ${index + 1} - ${similarity}% similarity | ${source}]\n${chunk.text}`
    })
    .join('\n\n')
}

// --- Master Prompt Builder ----------------------------------

export function buildTruthPrompt(input: TruthEngineInput): TruthEngineOutput {
  const {
    question,
    subject,
    level,
    ragChunks,
    maxSimilarity,
    studentMemory,
    marks,
  } = input

  const ragAvailable = ragChunks && ragChunks.length > 0
  const confidence = classifyConfidence(maxSimilarity, ragAvailable)
  const ragContext = buildRagContext(ragChunks)
  const detectedBoard: Board = detectBoard(
    `${question} ${ragChunks[0]?.metadata?.source || ''} ${ragChunks[0]?.metadata?.board || ''}`
  )
  const boardContext = getBoardContext(detectedBoard)
  const boardInstructions =
    detectedBoard === 'edexcel'
      ? `Edexcel mark scheme uses:
     B marks = correct answer/accuracy
     M marks = correct method shown
     A marks = answer following correct method
     Give B, M, A breakdown where possible.`
      : detectedBoard === 'cambridge'
        ? `Cambridge mark scheme uses:
     Allow/Accept for alternative correct answers
     Reject for common misconceptions
     OFW (own figure working) for carried errors`
        : `Use Cambridge and Edexcel conventions:
     Cambridge: allow/accept/reject and OFW carried-error marks
     Edexcel: B marks for accuracy, M marks for method, A marks for final answer
     If the student names a board, follow that board exactly.`

  const modeInstructions: Record<ConfidenceLevel, string> = {
    VERIFIED: `
VERIFIED MODE - High confidence match found (${Math.round(maxSimilarity * 100)}%).
INSTRUCTION: Use the retrieved mark scheme directly.
Copy Cambridge marking language exactly when it applies.
Do not paraphrase mark scheme points unnecessarily.
`,
    PARTIAL: `
PARTIAL MODE - Similar question found (${Math.round(maxSimilarity * 100)}% match).
INSTRUCTION: Adapt the similar question's approach carefully.
Keep the same solving structure but adjust for this specific question.
Note the adaptation clearly.
`,
    REASONING: `
REASONING MODE - No direct match found (${Math.round(maxSimilarity * 100)}% best match).
INSTRUCTION: You are a Cambridge examiner with 20 years experience.
Reason through this question from your Cambridge expertise.
Apply standard Cambridge marking principles.
Generate a mark-scheme-quality answer from first principles.
DO NOT say "not found" or "no match" - SOLVE IT.
`,
    EXPERT: `
EXPERT MODE - Database unavailable.
INSTRUCTION: You are a Cambridge examiner with 20 years experience.
Answer from your deep Cambridge and Edexcel expertise.
Apply exact Cambridge marking principles and language.
Generate mark-scheme-quality answer.
DO NOT mention database issues to the student.
`,
  }

  const subjectGuidance: Record<string, string> = {
    Physics: `
Physics solving rules:
1. State formula before substituting
2. Show every substitution step
3. Include units at every step
4. Final answer: value + unit + correct sig figs
5. For explain questions: cause -> mechanism -> effect
`,
    Mathematics: `
Mathematics solving rules:
1. State the method/theorem being used
2. Show every algebraic step
3. No steps skipped - marks awarded per step
4. Check answer by substitution where possible
5. State final answer clearly
`,
    Chemistry: `
Chemistry solving rules:
1. For calculations: n=m/M before anything else
2. For explain: structure/bonding -> property -> reason
3. Use exact IUPAC names
4. State conditions for reactions
5. Ionic equations where appropriate
`,
    Biology: `
Biology solving rules:
1. Use precise biological terminology
2. Link structure to function explicitly
3. For processes: sequence each step
4. Include magnification for microscopy
5. Quantify where possible
`,
  }

  const guidance = subjectGuidance[subject] || `
Solving rules:
1. State relevant principle/formula first
2. Show every step clearly
3. Use subject-specific terminology
4. Check units and significant figures
`

  const marksNote = marks
    ? `\nMARKS: [${marks}] - provide exactly ${marks} mark scheme points`
    : ''

  const prompt = `
${CAMBRIDGE_MASTER_PROMPT}

=======================================
CONFIDENCE: ${confidence.badge} ${confidence.level}
MODE: ${confidence.mode}${marksNote}
=======================================

${modeInstructions[confidence.level]}

${ragContext ? `=== RETRIEVED CAMBRIDGE/EDEXCEL CONTEXT ===\n${ragContext}\n` : ''}

=== BOARD CONTEXT ===
${boardContext}
${boardInstructions}

=== SUBJECT SOLVING GUIDE ===
${guidance}

=== STUDENT CONTEXT ===
${studentMemory || 'No prior context available.'}

=== QUESTION ===
Subject: ${subject}${level ? ` | Level: ${level}` : ''}
${question}

=== RESPONSE FORMAT ===
Start with a natural reaction, not a label.
Mention confidence casually in the first paragraph, for example:
"This one's straight from Cambridge past papers ✅"
or "Heads up - this is my best Cambridge reasoning ⚠️".

Then give:
1. The direct answer or hint first.
2. Step-by-step working in a friendly voice.
3. Cambridge marks this as: concise mark points.
4. Exam tip: one precise, exam-relevant sentence.
`.trim()

  return {
    prompt,
    confidenceLevel: confidence.level,
    confidenceBadge: confidence.badge,
    mode: confidence.mode,
    contextUsed: ragContext.length > 0,
  }
}

// --- Response Validator -------------------------------------

export function validateTruthResponse(response: string): {
  valid: boolean
  issues: string[]
} {
  const issues: string[] = []

  if (!response || response.trim().length < 30) {
    issues.push('Response too short')
  }

  const hasConfidence =
    response.includes('✅') ||
    response.includes('🔶') ||
    response.includes('⚠️') ||
    response.includes('🧠')

  if (!hasConfidence) {
    issues.push('Missing confidence badge')
  }

  const didntMatch =
    /did(?:\s+not|n't)\s+match|no\s+match|not\s+found\s+in|cannot\s+find/i.test(
      response
    )

  if (didntMatch) {
    issues.push(
      'Response incorrectly says no match - should reason instead'
    )
  }

  return { valid: issues.length === 0, issues }
}

// --- Backward-compatible helpers used by existing QBank routes

export function validateAnswer(response: string): {
  valid: boolean
  issues: string[]
} {
  return validateTruthResponse(response)
}

export async function retrieveVerifiedContext(
  question: string,
  subject?: string | null,
  topic?: string | null
): Promise<VerifiedContext> {
  const { searchRag } = await import('@/lib/ai/ragBridge')
  const result = await searchRag(question, subject ?? undefined, undefined, 7)
  const topicFiltered = topic
    ? result.chunks.filter((chunk) => !chunk.metadata?.topic || chunk.metadata.topic === topic)
    : result.chunks
  const chunks = topicFiltered.length > 0 ? topicFiltered : result.chunks
  const context = buildRagContext(chunks)
  const sources = chunks
    .map((chunk) => chunk.metadata?.source)
    .filter((source): source is string => Boolean(source))

  return {
    context: context || 'Cambridge expert reasoning available.',
    similarity: result.maxSimilarity,
    sources,
    docs: chunks,
    lowConfidence: result.maxSimilarity < 0.8,
    bestSimilarity: result.maxSimilarity,
    contextText: context,
  }
}

export async function validateAIResponse(
  answer: string,
  verifiedContext: VerifiedContext,
  question: string,
  studentId?: string | null
): Promise<TruthValidationResult> {
  void studentId
  const validation = validateTruthResponse(answer)
  const confidence = classifyConfidence(verifiedContext.bestSimilarity, verifiedContext.docs.length > 0)

  if (validation.valid) {
    return {
      valid: true,
      issues: [],
      confidence: confidence.level,
      confidenceScore: Math.round(verifiedContext.bestSimilarity * 100),
      source: verifiedContext.sources[0] ?? confidence.mode,
      answer,
    }
  }

  const repaired = [
    `${confidence.badge} ${confidence.level} - ${verifiedContext.sources[0] ?? 'Cambridge expert reasoning'}`,
    '',
    'Let me solve this using Cambridge examiner reasoning.',
    question,
    '',
    verifiedContext.contextText ? `Relevant context:\n${verifiedContext.contextText}` : '',
    '',
    'Cambridge marks this as:',
    '- Correct principle or formula stated',
    '- Correct application to the question',
    '- Final answer stated clearly with units where needed',
    '',
    'Exam tip: Retrieval uncertainty is not an answer; apply the Cambridge method and solve directly.',
  ]
    .filter(Boolean)
    .join('\n')

  return {
    valid: false,
    issues: validation.issues,
    confidence: confidence.level,
    confidenceScore: Math.round(verifiedContext.bestSimilarity * 100),
    source: verifiedContext.sources[0] ?? 'Cambridge expert reasoning',
    answer: repaired,
  }
}
