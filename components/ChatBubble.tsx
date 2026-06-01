import type { CSSProperties, ReactNode } from 'react'

export default function ChatBubble({ children, role }: { children: ReactNode; role: 'user' | 'assistant' }) {
  const isUser = role === 'user'
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div style={isUser ? styles.user : styles.assistant}>{children}</div>
    </div>
  )
}

const styles = {
  user: {
    background: 'linear-gradient(130deg,#7c35d8,#a855f7)',
    borderRadius: '20px 20px 4px 20px',
    color: '#fff',
    lineHeight: 1.65,
    maxWidth: 'min(76%, 660px)',
    padding: '11px 15px',
  } satisfies CSSProperties,
  assistant: {
    color: '#e8e8ff',
    lineHeight: 1.75,
    maxWidth: 'min(86%, 780px)',
    paddingTop: 4,
  } satisfies CSSProperties,
}
