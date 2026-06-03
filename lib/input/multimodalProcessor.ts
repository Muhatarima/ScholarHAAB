import { parseImageMetadata } from '@/lib/input/imageParser'
import { parsePdf } from '@/lib/input/pdfParser'
import { runOcr, type OcrResult } from '@/lib/input/ocrEngine'
import { extractQuestionDetails, type ExtractedQuestion } from '@/lib/input/questionExtractor'

export type MultimodalInputKind =
  | 'text'
  | 'image'
  | 'screenshot'
  | 'scanned_paper'
  | 'pdf'
  | 'mark_scheme'
  | 'paper_code'
  | 'topic_name'

export type ProcessedMultimodalInput = {
  kind: MultimodalInputKind
  rawText: string
  extracted: ExtractedQuestion
  ocr: OcrResult | null
  warnings: string[]
  ocrAccuracyEstimate: number | null
}

const OCR_ACCURACY_TARGET = 95

function detectInputKind(
  text: string,
  mimeType?: string,
  fileName?: string
): MultimodalInputKind {
  const lower = `${text} ${fileName ?? ''}`.toLowerCase()
  if (mimeType?.startsWith('image/')) {
    if (/screenshot|screen.?shot|snip/i.test(lower)) return 'screenshot'
    if (/scan|scanned|photo/i.test(lower)) return 'scanned_paper'
    return 'image'
  }
  if (mimeType === 'application/pdf' || /\.pdf$/i.test(fileName ?? '')) return 'pdf'
  if (/\bmark\s*scheme\b|\bms\b.*\bpoint/i.test(text)) return 'mark_scheme'
  if (/\b\d{4}\/\d{2}\//.test(text)) return 'paper_code'
  if (text.length < 120 && /\b(chapter|topic|unit)\s+\d/i.test(text)) return 'topic_name'
  if (text.length < 80 && !text.includes('?')) return 'topic_name'
  return 'text'
}

export async function processTextInput(rawText: string): Promise<ProcessedMultimodalInput> {
  const extracted = extractQuestionDetails(rawText)
  const kind = detectInputKind(rawText)
  return {
    kind,
    rawText,
    extracted,
    ocr: null,
    warnings: [],
    ocrAccuracyEstimate: null,
  }
}

export async function processImageBuffer(input: {
  buffer: Buffer
  mimeType: string
  fileName: string
}): Promise<ProcessedMultimodalInput> {
  const base64 = input.buffer.toString('base64')
  const meta = parseImageMetadata(input.fileName, input.mimeType, base64)
  const ocr = await runOcr(input.buffer, input.mimeType || 'image/png')
  const warnings: string[] = []

  if (meta.isBlurry) {
    warnings.push('Image may be blurry or low resolution; OCR confidence may be reduced.')
  }
  if (ocr.confidenceScore < OCR_ACCURACY_TARGET) {
    warnings.push(
      `OCR confidence ${ocr.confidenceScore}% is below target ${OCR_ACCURACY_TARGET}%.`
    )
  }

  const rawText = ocr.extractedText.trim()
  const extracted = extractQuestionDetails(rawText)
  const kind = detectInputKind(rawText, input.mimeType, input.fileName)

  return {
    kind,
    rawText,
    extracted,
    ocr,
    warnings,
    ocrAccuracyEstimate: ocr.confidenceScore,
  }
}

export async function processPdfBuffer(buffer: Buffer): Promise<ProcessedMultimodalInput> {
  const pages = await parsePdf(buffer)
  const warnings: string[] = []
  let ocr: OcrResult | null = null
  const textParts: string[] = []

  for (const page of pages) {
    if (page.isScanned && page.ocrText) {
      textParts.push(page.ocrText)
      if (!ocr || page.ocrConfidence > ocr.confidenceScore) {
        ocr = {
          extractedText: page.ocrText,
          confidenceScore: page.ocrConfidence,
          hasFormula: /\d|=/u.test(page.ocrText),
          hasDiagram: /\[diagram/i.test(page.ocrText),
        }
      }
    } else if (!page.isScanned) {
      textParts.push(page.text)
    }
  }

  const rawText = textParts.join('\n\n').trim()
  if (!rawText) {
    warnings.push('PDF had no extractable text after OCR.')
  }

  const extracted = extractQuestionDetails(rawText)
  return {
    kind: 'pdf',
    rawText,
    extracted,
    ocr,
    warnings,
    ocrAccuracyEstimate: ocr?.confidenceScore ?? null,
  }
}

export function mergeExtractedWithAnalysis(
  extracted: ExtractedQuestion,
  overrides: Partial<ExtractedQuestion>
): ExtractedQuestion {
  return {
    ...extracted,
    board: overrides.board ?? extracted.board,
    level: overrides.level ?? extracted.level,
    subject: overrides.subject ?? extracted.subject,
    topic: overrides.topic ?? extracted.topic,
    chapter: overrides.chapter ?? extracted.chapter,
    year: overrides.year ?? extracted.year,
    paperCode: overrides.paperCode ?? extracted.paperCode,
    cleanPrompt: overrides.cleanPrompt ?? extracted.cleanPrompt,
  }
}

export { OCR_ACCURACY_TARGET }
