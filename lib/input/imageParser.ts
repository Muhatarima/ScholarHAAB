export type ImageMetadata = {
  fileName: string
  mimeType: string
  sizeBytes: number
  isBlurry: boolean
  likelyScreenshot: boolean
  likelyHandwritten: boolean
}

export function parseImageMetadata(fileName: string, mimeType: string, base64Data: string): ImageMetadata {
  const buffer = Buffer.from(base64Data, 'base64')
  const sizeBytes = buffer.length
  const nameLower = fileName.toLowerCase()

  const isBlurry = sizeBytes < 2500
  const likelyScreenshot =
    /screenshot|screen.?shot|snip|capture/i.test(nameLower) || mimeType === 'image/png'
  const likelyHandwritten = /handwrit|scan|photo|cam|img_/i.test(nameLower)

  return {
    fileName,
    mimeType: mimeType || 'image/png',
    sizeBytes,
    isBlurry,
    likelyScreenshot,
    likelyHandwritten,
  }
}
