import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import JSZip from 'jszip'
import mammoth from 'mammoth'
import type { AiInputPart } from '@/lib/ai-service'
import type { PDFParse as PDFParseClass } from 'pdf-parse'

export type ChatFilePayload = {
  fileBase64?: string | null
  fileType?: string | null
  fileName?: string | null
  files?: unknown
}

export type NormalizedChatFile = {
  fileBase64: string
  fileType: string
  fileName: string
}

export type UploadedFileTrace = {
  fileName: string
  fileType: string
  sizeBytes: number
  extractionStrategy:
    | 'image_inline_only'
    | 'image_svg_text'
    | 'pdf_text_only'
    | 'pdf_text_plus_inline'
    | 'pdf_inline_only'
    | 'document_text'
    | 'spreadsheet_text'
    | 'presentation_text'
    | 'plain_text'
  chunkCount: number
  extractedChars: number
  pageCount: number
  warnings: string[]
}

export type UploadedFileChunk = {
  id: string
  content: string
  sourceTitle: string
  sourceUrl: null
  sourceQuality: 'uploaded'
  tier: 'uploaded_file_chunk'
  lastChecked: null
  score: number
  fileName: string
  fileType: string
  page: number | null
  section: string | null
  chunkIndex: number
}

export type PreparedUploadedFiles = {
  files: NormalizedChatFile[]
  inlineParts: AiInputPart[]
  extractedTextParts: AiInputPart[]
  chunks: UploadedFileChunk[]
  traces: UploadedFileTrace[]
  warnings: string[]
  fileSummary: string | null
  hasInlineOnlyEvidence: boolean
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const MAX_FILE_COUNT = 4
const SUPPORTED_FILE_ERROR =
  'Unsupported file type. Use image, PDF, DOCX, TXT, CSV, JSON, or PPTX.'
let pdfWorkerConfigured = false

type PdfParserConstructor = typeof PDFParseClass

function ensurePdfWorkerConfigured(PDFParse: PdfParserConstructor) {
  if (pdfWorkerConfigured) {
    return
  }

  const workerPath = path.join(
    process.cwd(),
    'node_modules',
    'pdf-parse',
    'dist',
    'pdf-parse',
    'cjs',
    'pdf.worker.mjs'
  )

  if (typeof PDFParse.setWorker === 'function' && fs.existsSync(workerPath)) {
    PDFParse.setWorker(pathToFileURL(workerPath).href)
  }

  pdfWorkerConfigured = true
}

function estimateBase64Bytes(data: string) {
  const normalized = data.replace(/\s+/g, '')
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0
  return Math.floor((normalized.length * 3) / 4) - padding
}

function normalizeFileName(fileName: string | null | undefined, fallback = 'uploaded-file') {
  return (fileName ?? fallback).trim() || fallback
}

function normalizeMimeType(mimeType: string | null | undefined) {
  return (mimeType ?? '').trim().toLowerCase()
}

function getFileExtension(fileName: string) {
  const match = /\.([a-z0-9]+)$/i.exec(fileName)
  return match ? `.${match[1].toLowerCase()}` : ''
}

function isAllowedImage(mimeType: string, fileName: string) {
  return (
    ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'].includes(mimeType) ||
    ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'].includes(getFileExtension(fileName))
  )
}

function isPdfFile(mimeType: string, fileName: string) {
  return mimeType === 'application/pdf' || getFileExtension(fileName) === '.pdf'
}

function isWordFile(mimeType: string, fileName: string) {
  const ext = getFileExtension(fileName)
  return (
    mimeType.includes('word') ||
    mimeType.includes('officedocument.wordprocessingml') ||
    ext === '.docx'
  )
}

function isPresentationFile(mimeType: string, fileName: string) {
  const ext = getFileExtension(fileName)
  return (
    mimeType.includes('presentationml') ||
    ext === '.pptx'
  )
}

function isPlainTextFile(mimeType: string, fileName: string) {
  const ext = getFileExtension(fileName)
  return (
    mimeType.startsWith('text/') ||
    mimeType === 'application/json' ||
    ['.txt', '.md', '.markdown', '.csv', '.tsv', '.json'].includes(ext)
  )
}

function compactWhitespace(value: string) {
  return value
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ \u00A0]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function isLowSignalExtractedText(text: string) {
  const compact = compactWhitespace(text)
  if (!compact) {
    return true
  }

  if (/^--\s*\d+\s+of\s+\d+\s*--$/i.test(compact)) {
    return true
  }

  const letterCount = (compact.match(/[A-Za-z]/g) ?? []).length
  return compact.length <= 20 && letterCount < 5
}

function tokenize(value: string) {
  return compactWhitespace(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 2)
}

function scoreChunk(query: string, chunk: UploadedFileChunk) {
  const normalizedQuery = compactWhitespace(query).toLowerCase()
  const normalizedContent = compactWhitespace(chunk.content).toLowerCase()
  const queryTokens = tokenize(normalizedQuery)
  const contentTokens = new Set(tokenize(normalizedContent))
  const titleTokens = new Set(tokenize(chunk.sourceTitle))

  let score = 0
  if (normalizedQuery && normalizedContent.includes(normalizedQuery)) {
    score += 16
  }

  for (const token of queryTokens) {
    if (contentTokens.has(token)) {
      score += 3
    }
    if (titleTokens.has(token)) {
      score += 2
    }
  }

  const numericMatches = normalizedQuery.match(/\b\d+\b/g) ?? []
  for (const numeric of numericMatches) {
    if (normalizedContent.includes(numeric)) {
      score += 3
    }
  }

  if (chunk.page !== null && /\bpage\b/.test(normalizedQuery)) {
    score += 1
  }

  return score
}

function normalizeForDeduplication(value: string) {
  return compactWhitespace(value).toLowerCase()
}

function buildChunkId(fileName: string, page: number | null, section: string | null, chunkIndex: number) {
  const cleanName = fileName.replace(/[^\w.-]+/g, '_')
  return [cleanName, page !== null ? `p${page}` : null, section ? section.replace(/[^\w-]+/g, '_') : null, `c${chunkIndex}`]
    .filter(Boolean)
    .join('__')
}

function splitIntoChunkBodies(text: string, maxChars = 1000, overlapChars = 160) {
  const paragraphs = compactWhitespace(text)
    .split(/\n{2,}/)
    .map((entry) => entry.trim())
    .filter(Boolean)

  if (paragraphs.length === 0) {
    return [] as string[]
  }

  const chunks: string[] = []
  let current = ''

  for (const paragraph of paragraphs) {
    const next = current ? `${current}\n\n${paragraph}` : paragraph
    if (next.length <= maxChars) {
      current = next
      continue
    }

    if (current) {
      chunks.push(current)
    }

    if (paragraph.length <= maxChars) {
      current = paragraph
      continue
    }

    let start = 0
    while (start < paragraph.length) {
      const slice = paragraph.slice(start, start + maxChars).trim()
      if (slice) {
        chunks.push(slice)
      }
      if (start + maxChars >= paragraph.length) {
        start = paragraph.length
      } else {
        start += maxChars - overlapChars
      }
    }
    current = ''
  }

  if (current) {
    chunks.push(current)
  }

  return chunks
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

function extractSvgText(svgText: string) {
  const matches = Array.from(svgText.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/gi))
  return compactWhitespace(
    matches
      .map((match) => decodeXmlEntities(match[1].replace(/<[^>]+>/g, ' ')))
      .filter(Boolean)
      .join('\n')
  )
}

async function extractPdfPages(buffer: Buffer) {
  const { PDFParse } = await import('pdf-parse')
  ensurePdfWorkerConfigured(PDFParse)
  const parser = new PDFParse({ data: buffer })

  try {
    const result = await parser.getText()
    const normalizedPages = result.pages
      .map((entry) => compactWhitespace(entry.text))
      .filter((entry) => entry && !isLowSignalExtractedText(entry))
    const fallbackText = compactWhitespace(result.text)

    return {
      pages:
        normalizedPages.length > 0
          ? normalizedPages
          : fallbackText && !isLowSignalExtractedText(fallbackText)
            ? [fallbackText]
            : [],
      pageCount: Number(result.total ?? normalizedPages.length ?? 0) || normalizedPages.length,
    }
  } finally {
    await parser.destroy().catch(() => undefined)
  }
}

async function extractWordText(buffer: Buffer) {
  const result = await mammoth.extractRawText({ buffer })
  return compactWhitespace(result.value)
}

async function extractPresentationSections(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer)
  const slideNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))

  const slides = await Promise.all(
    slideNames.map(async (slideName, index) => {
      const xml = await zip.file(slideName)?.async('text')
      const text = compactWhitespace(
        Array.from((xml ?? '').matchAll(/<a:t>([\s\S]*?)<\/a:t>/gi))
          .map((match) => decodeXmlEntities(match[1]))
          .join('\n')
      )
      return {
        section: `Slide ${index + 1}`,
        text,
      }
    })
  )

  return slides.filter((entry) => entry.text)
}

function extractPlainText(buffer: Buffer) {
  return compactWhitespace(buffer.toString('utf8'))
}

function buildChunkObjects(input: {
  fileName: string
  fileType: string
  page: number | null
  section: string | null
  text: string
}) {
  const chunkBodies = splitIntoChunkBodies(input.text)
  return chunkBodies.map((body, index) => {
    const locationLabel =
      input.page !== null
        ? `page ${input.page}`
        : input.section
          ? input.section
          : 'excerpt'
    return {
      id: buildChunkId(input.fileName, input.page, input.section, index + 1),
      content: body,
      sourceTitle: `${input.fileName} • ${locationLabel}`,
      sourceUrl: null,
      sourceQuality: 'uploaded' as const,
      tier: 'uploaded_file_chunk' as const,
      lastChecked: null,
      score: 0,
      fileName: input.fileName,
      fileType: input.fileType,
      page: input.page,
      section: input.section,
      chunkIndex: index + 1,
    }
  })
}

function deduplicateChunks(chunks: UploadedFileChunk[]) {
  const seen = new Set<string>()
  const deduped: UploadedFileChunk[] = []

  for (const chunk of chunks) {
    const key = normalizeForDeduplication(chunk.content)
    if (!key || seen.has(key)) {
      continue
    }
    seen.add(key)
    deduped.push(chunk)
  }

  return deduped
}

export function normalizeChatFilesPayload(payload: ChatFilePayload) {
  const normalized: NormalizedChatFile[] = []

  const maybeFiles = Array.isArray(payload.files) ? payload.files : []
  for (const entry of maybeFiles) {
    if (!entry || typeof entry !== 'object') {
      continue
    }

    const record = entry as Record<string, unknown>
    const fileBase64 =
      typeof record.fileBase64 === 'string'
        ? record.fileBase64
        : typeof record.base64 === 'string'
          ? record.base64
          : null
    const fileType =
      typeof record.fileType === 'string'
        ? record.fileType
        : typeof record.type === 'string'
          ? record.type
          : null
    const fileName =
      typeof record.fileName === 'string'
        ? record.fileName
        : typeof record.name === 'string'
          ? record.name
          : 'uploaded-file'

    if (fileBase64 && fileType) {
      normalized.push({
        fileBase64,
        fileType: normalizeMimeType(fileType),
        fileName: normalizeFileName(fileName, 'uploaded-file'),
      })
    }
  }

  if (normalized.length === 0 && payload.fileBase64 && payload.fileType) {
    normalized.push({
      fileBase64: payload.fileBase64,
      fileType: normalizeMimeType(payload.fileType),
      fileName: normalizeFileName(payload.fileName, 'uploaded-file'),
    })
  }

  if (normalized.length > MAX_FILE_COUNT) {
    throw new Error(`You can attach up to ${MAX_FILE_COUNT} files at once.`)
  }

  for (const file of normalized) {
    const estimatedBytes = estimateBase64Bytes(file.fileBase64)
    if (estimatedBytes > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File is too large. ${file.fileName} exceeds the 10MB limit.`)
    }

    const mimeType = normalizeMimeType(file.fileType)
    if (
      !isAllowedImage(mimeType, file.fileName) &&
      !isPdfFile(mimeType, file.fileName) &&
      !isWordFile(mimeType, file.fileName) &&
      !isPresentationFile(mimeType, file.fileName) &&
      !isPlainTextFile(mimeType, file.fileName)
    ) {
      throw new Error(SUPPORTED_FILE_ERROR)
    }
  }

  return normalized
}

export async function prepareUploadedFiles(files: NormalizedChatFile[]): Promise<PreparedUploadedFiles> {
  if (files.length === 0) {
    return {
      files: [],
      inlineParts: [],
      extractedTextParts: [],
      chunks: [],
      traces: [],
      warnings: [],
      fileSummary: null,
      hasInlineOnlyEvidence: false,
    }
  }

  const inlineParts: AiInputPart[] = []
  const extractedTextParts: AiInputPart[] = []
  const chunks: UploadedFileChunk[] = []
  const traces: UploadedFileTrace[] = []
  const warnings: string[] = []
  let hasInlineOnlyEvidence = false

  for (const file of files) {
    const buffer = Buffer.from(file.fileBase64, 'base64')
    const fileType = normalizeMimeType(file.fileType)
    const fileName = normalizeFileName(file.fileName)
    const fileWarnings: string[] = []
    let extractionStrategy: UploadedFileTrace['extractionStrategy'] = 'plain_text'
    let pageCount = 1
    let extractedChars = 0
    let fileChunks: UploadedFileChunk[] = []

    if (isAllowedImage(fileType, fileName)) {
      inlineParts.push({
        inlineData: {
          mimeType: fileType || 'image/png',
          data: file.fileBase64,
        },
      })

      const svgText =
        fileType === 'image/svg+xml' || getFileExtension(fileName) === '.svg'
          ? extractSvgText(buffer.toString('utf8'))
          : ''

      if (svgText) {
        extractedChars = svgText.length
        extractionStrategy = 'image_svg_text'
        extractedTextParts.push({
          text: `Attachment extracted text: ${fileName}\n${svgText}`,
        })
        fileChunks = buildChunkObjects({
          fileName,
          fileType,
          page: 1,
          section: 'image text',
          text: svgText,
        })
      } else {
        extractionStrategy = 'image_inline_only'
        hasInlineOnlyEvidence = true
        fileWarnings.push('No reliable OCR text was extracted. This answer depends on native image inspection.')
      }
    } else if (isPdfFile(fileType, fileName)) {
      const { pages, pageCount: extractedPageCount } = await extractPdfPages(buffer)
      pageCount = extractedPageCount
      extractedChars = pages.join(' ').length
      const needsInlinePdf = extractedChars < 200
      const shouldKeepInlinePdf = needsInlinePdf || (pageCount <= 3 && extractedChars <= 5000)

      if (shouldKeepInlinePdf) {
        inlineParts.push({
          inlineData: {
            mimeType: 'application/pdf',
            data: file.fileBase64,
          },
        })
      }

      if (pages.length > 0) {
        extractionStrategy = shouldKeepInlinePdf ? 'pdf_text_plus_inline' : 'pdf_text_only'
        for (const [index, pageText] of pages.entries()) {
          extractedTextParts.push({
            text: `Attachment extracted text: ${fileName} page ${index + 1}\n${pageText}`,
          })
          fileChunks.push(
            ...buildChunkObjects({
              fileName,
              fileType,
              page: index + 1,
              section: null,
              text: pageText,
            })
          )
        }
      } else {
        extractionStrategy = 'pdf_inline_only'
        hasInlineOnlyEvidence = true
        fileWarnings.push('PDF text extraction failed. The answer depends on native PDF inspection.')
      }
    } else if (isWordFile(fileType, fileName)) {
      const text = await extractWordText(buffer)
      if (!text) {
        throw new Error(`Could not extract readable text from ${fileName}.`)
      }

      extractionStrategy = 'document_text'
      extractedChars = text.length
      extractedTextParts.push({
        text: `Attachment extracted text: ${fileName}\n${text}`,
      })
      fileChunks = buildChunkObjects({
        fileName,
        fileType,
        page: null,
        section: 'document',
        text,
      })
    } else if (isPresentationFile(fileType, fileName)) {
      const sections = await extractPresentationSections(buffer)
      if (sections.length === 0) {
        throw new Error(`Could not extract readable slide text from ${fileName}.`)
      }

      extractionStrategy = 'presentation_text'
      pageCount = sections.length
      extractedChars = sections.reduce((total, entry) => total + entry.text.length, 0)
      for (const section of sections) {
        extractedTextParts.push({
          text: `Attachment extracted text: ${fileName} ${section.section}\n${section.text}`,
        })
        fileChunks.push(
          ...buildChunkObjects({
            fileName,
            fileType,
            page: null,
            section: section.section,
            text: section.text,
          })
        )
      }
    } else if (isPlainTextFile(fileType, fileName)) {
      const text = extractPlainText(buffer)
      if (!text) {
        throw new Error(`Could not extract readable text from ${fileName}.`)
      }

      extractionStrategy = 'plain_text'
      extractedChars = text.length
      extractedTextParts.push({
        text: `Attachment extracted text: ${fileName}\n${text}`,
      })
      fileChunks = buildChunkObjects({
        fileName,
        fileType,
        page: null,
        section: getFileExtension(fileName).replace('.', '') || 'text',
        text,
      })
    } else {
      throw new Error(SUPPORTED_FILE_ERROR)
    }

    traces.push({
      fileName,
      fileType,
      sizeBytes: buffer.byteLength,
      extractionStrategy,
      chunkCount: fileChunks.length,
      extractedChars,
      pageCount,
      warnings: fileWarnings,
    })

    warnings.push(...fileWarnings)
    chunks.push(...fileChunks)
  }

  return {
    files,
    inlineParts,
    extractedTextParts,
    chunks: deduplicateChunks(chunks),
    traces,
    warnings,
    fileSummary: getFilesSummary(files),
    hasInlineOnlyEvidence,
  }
}

export function selectUploadedFileChunks(query: string, chunks: UploadedFileChunk[], limit = 4) {
  const scored = chunks
    .map((chunk) => ({
      ...chunk,
      score: scoreChunk(query, chunk),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }
      if ((left.page ?? 0) !== (right.page ?? 0)) {
        return (left.page ?? 0) - (right.page ?? 0)
      }
      return left.chunkIndex - right.chunkIndex
    })

  const byFile = new Map<string, typeof scored>()
  for (const chunk of scored) {
    const group = byFile.get(chunk.fileName) ?? []
    group.push(chunk)
    byFile.set(chunk.fileName, group)
  }

  const guaranteed = Array.from(byFile.values())
    .map((group) => {
      const top = group[0]
      return {
        ...top,
        score: byFile.size > 1 && top.score <= 0 ? 1 : top.score,
      }
    })
    .slice(0, limit)
  const guaranteedIds = new Set(guaranteed.map((chunk) => chunk.id))

  const fillFrom = scored.filter((chunk) => !guaranteedIds.has(chunk.id))
  const positive = fillFrom.filter((chunk) => chunk.score > 0)

  if (positive.length > 0) {
    return [...guaranteed, ...positive]
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score
        }
        if ((left.page ?? 0) !== (right.page ?? 0)) {
          return (left.page ?? 0) - (right.page ?? 0)
        }
        return left.chunkIndex - right.chunkIndex
      })
      .slice(0, limit)
  }

  return [...guaranteed, ...fillFrom]
    .slice(0, Math.min(limit, chunks.length))
}

export async function buildFilePartsFromPayload(payload: ChatFilePayload): Promise<AiInputPart[]> {
  const files = normalizeChatFilesPayload(payload)
  const prepared = await prepareUploadedFiles(files)
  return [...prepared.extractedTextParts, ...prepared.inlineParts]
}

export function getFilesSummary(files: NormalizedChatFile[]) {
  if (files.length === 0) {
    return null
  }

  if (files.length === 1) {
    const file = files[0]
    if (isAllowedImage(file.fileType, file.fileName)) {
      return `${file.fileName} attached`
    }

    if (isPdfFile(file.fileType, file.fileName)) {
      return `${file.fileName} attached`
    }

    return `${file.fileName} attached`
  }

  const listedNames = files.slice(0, 3).map((file) => file.fileName).join(', ')
  const suffix = files.length > 3 ? `, +${files.length - 3} more` : ''
  return `${files.length} files attached: ${listedNames}${suffix}`
}

export function getFileSummary(payload: ChatFilePayload) {
  return getFilesSummary(normalizeChatFilesPayload(payload))
}
