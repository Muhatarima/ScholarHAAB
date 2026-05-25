import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system'
import * as ImagePicker from 'expo-image-picker'

export type PendingUpload = {
  uri: string
  name: string
  mimeType: string
  size: number | null
}

export type EncodedUpload = {
  name: string
  type: string
  base64: string
}

function normalizeMimeType(fileName: string, mimeType?: string | null) {
  if (mimeType) {
    return mimeType
  }

  if (/\.pdf$/i.test(fileName)) return 'application/pdf'
  if (/\.docx$/i.test(fileName)) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (/\.xlsx$/i.test(fileName)) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  if (/\.xls$/i.test(fileName)) return 'application/vnd.ms-excel'
  if (/\.pptx$/i.test(fileName)) return 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  if (/\.csv$/i.test(fileName)) return 'text/csv'
  if (/\.tsv$/i.test(fileName)) return 'text/tab-separated-values'
  if (/\.md$/i.test(fileName)) return 'text/markdown'
  if (/\.json$/i.test(fileName)) return 'application/json'
  if (/\.txt$/i.test(fileName)) return 'text/plain'
  if (/\.svg$/i.test(fileName)) return 'image/svg+xml'
  return 'application/octet-stream'
}

export async function pickDocuments() {
  const result = await DocumentPicker.getDocumentAsync({
    multiple: true,
    copyToCacheDirectory: true,
    type: [
      'image/*',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
      'application/json',
      'text/markdown',
    ],
  })

  if (result.canceled) {
    return [] as PendingUpload[]
  }

  return result.assets.map((asset) => ({
    uri: asset.uri,
    name: asset.name ?? 'upload',
    mimeType: normalizeMimeType(asset.name ?? 'upload', asset.mimeType),
    size: asset.size ?? null,
  }))
}

export async function pickFromLibrary() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!permission.granted) {
    throw new Error('Photo library permission is required to attach images.')
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    quality: 1,
  })

  if (result.canceled) {
    return [] as PendingUpload[]
  }

  return result.assets.map((asset, index) => ({
    uri: asset.uri,
    name: asset.fileName ?? `image-${index + 1}.jpg`,
    mimeType: normalizeMimeType(asset.fileName ?? `image-${index + 1}.jpg`, asset.mimeType),
    size: asset.fileSize ?? null,
  }))
}

export async function capturePhoto() {
  const permission = await ImagePicker.requestCameraPermissionsAsync()
  if (!permission.granted) {
    throw new Error('Camera permission is required to take a photo.')
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 1,
  })

  if (result.canceled) {
    return [] as PendingUpload[]
  }

  return result.assets.map((asset, index) => ({
    uri: asset.uri,
    name: asset.fileName ?? `camera-${index + 1}.jpg`,
    mimeType: normalizeMimeType(asset.fileName ?? `camera-${index + 1}.jpg`, asset.mimeType),
    size: asset.fileSize ?? null,
  }))
}

export async function encodeUploads(
  files: PendingUpload[],
  onProgress?: (current: number, total: number) => void
) {
  const encoded: EncodedUpload[] = []

  for (const [index, file] of files.entries()) {
    onProgress?.(index + 1, files.length)
    const base64 = await FileSystem.readAsStringAsync(file.uri, {
      encoding: 'base64',
    })

    encoded.push({
      name: file.name,
      type: file.mimeType,
      base64,
    })
  }

  return encoded
}
