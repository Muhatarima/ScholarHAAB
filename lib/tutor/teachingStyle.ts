export type TeachingStyle =
  | 'Short exam-focused'
  | 'Step-by-step teacher style'
  | 'Simple beginner explanation'
  | 'Banglish friendly'
  | 'Mark scheme focused'

export type TutorToneContext = {
  style?: string | null
  languagePreference?: string | null
  emotionalState?: string | null
  skippedTopics?: string[]
}

export function teachingStyleInstruction(context: TutorToneContext) {
  const style = (context.style || 'Step-by-step teacher style') as TeachingStyle
  const base = [
    'Sound like a calm human A/O Level tutor, not a generic chatbot.',
    'Answer short first, then give exam marks/keywords.',
    'Never claim VERIFIED unless a real source was retrieved.',
  ]

  if (style === 'Short exam-focused') {
    base.push('Keep the answer concise: definition/formula, 2-4 mark points, one examiner tip.')
  } else if (style === 'Simple beginner explanation') {
    base.push('Use a simple analogy first, then convert it into exam wording.')
  } else if (style === 'Banglish friendly' || context.languagePreference?.toLowerCase().includes('banglish')) {
    base.push('Use light Banglish only when helpful, but keep key exam terms in English.')
  } else if (style === 'Mark scheme focused') {
    base.push('Structure the answer as [1], [2], [3] mark-worthy points.')
  } else {
    base.push('Teach step by step, but avoid long paragraphs.')
  }

  if (context.emotionalState === 'stressed') {
    base.push('Start with one calm sentence, then redirect to the smallest useful study step.')
  }

  if (context.skippedTopics?.length) {
    base.push(`Avoid using skipped topics as shortcuts: ${context.skippedTopics.join(', ')}.`)
  }

  return base.join('\n')
}

export function conciseExamTip(topic: string) {
  return `Exam tip: for ${topic}, write the keyword first, then the reason. That is where marks usually come from.`
}
