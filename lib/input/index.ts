export { runOcr, type OcrResult } from '@/lib/input/ocrEngine'
export { parsePdf, type PdfPageText } from '@/lib/input/pdfParser'
export { parseImageMetadata, type ImageMetadata } from '@/lib/input/imageParser'
export { extractQuestionDetails, type ExtractedQuestion } from '@/lib/input/questionExtractor'
export {
  processTextInput,
  processImageBuffer,
  processPdfBuffer,
  mergeExtractedWithAnalysis,
  OCR_ACCURACY_TARGET,
  type ProcessedMultimodalInput,
  type MultimodalInputKind,
} from '@/lib/input/multimodalProcessor'
