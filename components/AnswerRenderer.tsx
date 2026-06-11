'use client'

import { BlockMath, InlineMath } from 'react-katex'
import type { CSSProperties, ReactNode } from 'react'
import MathRenderer from '@/components/MathRenderer'

type AnswerRendererProps = {
  content: string
}

function cleanDisplayText(value: string) {
  return String(value ?? '')
    .replace(/Ã—/g, 'x')
    .replace(/â†’/g, '->')
    .replace(/â€“|â€”/g, '-')
    .replace(/Â·/g, '-')
    .replace(/Â\s*/g, '')
    .replace(/\\\\text\{([^{}]+)\}/g, '$1')
    .replace(/\\text\{([^{}]+)\}/g, '$1')
    .replace(/(\d+(?:\.\d+)?)\s*([a-zA-Z])(?=\s|[,.])/g, '$1 $2')
    .replace(/\b(\d+(?:\.\d+)?)\s*m\s*\/\s*s\^?2\b/gi, '$1 $\\mathrm{m\\,s^{-2}}$')
    .replace(/\b(\d+(?:\.\d+)?)\s*m\s*\/\s*s\b/gi, '$1 $\\mathrm{m\\,s^{-1}}$')
    .replace(/\bm\s*\/\s*s\^?2\b/gi, '$\\mathrm{m\\,s^{-2}}$')
    .replace(/\bm\s*\/\s*s\b/gi, '$\\mathrm{m\\,s^{-1}}$')
    .replace(/\bs\s*=\s*ut\s*\+\s*1\s*\/\s*2\s*at\^?2\b/gi, '$s = ut + \\frac{1}{2}at^{2}$')
    .replace(/\ba\s*=\s*\(?\s*v\s*-\s*u\s*\)?\s*\/\s*t\b/gi, '$a = \\frac{v-u}{t}$')
    .replace(/\bu\s*=\s*0\b/g, '$u = 0$')
    .replace(/\s{2,}/g, ' ')
}

function normalizePlainFormula(value: string) {
  return value
    .replace(/\b([A-Za-z])_([A-Za-z0-9]+)\b/g, '$1_{$2}')
    .replace(/\b([A-Za-z]+)_([A-Za-z0-9]+)\b/g, '$1_{$2}')
    .replace(/\^([+-]?\d+)/g, '^{$1}')
    .replace(/\b1\s*\/\s*2\b/g, '\\frac{1}{2}')
    .replace(/\*/g, '\\times ')
    .replace(/\bF_net\b/g, 'F_{net}')
    .replace(/\bF_g\b/g, 'F_g')
    .replace(/\bm\/s\^\{?2\}?/g, '\\mathrm{m\\,s^{-2}}')
    .replace(/\bm\/s\b/g, '\\mathrm{m\\,s^{-1}}')
    .replace(/\s+/g, ' ')
    .trim()
}

function isFormulaOnly(value: string) {
  const trimmed = value.trim()
  return (
    trimmed.length <= 120 &&
    !trimmed.includes('$') &&
    /[=+\-*/^_]/.test(trimmed) &&
    !/[.!?]\s*$/.test(trimmed) &&
    !/\b(the|and|because|therefore|since|where|given|question|answer|step)\b/i.test(trimmed)
  )
}

function renderMathText(text: string): ReactNode[] {
  if (isFormulaOnly(text)) {
    const math = normalizePlainFormula(text)
    return [<InlineMath key={`formula-${math}`} math={math} />]
  }

  return [<MathRenderer key={text} text={text} />]
}

function renderBlock(block: string, index: number) {
  const trimmed = block.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('$$') && trimmed.endsWith('$$')) {
    return <BlockMath key={index} math={normalizePlainFormula(trimmed.slice(2, -2))} />
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
  const displayContent = cleanDisplayText(content)

  return (
    <div style={styles.root}>
      {displayContent.split(/\n{2,}/).map(renderBlock)}
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
