import { GoogleGenerativeAI } from '@google/generative-ai'
import { getGeminiModelCandidates, withGeminiTimeout } from '../ai/geminiConfig'

function getGeminiKey() {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
  if (!key || key.startsWith('your_')) {
    throw new Error('Missing GEMINI_API_KEY')
  }
  return key
}

export type OcrResult = {
  extractedText: string
  confidenceScore: number
  hasFormula: boolean
  hasDiagram: boolean
}

export async function runOcr(imageBuffer: Buffer, mimeType: string): Promise<OcrResult> {
  const base64Data = imageBuffer.toString('base64')
  
  const prompt = `
You are a highly precise vision OCR engine specializing in Cambridge and Edexcel A/O Level science, mathematics, and humanities questions.
Your task is to transcribe this academic question image with absolute precision (target: >=95% extraction accuracy).

RULES:
1. Extract ALL text in the image. Do not summarize or explain.
2. Transcribe formulas, equations, subscripts, and superscripts exactly. Use plain Unicode subscripts (e.g. H₂O, CO₂) or standard mathematical notation. Avoid raw complex LaTeX equations unless necessary for clarity.
3. If there is a diagram, chart, or graph:
   - Transcribe all labels, axis scales, text inside the diagram.
   - Describe the diagram briefly in brackets, e.g. [Diagram: showing a right-angled triangle with sides x, 5, and angle theta].
4. Return the result in JSON format with fields:
   - "extractedText": the plain text transcription of the question.
   - "confidenceScore": integer 0-100 reflecting how readable/confident the transcription is.
   - "hasFormula": boolean, if the text contains mathematical or chemical equations.
   - "hasDiagram": boolean, if the image has a diagram, graph, or diagrammatic layout.

Output ONLY the JSON object. Do not wrap in markdown code blocks.
`

  const genAI = new GoogleGenerativeAI(getGeminiKey())
  const candidates = getGeminiModelCandidates()

  for (const modelName of candidates) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName })
      const response = await withGeminiTimeout(
        model.generateContent({
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType,
                    data: base64Data
                  }
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json'
          }
        })
      )

      const rawText = response.response.text().trim()
      const parsed = JSON.parse(rawText) as OcrResult
      return parsed
    } catch (error) {
      console.warn(`OCR failed with model ${modelName}:`, error)
    }
  }

  // Fallback if AI call fails
  return {
    extractedText: 'OCR extraction failed due to service limits.',
    confidenceScore: 0,
    hasFormula: false,
    hasDiagram: false
  }
}
