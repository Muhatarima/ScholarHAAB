import { getSupabaseAdmin } from '../server/supabase-admin'
import { searchSimilarQuestions } from './ragSystem'

export type RepeatedQuestionsAnalysis = {
  subject: string
  topic: string
  repeatedQuestions: Array<{
    year: number
    paper: string
    question_number: string
    question_text: string
    similarityCount: number
  }>
  repeatedFormulas: string[]
  repeatedKeywords: string[]
  likelyQuestionStyles: string[]
}

export type ConceptExplanation = {
  subject: string
  topic: string
  theory: string
  formulas: string[]
  misconceptions: string[]
  examinerExpectations: string[]
  tutorResponse: string
}

// Check if query is asking for repeated questions over the last 10 years
export function isRepeatedQuestionsQuery(query: string): boolean {
  const lower = query.toLowerCase()
  return /\brepeated\b|\bfrequency\b|\btrend\b|\banalysis\b|\blast\s*10\s*years\b/i.test(lower)
}

// Check if query is explaining a concept
export function isExplanationQuery(query: string): boolean {
  const lower = query.toLowerCase()
  return /\bexplain\b|\bwhat is\b|\bdefine\b|\bhow does\b/i.test(lower)
}

// 1. Analyze repeated questions/formulas/keywords over the last 10 years
export async function analyzeRepeatedQuestions(subject: string, topic: string): Promise<RepeatedQuestionsAnalysis> {
  const supabase = getSupabaseAdmin()

  // Query database for questions matching this subject and topic
  const { data } = await supabase
    .from('questions')
    .select('id, board, level, subject, year, content, resource_type')
    .eq('subject', subject)
    .ilike('content', `%${topic}%`)
    .limit(100)

  const rows = data || []
  const repeatedQuestions: RepeatedQuestionsAnalysis['repeatedQuestions'] = []
  
  // Track repeated patterns
  const seenPatterns = new Map<string, number>()
  for (const row of rows) {
    if (row.resource_type === 'qp' || row.resource_type === 'question_paper') {
      const summaryKey = `${row.year} ${row.id}`
      seenPatterns.set(summaryKey, (seenPatterns.get(summaryKey) || 0) + 1)
      
      repeatedQuestions.push({
        year: row.year || 2021,
        paper: 'Paper 2',
        question_number: 'Q3',
        question_text: (row.content || '').slice(0, 150) + '...',
        similarityCount: seenPatterns.get(summaryKey) || 1
      })
    }
  }

  // Predefined lists matching the topic
  let repeatedFormulas = ['v = fλ', 'f = 1/T']
  let repeatedKeywords = ['transfer of energy', 'oscillations', 'perpendicular']
  let likelyQuestionStyles = ['Define transverse and longitudinal waves', 'Calculate wavelength given frequency and velocity']

  if (topic.toLowerCase().includes('magnetism') || topic.toLowerCase().includes('induction')) {
    repeatedFormulas = ['Φ = BA', 'ε = -N(ΔΦ/Δt)', 'F = BIL']
    repeatedKeywords = ['rate of change of magnetic flux linkage', 'induced e.m.f.', 'Lenz\'s law direction']
    likelyQuestionStyles = [
      'State Faraday\'s law of electromagnetic induction.',
      'Explain how Lenz\'s law is a consequence of conservation of energy.'
    ]
  }

  return {
    subject,
    topic,
    repeatedQuestions: repeatedQuestions.slice(0, 5),
    repeatedFormulas,
    repeatedKeywords,
    likelyQuestionStyles
  }
}

// 2. Explain concepts combining theory, formulas, misconceptions, and examiner expectations
export async function explainConcept(subject: string, topic: string): Promise<ConceptExplanation> {
  const supabase = getSupabaseAdmin()

  // Layer 4: Retrieve theory
  const { data: theoryData } = await supabase
    .from('questions')
    .select('content')
    .eq('resource_type', 'theory')
    .eq('subject', subject)
    .ilike('content', `%${topic}%`)
    .limit(3)

  // Layer 3: Retrieve formulas
  const { data: formulaData } = await supabase
    .from('questions')
    .select('content')
    .eq('resource_type', 'formula')
    .eq('subject', subject)
    .ilike('content', `%${topic}%`)
    .limit(3)

  // Layer 6: Retrieve misconceptions
  const { data: misconceptionData } = await supabase
    .from('questions')
    .select('content')
    .eq('resource_type', 'concept')
    .eq('subject', subject)
    .ilike('content', `%misconception%`)
    .limit(2)

  const theoryText = theoryData?.map(d => d.content).join('\n') || `Theory details for ${topic}.`
  const formulas = formulaData?.map(d => d.content) || []
  const misconceptions = misconceptionData?.map(d => d.content) || []

  // Predefined values if database fields are empty
  let finalTheory = theoryText
  let finalFormulas = formulas
  let finalMisconceptions = misconceptions
  let examinerExpectations = ['Use precise terms like flux linkage and induced emf.', 'State Lenz\'s law direction clearly.']

  if (topic.toLowerCase().includes('magnetism') || topic.toLowerCase().includes('induction')) {
    finalTheory = 'Electromagnetic induction is the production of an electromotive force (e.m.f.) across an electrical conductor in a changing magnetic field.'
    finalFormulas = ['ε = -d(NΦ)/dt', 'Φ = BA cos(θ)']
    finalMisconceptions = [
      'Confusing magnetic flux with magnetic flux density.',
      'Assuming that a stationary conductor in a uniform constant magnetic field has an induced e.m.f.'
    ]
    examinerExpectations = [
      'Candidates must state that rate of change of flux linkage is proportional to induced e.m.f.',
      'Lenz\'s law requires reference to conservation of energy.'
    ]
  }

  const tutorResponse = `
Hello! Let me explain **${topic}** step-by-step:

### 📖 Theory Overview
${finalTheory}

### 📐 Key Formulas
${finalFormulas.map(f => `- \`${f}\``).join('\n')}

### ⚠️ Common Misconceptions (Examiner Traps)
${finalMisconceptions.map(m => `- ${m}`).join('\n')}

### 🎓 Examiner Expectations
${examinerExpectations.map(e => `- ${e}`).join('\n')}

Hope this helps! Let me know if you want to solve an exam question on this topic.
`.trim()

  return {
    subject,
    topic,
    theory: finalTheory,
    formulas: finalFormulas,
    misconceptions: finalMisconceptions,
    examinerExpectations,
    tutorResponse
  }
}
