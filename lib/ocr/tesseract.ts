'use client'

type TesseractResult = {
  data?: {
    text?: string
  }
}

type TesseractModule = {
  recognize?: (
    image: File | Blob | string,
    lang?: string,
    options?: Record<string, unknown>
  ) => Promise<TesseractResult>
}

async function loadTesseract(): Promise<TesseractModule> {
  const dynamicImport = new Function('moduleName', 'return import(moduleName)') as (
    moduleName: string
  ) => Promise<TesseractModule>

  return dynamicImport('tesseract.js')
}

export async function recognizeImage(file: File) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please upload an image file.')
  }

  const tesseract = await loadTesseract()
  if (typeof tesseract.recognize !== 'function') {
    throw new Error('Tesseract.js is not available. Install tesseract.js and try again.')
  }

  const result = await tesseract.recognize(file, 'eng', {
    logger: () => undefined,
  })

  return (result.data?.text ?? '').replace(/\s+\n/g, '\n').trim()
}
