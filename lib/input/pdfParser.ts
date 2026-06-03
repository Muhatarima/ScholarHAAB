import { runOcr } from './ocrEngine'

export type PdfPageText = {
  pageNumber: number
  text: string
  isScanned: boolean
}

export async function parsePdf(buffer: Buffer): Promise<PdfPageText[]> {
  const { default: PDFParse } = await import('pdf-parse')
  
  try {
    const result = await PDFParse(buffer)
    const pages: PdfPageText[] = []
    
    // Split text by standard page breaks or approximate splits
    const pageTexts = result.text.split(/\n\s*---Page Break---\s*\n|(?:\f)/g)
    
    for (let i = 0; i < pageTexts.length; i++) {
      const text = pageTexts[i].trim()
      const isScanned = text.length < 50 // Very low text density implies scanned page
      
      pages.push({
        pageNumber: i + 1,
        text: isScanned ? '[Scanned Page - OCR needed]' : text,
        isScanned
      })
    }

    return pages
  } catch (error) {
    console.error('PDF parsing error:', error)
    return []
  }
}
