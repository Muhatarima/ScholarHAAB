'use client'

import { BlockMath, InlineMath } from 'react-katex'
import type { CSSProperties, ReactNode } from 'react'

type AnswerRendererProps = {
  content: string
}

function renderMathText(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const pattern = /(\$\$[^$]+\$\$|\$[^$]+\$|\\\([^)]+\\\))/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }

    const token = match[0]
    const value = token.startsWith('$$')
      ? token.slice(2, -2)
      : token.startsWith('$')
        ? token.slice(1, -1)
        : token.slice(2, -2)

    nodes.push(<InlineMath key={`${match.index}-${value}`} math={value} />)
    lastIndex = match.index + token.length
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes
}

function renderBlock(block: string, index: number) {
  const trimmed = block.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('$$') && trimmed.endsWith('$$')) {
    return <BlockMath key={index} math={trimmed.slice(2, -2)} />
  }

  const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed)
  if (heading) {
    const level = heading[1].length
    const style = level === 1 ? styles.h2 : styles.h3
    return <h2 key={index} style={style}>{renderMathText(heading[2])}</h2>
  }

  const lines = trimmed.split('\n').map((line) => line.trim()).filter(Boolean)
  const unordered = lines.every((line) => /^[-*]\s+/.test(line))
  const ordered = lines.every((line) => /^\d+\.\s+/.test(line))

  if (unordered || ordered) {
    const List = ordered ? 'ol' : 'ul'
    return (
      <List key={index} style={styles.list}>
        {lines.map((line) => (
          <li key={line}>{renderMathText(line.replace(/^[-*]\s+|^\d+\.\s+/, ''))}</li>
        ))}
      </List>
    )
  }

  return <p key={index} style={styles.paragraph}>{renderMathText(trimmed)}</p>
}

export default function AnswerRenderer({ content }: AnswerRendererProps) {
  return (
    <div style={styles.root}>
      {content.split(/\n{2,}/).map(renderBlock)}
    </div>
  )
}

const styles = {
  h2: {
    color: '#f3e8ff',
    fontSize: 24,
    lineHeight: 1.25,
    margin: '20px 0 10px',
  } satisfies CSSProperties,
  h3: {
    color: '#e9d5ff',
    fontSize: 18,
    lineHeight: 1.35,
    margin: '18px 0 8px',
  } satisfies CSSProperties,
  list: {
    display: 'grid',
    gap: 8,
    lineHeight: 1.7,
    margin: '10px 0 14px 22px',
  } satisfies CSSProperties,
  paragraph: {
    lineHeight: 1.75,
    margin: '0 0 14px',
    overflowWrap: 'anywhere',
  } satisfies CSSProperties,
  root: {
    color: '#ebe7ff',
    fontSize: 16,
  } satisfies CSSProperties,
} as const
