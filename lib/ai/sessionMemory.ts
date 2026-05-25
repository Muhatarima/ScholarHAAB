import type { Intent } from '@/lib/ai/intentEngine'

export type SessionMemory = {
  currentSubject: string
  currentTopic: string
  topicHistory: string[]
  confusedTopics: string[]
  lastExplanationMethod: string
  studentLanguage: 'english' | 'bangla' | 'mixed'
}

const store = new Map<string, SessionMemory>()

function createMemory(): SessionMemory {
  return {
    currentSubject: 'General',
    currentTopic: 'General',
    topicHistory: [],
    confusedTopics: [],
    lastExplanationMethod: 'direct',
    studentLanguage: 'english',
  }
}

function uniquePush(items: string[], value: string) {
  if (!value || items.includes(value)) return items
  return [...items, value].slice(-20)
}

export function getMemoryContext(sessionId: string): SessionMemory {
  const existing = store.get(sessionId)
  if (existing) return existing
  const next = createMemory()
  store.set(sessionId, next)
  return next
}

export function updateMemory(sessionId: string, intent: Intent, response: string): void {
  const current = getMemoryContext(sessionId)
  const subject = intent.subject ?? current.currentSubject
  const topic = intent.topic ?? current.currentTopic
  const explanationMethod = intent.type === 'confused' ? 'analogy_or_alternate' : intent.type

  const next: SessionMemory = {
    currentSubject: subject,
    currentTopic: topic,
    topicHistory: topic ? uniquePush(current.topicHistory, topic) : current.topicHistory,
    confusedTopics: intent.type === 'confused' && topic ? uniquePush(current.confusedTopics, topic) : current.confusedTopics,
    lastExplanationMethod: response.includes('analogy') ? 'analogy' : explanationMethod,
    studentLanguage: intent.language,
  }

  store.set(sessionId, next)
}

export function memoryToPrompt(memory: SessionMemory) {
  return [
    `Current subject: ${memory.currentSubject}`,
    `Current topic: ${memory.currentTopic}`,
    `Topics covered this session: ${memory.topicHistory.join(', ') || 'none yet'}`,
    `Confused topics: ${memory.confusedTopics.join(', ') || 'none yet'}`,
    `Last explanation method: ${memory.lastExplanationMethod}`,
    `Preferred language: ${memory.studentLanguage}`,
  ].join('\n')
}
