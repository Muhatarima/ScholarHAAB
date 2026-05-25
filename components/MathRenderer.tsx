'use client'

import { Fragment, type ReactNode } from 'react'
import katex from 'katex'
import 'katex/contrib/mhchem'
import { BlockMath, InlineMath } from 'react-katex'
import { detectAndWrapNotation } from '@/lib/notationDetector'

const MATH_PATTERN = /(\$\$[\s\S]*?\$\$|\$[^$\n][\s\S]*?\$)/g

function renderPlainText(text: string, keyBase: string) {
  const lines = text.split('\n')
  return lines.map((line, index) => (
    <Fragment key={`${keyBase}-plain-${index}`}>
      {line}
      {index < lines.length - 1 ? <br /> : null}
    </Fragment>
  ))
}

function canRenderLatex(math: string, displayMode: boolean) {
  try {
    katex.renderToString(math, {
      displayMode,
      throwOnError: true,
      strict: 'ignore',
      trust: false,
    })
    return true
  } catch {
    return false
  }
}

function renderMathPart(raw: string, key: string): ReactNode {
  if (raw.startsWith('$$') && raw.endsWith('$$')) {
    const math = raw.slice(2, -2).trim()
    if (!canRenderLatex(math, true)) {
      return <span key={key}>{math}</span>
    }
    return <BlockMath key={key} math={math} errorColor="#fda4af" renderError={() => <span>{math}</span>} />
  }

  if (raw.startsWith('$') && raw.endsWith('$')) {
    const math = raw.slice(1, -1).trim()
    if (!canRenderLatex(math, false)) {
      return <span key={key}>{math}</span>
    }
    return <InlineMath key={key} math={math} errorColor="#fda4af" renderError={() => <span>{math}</span>} />
  }

  return <Fragment key={key}>{renderPlainText(raw, key)}</Fragment>
}

export default function MathRenderer({ text }: { text: string }) {
  const prepared = detectAndWrapNotation(text)
  const parts = prepared.split(MATH_PATTERN).filter((part) => part.length > 0)

  if (parts.length === 0) {
    return null
  }

  return (
    <>
      {parts.map((part, index) => renderMathPart(part, `notation-${index}`))}
    </>
  )
}
