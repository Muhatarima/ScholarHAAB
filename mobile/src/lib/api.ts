import AsyncStorage from '@react-native-async-storage/async-storage'
import { mobileEnv } from './env'

const VIEWER_KEY_STORAGE = 'scholarhaab_mobile_viewer_key'
const VIEWER_KEY_HEADER_NAME = 'x-scholarhaab-viewer'

function buildUrl(path: string) {
  return `${mobileEnv.apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

function createViewerKey() {
  return `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export async function getViewerKey() {
  const existing = await AsyncStorage.getItem(VIEWER_KEY_STORAGE)
  if (existing) {
    return existing
  }

  const next = createViewerKey()
  await AsyncStorage.setItem(VIEWER_KEY_STORAGE, next)
  return next
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { accessToken?: string | null } = {}
): Promise<T> {
  const viewerKey = await getViewerKey()
  const headers = new Headers(options.headers ?? {})
  headers.set('Accept', 'application/json')
  headers.set(VIEWER_KEY_HEADER_NAME, viewerKey)
  if (options.accessToken) {
    headers.set('Authorization', `Bearer ${options.accessToken}`)
  }
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(buildUrl(path), {
    ...options,
    headers,
  })

  const text = await response.text()
  let data = {} as T & { error?: string }

  if (text) {
    try {
      data = JSON.parse(text) as T & { error?: string }
    } catch {
      throw new Error(`The server returned an unreadable response for ${path}.`)
    }
  }

  if (!response.ok) {
    const errorMessage =
      (data as { error?: string })?.error ??
      `Request failed with status ${response.status}`
    throw new Error(errorMessage)
  }

  return data
}
