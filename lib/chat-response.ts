import { generateResponse } from '@/lib/ai-service'
import { getSystemPrompt } from '@/lib/prompts'
import { normalizeMode, type Product, type PromptMode } from '@/lib/products'

type ConversationMessage = {
  role: 'user' | 'assistant'
  content: string
}

type RagContextBlock = {
  sourceTitle: string
  sourceUrl?: string | null
  content: string
  tier?: string | null
}

type ChatResponseInput = {
  message: string
  product: Product
  mode?: PromptMode
  history?: ConversationMessage[]
  ragContext?: RagContextBlock[]
}

function getResponseBudget(product: Product, mode: PromptMode, message: string): number {
  if (product === 'abroad') {
    if (/\b(sop|lor|cv|resume|transcript|essay|document)\b/i.test(message)) {
      return 560
    }

    return 380
  }

  if (mode === 'tutor') {
    return 360
  }

  return 440
}

function trimHistoryContent(content: string, maxChars = 260) {
  const compact = content.replace(/\s+/g, ' ').trim()
  if (compact.length <= maxChars) {
    return compact
  }

  return `${compact.slice(0, maxChars - 3).trim()}...`
}

function buildPrompt(
  message: string,
  history: ConversationMessage[] = [],
  ragContext: RagContextBlock[] = []
) {
  const recentHistory = history.slice(-6)
  const ragBlock =
    ragContext.length > 0
      ? `Retrieved reference context:\n${ragContext
          .slice(0, 3)
          .map(
            (entry, index) =>
              `[${index + 1}]${entry.tier ? ` [${entry.tier}]` : ''} ${entry.sourceTitle}${entry.sourceUrl ? ` | ${entry.sourceUrl}` : ''}\n${trimHistoryContent(entry.content, 420)}`
          )
          .join('\n\n')}\n\n`
      : ''

  if (recentHistory.length === 0) {
    return `${ragBlock}New user message:\n${message}`.trim()
  }

  const historyBlock = recentHistory
    .map((entry) =>
      `${entry.role === 'user' ? 'Student' : 'ScholarHAAB'}: ${trimHistoryContent(entry.content)}`
    )
    .join('\n')

  return `${ragBlock}Recent conversation context:\n${historyBlock}\n\nNew user message:\n${message}`.trim()
}

export async function buildChatResponse({
  message,
  product,
  mode = 'direct',
  history = [],
  ragContext = [],
}: ChatResponseInput): Promise<string> {
  const trimmedMessage = message.trim()
  if (!trimmedMessage) {
    throw new Error('Message is required')
  }

  const normalizedMode = normalizeMode(product, mode)
  const systemPrompt = getSystemPrompt(product, normalizedMode)
  const maxTokens = getResponseBudget(product, normalizedMode, trimmedMessage)
  return generateResponse(buildPrompt(trimmedMessage, history, ragContext), systemPrompt, maxTokens)
}
