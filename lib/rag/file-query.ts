import { extractTextFromImage } from '@/lib/llm/client'
import {
  normalizeChatFilesPayload,
  type ChatFilePayload,
} from '@/lib/server/file-input'

export async function extractAcademicFileText(payload: ChatFilePayload) {
  const files = normalizeChatFilesPayload(payload)
  const sections: string[] = []
  const traces: Array<{
    fileName: string
    strategy: string
    model?: string
  }> = []

  for (const file of files) {
    const buffer = Buffer.from(file.fileBase64, 'base64')
    if (file.fileType.startsWith('image/')) {
      const result = await extractTextFromImage({
        base64: buffer.toString('base64'),
        mimeType: file.fileType || 'image/png',
      })
      sections.push(`Uploaded image ${file.fileName}:\n${result.text}`)
      traces.push({
        fileName: file.fileName,
        model: `${result.provider}:${result.model}`,
        strategy: 'gemini_vision_ocr',
      })
      continue
    }

    if (
      file.fileType === 'application/pdf' ||
      file.fileName.toLowerCase().endsWith('.pdf')
    ) {
      const { PDFParse } = await import('pdf-parse')
      const parser = new PDFParse({ data: buffer })
      try {
        const result = await parser.getText()
        const text = result.text.trim()
        if (!text) {
          throw new Error(
            `${file.fileName} is a scanned PDF with no text layer. Upload the question page as an image for OCR.`
          )
        }
        sections.push(`Uploaded PDF ${file.fileName}:\n${text}`)
        traces.push({ fileName: file.fileName, strategy: 'pdf_text_layer' })
      } finally {
        await parser.destroy()
      }
      continue
    }

    const text = buffer.toString('utf8').trim()
    if (text) {
      sections.push(`Uploaded file ${file.fileName}:\n${text}`)
      traces.push({ fileName: file.fileName, strategy: 'plain_text' })
    }
  }

  return { text: sections.join('\n\n').trim(), traces }
}
