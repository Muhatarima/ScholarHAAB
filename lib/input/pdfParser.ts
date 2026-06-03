import { runOcr } from './ocrEngine'

export type PdfPageText = {
  pageNumber: number
  text: string
  isScanned: boolean
  ocrText?: string
  ocrConfidence: number
}

export async function parsePdf(buffer: Buffer): Promise<PdfPageText[]> {
  try {
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: buffer })
    const result = await parser.getText()
    await parser.destroy().catch(() => undefined)

    const pageTexts = result.pages.map((entry) => String(entry.text ?? '').trim())
    const fallback = String(result.text ?? '').trim()
    const bodies =
      pageTexts.length > 0
        ? pageTexts
        : fallback
          ? [fallback]
          : []

    const pages: PdfPageText[] = []
    const scannedIndices: number[] = []

    for (let i = 0; i < bodies.length; i++) {
      const text = bodies[i]
      if (text.length < 50) {
        scannedIndices.push(i)
      } else {
        pages.push({
          pageNumber: i + 1,
          text,
          isScanned: false,
          ocrConfidence: 100,
        })
      }
    }

    if (scannedIndices.length > 0) {
      const ocr = await runOcr(buffer, 'application/pdf')
      for (const i of scannedIndices) {
        pages.push({
          pageNumber: i + 1,
          text: ocr.extractedText || '[Scanned page — OCR empty]',
          isScanned: true,
          ocrText: ocr.extractedText,
          ocrConfidence: ocr.confidenceScore,
        })
      }
      pages.sort((a, b) => a.pageNumber - b.pageNumber)
    }

    return pages
  } catch (error) {
    console.error('PDF parsing error:', error)
    const ocr = await runOcr(buffer, 'application/pdf').catch(() => null)
    if (ocr?.extractedText) {
      return [
        {
          pageNumber: 1,
          text: ocr.extractedText,
          isScanned: true,
          ocrText: ocr.extractedText,
          ocrConfidence: ocr.confidenceScore,
        },
      ]
    }
    return []
  }
}
