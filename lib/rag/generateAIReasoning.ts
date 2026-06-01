import { generateGeminiText } from '@/lib/ai/geminiClient'
import { aiReasoningPrompt } from '@/lib/ai/promptTemplates'

export async function generateAIReasoning(question: string) {
  try {
    return await generateGeminiText(aiReasoningPrompt(question), {
      maxOutputTokens: 650,
      temperature: 0.1,
    })
  } catch {
    return [
      'AI REASONING - verify before exam',
      '',
      'No exact past paper match found. This is Cambridge-style AI reasoning. Verify before exam.',
      '',
      'Start by identifying the command word, write the key formula or definition, then show each mark-worthy step clearly.',
    ].join('\n')
  }
}
