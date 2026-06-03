export type ImageMetadata = {
  fileName: string
  mimeType: string
  sizeBytes: number
  isBlurry: boolean
}

export function parseImageMetadata(fileName: string, mimeType: string, base64Data: string): ImageMetadata {
  const buffer = Buffer.from(base64Data, 'base64')
  
  // Simple heuristic checks
  const sizeBytes = buffer.length
  
  // A simple heuristic for blurry image based on size vs base64 length or generic indicators
  const isBlurry = sizeBytes < 2000 // very small size might mean low-res/blurry crop

  return {
    fileName,
    mimeType: mimeType || 'image/png',
    sizeBytes,
    isBlurry
  }
}
