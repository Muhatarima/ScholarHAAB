import assert from 'node:assert/strict'
import {
  buildChatEndpoint,
  buildChatPayload,
  buildDisplayUserMessage,
  normalizeChatResponse,
  normalizeHistorySessions,
  normalizeSessionDetail,
} from '../src/lib/chat'
import { createEmptySessionContext, createEmptyStudyProgress } from '../src/types'
import { updateSessionContext } from '../src/lib/sessionContext'

const sessions = normalizeHistorySessions({
  sessions: [
    {
      id: 'abc',
      product: 'qbank',
      mode: 'direct',
      title: 'Vectors help',
      last_message_preview: 'Let us break it down',
      updated_at: '2026-04-05T10:00:00.000Z',
    },
  ],
})

assert.equal(sessions.length, 1)
assert.equal(sessions[0]?.id, 'abc')
assert.equal(sessions[0]?.product, 'qbank')

const detail = normalizeSessionDetail({
  enabled: true,
  session: sessions[0],
  messages: [
    { role: 'assistant', content: 'Hello', sources: [{ title: 'Source', label: 'Verified source', verified: true }] },
  ],
})

assert.equal(detail.enabled, true)
assert.equal(detail.messages.length, 1)
assert.equal(detail.messages[0]?.sources?.[0]?.title, 'Source')

const payload = buildChatPayload({
  message: 'differentiate sin x',
  mode: 'direct',
  sessionId: 'sess-1',
  sessionContext: createEmptySessionContext(),
  uploads: [{ name: 'paper.pdf', type: 'application/pdf', base64: 'abc123' }],
})

assert.equal(payload.files.length, 1)
assert.equal(payload.sessionId, 'sess-1')
assert.equal(buildChatEndpoint('qbank', payload.files.map((file) => ({
  name: file.fileName,
  type: file.fileType,
  base64: file.fileBase64,
}))), '/api/qbank/chat')
assert.equal(buildChatEndpoint('qbank', [{ name: 'photo.jpg', type: 'image/jpeg', base64: 'xyz' }]), '/api/qbank/image')
assert.ok(buildDisplayUserMessage('', [{ name: 'photo.jpg' }]).includes('Attachments'))

const response = normalizeChatResponse({
  answer: 'dy/dx = cos x',
  sessionId: 'sess-1',
  confidence: 97,
  cached: false,
  fromCache: false,
  studyProgress: createEmptyStudyProgress(),
  sources: [{ title: 'Cambridge 9709', label: 'Past paper', verified: true }],
})

assert.equal(response.response, 'dy/dx = cos x')
assert.equal(response.sessionId, 'sess-1')
assert.equal(response.sources.length, 1)

const nextContext = updateSessionContext(
  createEmptySessionContext(),
  'I do not understand vectors in math',
  'Let us start with components.',
  'qbank'
)

assert.equal(nextContext.subject, 'Mathematics')
assert.ok(nextContext.frustration_level >= 0)

console.log('Mobile smoke checks passed.')
