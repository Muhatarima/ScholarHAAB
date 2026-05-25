import type {
  ChatMessage,
  ChatResponse,
  ChatSessionDetail,
  ChatSessionSummary,
  Product,
  PromptMode,
  SessionContext,
  SourceCitation,
} from '../types'
import type { EncodedUpload } from './uploads'

type ProductConfig = {
  title: string
  subtitle: string
  placeholder: string
  welcome: string
  endpoint: string
  quickPrompts: string[]
}

const PRODUCT_CONFIG: Record<Product, ProductConfig> = {
  abroad: {
    title: 'ScholarHAAB Abroad',
    subtitle:
      'Scholarships, documents, visa steps, and country planning for Bangladeshi students.',
    placeholder: 'Ask about scholarships, documents, budget, or visa steps...',
    welcome:
      'I am your abroad consultant. Tell me your profile, budget, target country, or scholarship goal, and I will help you choose the smartest next move.',
    endpoint: '/api/abroad/chat',
    quickPrompts: [
      'Fully funded masters scholarship in Australia for a CSE student from Bangladesh',
      'What documents do I need before starting a funded masters application?',
      'Compare Germany vs Japan for affordable engineering masters options.',
    ],
  },
  qbank: {
    title: 'ScholarHAAB QBank',
    subtitle: 'Board-aware past-paper help with direct and tutor modes.',
    placeholder: 'Ask about a paper, topic, file, image, or exact question...',
    welcome:
      'I am your QBank tutor. Ask for a direct solution, an easy explanation, or a paper-based answer for your board and year.',
    endpoint: '/api/qbank/chat',
    quickPrompts: [
      'Differentiate y = sin x',
      'Which chemistry topics repeat most in Cambridge papers?',
      'Help me understand vectors like I am weak at math.',
    ],
  },
}

function normalizeSource(source: unknown): SourceCitation | null {
  if (!source || typeof source !== 'object') {
    return null
  }

  const record = source as Record<string, unknown>
  const title = typeof record.title === 'string' ? record.title.trim() : ''
  if (!title) {
    return null
  }

  return {
    title,
    url: typeof record.url === 'string' ? record.url : null,
    label: typeof record.label === 'string' ? record.label : 'Source',
    verified: record.verified !== false,
    lastChecked: typeof record.lastChecked === 'string' ? record.lastChecked : null,
    score: typeof record.score === 'number' ? record.score : null,
  }
}

function normalizeMessage(entry: unknown): ChatMessage | null {
  if (!entry || typeof entry !== 'object') {
    return null
  }

  const record = entry as Record<string, unknown>
  const role = record.role === 'user' ? 'user' : record.role === 'assistant' ? 'assistant' : null
  const content = typeof record.content === 'string' ? record.content.trim() : ''
  if (!role || !content) {
    return null
  }

  const sources = Array.isArray(record.sources)
    ? record.sources.map((source) => normalizeSource(source)).filter(Boolean) as SourceCitation[]
    : undefined

  return {
    id: typeof record.id === 'string' ? record.id : undefined,
    role,
    content,
    sources,
  }
}

function normalizeSession(entry: unknown): ChatSessionSummary | null {
  if (!entry || typeof entry !== 'object') {
    return null
  }

  const record = entry as Record<string, unknown>
  const id =
    typeof record.id === 'string'
      ? record.id
      : typeof record.sessionId === 'string'
        ? record.sessionId
        : ''
  const product = record.product === 'abroad' ? 'abroad' : record.product === 'qbank' ? 'qbank' : null
  const mode = record.mode === 'tutor' ? 'tutor' : 'direct'

  if (!id || !product) {
    return null
  }

  return {
    id,
    product,
    mode,
    title: typeof record.title === 'string' && record.title.trim() ? record.title : 'Saved chat',
    lastMessagePreview:
      typeof record.lastMessagePreview === 'string'
        ? record.lastMessagePreview
        : typeof record.last_message_preview === 'string'
          ? record.last_message_preview
          : '',
    updatedAt:
      typeof record.updatedAt === 'string'
        ? record.updatedAt
        : typeof record.updated_at === 'string'
          ? record.updated_at
          : new Date().toISOString(),
  }
}

export function getProductConfig(product: Product) {
  return PRODUCT_CONFIG[product]
}

export function getDefaultMessages(product: Product): ChatMessage[] {
  return [
    {
      role: 'assistant',
      content: PRODUCT_CONFIG[product].welcome,
    },
  ]
}

export function normalizeHistorySessions(payload: unknown): ChatSessionSummary[] {
  if (!payload || typeof payload !== 'object') {
    return []
  }

  const sessions = Array.isArray((payload as Record<string, unknown>).sessions)
    ? ((payload as Record<string, unknown>).sessions as unknown[])
    : []

  return sessions
    .map((entry) => normalizeSession(entry))
    .filter(Boolean) as ChatSessionSummary[]
}

export function normalizeSessionDetail(payload: unknown): ChatSessionDetail {
  if (!payload || typeof payload !== 'object') {
    return {
      enabled: false,
      session: null,
      messages: [],
    }
  }

  const record = payload as Record<string, unknown>
  return {
    enabled: record.enabled !== false,
    session: normalizeSession(record.session),
    messages: Array.isArray(record.messages)
      ? (record.messages.map((entry) => normalizeMessage(entry)).filter(Boolean) as ChatMessage[])
      : [],
  }
}

export function normalizeChatResponse(payload: unknown): Required<Pick<ChatResponse, 'response' | 'sources'>> &
  Pick<ChatResponse, 'sessionId' | 'usage' | 'studyProgress' | 'cached' | 'fromCache' | 'confidence'> {
  const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  const answer =
    typeof record.answer === 'string'
      ? record.answer
      : typeof record.response === 'string'
        ? record.response
        : ''

  return {
    response: answer,
    sources: Array.isArray(record.sources)
      ? (record.sources.map((source) => normalizeSource(source)).filter(Boolean) as SourceCitation[])
      : [],
    sessionId: typeof record.sessionId === 'string' ? record.sessionId : null,
    usage: typeof record.usage === 'object' ? (record.usage as ChatResponse['usage']) : undefined,
    studyProgress:
      typeof record.studyProgress === 'object'
        ? (record.studyProgress as ChatResponse['studyProgress'])
        : undefined,
    cached: Boolean(record.cached),
    fromCache: Boolean(record.fromCache),
    confidence: typeof record.confidence === 'number' ? record.confidence : undefined,
  }
}

export function buildChatEndpoint(product: Product, uploads: EncodedUpload[]) {
  if (
    product === 'qbank' &&
    uploads.length > 0 &&
    uploads.every((entry) => entry.type.startsWith('image/'))
  ) {
    return '/api/qbank/image'
  }

  return PRODUCT_CONFIG[product].endpoint
}

export function buildChatPayload(input: {
  message: string
  mode: PromptMode
  sessionId: string | null
  sessionContext: SessionContext
  uploads: EncodedUpload[]
}) {
  return {
    message: input.message,
    mode: input.mode,
    sessionId: input.sessionId ?? undefined,
    sessionContext: input.sessionContext,
    files: input.uploads.map((entry) => ({
      fileName: entry.name,
      fileType: entry.type,
      fileBase64: entry.base64,
    })),
  }
}

export function buildDisplayUserMessage(message: string, uploads: Array<{ name: string }>) {
  const cleanMessage = message.trim()
  if (uploads.length === 0) {
    return cleanMessage
  }

  const attachmentSummary = uploads.map((entry) => entry.name).join(', ')
  return [cleanMessage || 'Please analyze these files.', `Attachments: ${attachmentSummary}`]
    .filter(Boolean)
    .join('\n\n')
}
