import { GoogleGenerativeAI } from '@google/generative-ai'
import { getGeminiErrorMessage, getGeminiModelCandidates, withGeminiTimeout } from '@/lib/ai/geminiConfig'

export type GeminiTextOptions = {
  maxOutputTokens?: number
  temperature?: number
  timeoutMs?: number
}

function getGeminiKey() {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
  if (!key) {
    throw new Error('Missing GEMINI_API_KEY or GOOGLE_API_KEY')
  }
  return key
}

export async function generateGeminiText(prompt: string, options: GeminiTextOptions = {}) {
  const genAI = new GoogleGenerativeAI(getGeminiKey())
  let lastError: unknown = null

  for (const modelName of getGeminiModelCandidates()) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName })
      const result = await withGeminiTimeout(
        model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: options.maxOutputTokens ?? 700,
            temperature: options.temperature ?? 0.12,
            topK: 20,
            topP: 0.85,
          },
        }),
        options.timeoutMs
      )
      const text = result.response.text().trim()
      if (text) return text
      throw new Error('Gemini returned an empty response')
    } catch (error) {
      lastError = error
      console.error(`Gemini client error (${modelName}):`, getGeminiErrorMessage(error))
    }
  }

  throw new Error(`All Gemini models failed: ${getGeminiErrorMessage(lastError)}`)
}
