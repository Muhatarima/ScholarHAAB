import fs from 'node:fs'
import { PaperManifestItem, appendJsonl, ensureDatasetDirs, jsonlPath, readJsonl, writeJsonl } from './dataset_common'

type ExtractedItem = {
  source_file_path: string
  source_url: string
  checksum: string | null
  board: string
  level: string
  subject: string
  year: number | null
  paper_code: string
  paper_type: string
  question_number: string | null
  text: string
  marks: number | null
  extraction_confidence: number
  needs_review: boolean
}

async function extractPdfText(filepath: string): Promise<{ text: string; confidence: number }> {
  const pdfParse = (await import('pdf-parse')) as unknown as {
    PDFParse?: new (options: { data: Buffer }) => { getText: () => Promise<{ text?: string }> }
    default?: (buffer: Buffer) => Promise<{ text?: string }>
  }
  const buffer = fs.readFileSync(filepath)
  const parsed = pdfParse.PDFParse
    ? await new pdfParse.PDFParse({ data: buffer }).getText()
    : pdfParse.default
      ? await pdfParse.default(buffer)
      : (() => {
          throw new Error('pdf-parse API unavailable')
        })()
  const text = String(parsed.text ?? '').replace(/\s+\n/g, '\n').trim()
  return {
    text,
    confidence: text.length > 250 ? 90 : text.length > 40 ? 65 : 20,
  }
}

function splitQuestionText(text: string) {
  const chunks = text
    .split(/\n(?=\s*(?:question\s*)?\d{1,2}\b|\(\s*a\s*\))/i)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 30)
  return chunks.length ? chunks : [text]
}

function questionNumber(text: string, index: number) {
  const match = text.match(/^\s*(?:question\s*)?(\d{1,2})(?:\.|\s|\))/i)
  return match?.[1] ?? String(index + 1)
}

function marks(text: string) {
  const match = text.match(/\[(\d{1,2})\s*marks?\]|\((\d{1,2})\s*marks?\)/i)
  return match ? Number(match[1] ?? match[2]) : null
}

async function main() {
  ensureDatasetDirs()
  const manifest = readJsonl<PaperManifestItem>(jsonlPath('manifests/papers_manifest.jsonl'))
  const questions: ExtractedItem[] = []
  const markSchemes: ExtractedItem[] = []

  for (const item of manifest) {
    if (!item.filepath || !['downloaded', 'skipped_existing'].includes(item.download_status)) continue

    try {
      const extracted = await extractPdfText(item.filepath)
      const chunks = splitQuestionText(extracted.text)
      chunks.forEach((chunk, index) => {
        const row: ExtractedItem = {
          source_file_path: item.filepath as string,
          source_url: item.url,
          checksum: item.checksum,
          board: item.board,
          level: item.level,
          subject: item.subject,
          year: item.year,
          paper_code: item.paper_code,
          paper_type: item.paper_type,
          question_number: item.paper_type === 'qp' ? questionNumber(chunk, index) : null,
          text: chunk,
          marks: item.paper_type === 'qp' ? marks(chunk) : null,
          extraction_confidence: extracted.confidence,
          needs_review: extracted.confidence < 75,
        }
        if (item.paper_type === 'ms') markSchemes.push(row)
        else questions.push(row)
      })
    } catch (error) {
      appendJsonl(jsonlPath('failed/extraction_failures.jsonl'), {
        filepath: item.filepath,
        source_url: item.url,
        error: error instanceof Error ? error.message : 'Unknown extraction error',
        timestamp: new Date().toISOString(),
      })
    }
  }

  writeJsonl(jsonlPath('extracted_text/questions.jsonl'), questions)
  writeJsonl(jsonlPath('extracted_text/mark_schemes.jsonl'), markSchemes)
  console.log(JSON.stringify({ questions: questions.length, markSchemes: markSchemes.length }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
