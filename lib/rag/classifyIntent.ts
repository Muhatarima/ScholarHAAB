import { understandMessage, type Message } from '@/lib/ai/universalUnderstanding'

export async function classifyIntent(raw: string, history: Message[] = []) {
  return understandMessage(raw, history)
}
