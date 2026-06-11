'use client'


function cleanBrokenLatexTextLegacy(value: string) {
  return String(value ?? '')
    .replace(/\\ce\{([^{}]+)\}/g, '$1')
    .replace(/\ce\{([^{}]+)\}/g, '$1')
    .replace(/\\lambda/g, 'λ')
    .replace(/\lambda/g, 'λ')
    .replace(/\\Omega/g, 'Ω')
    .replace(/\Omega/g, 'Ω')
}

function cleanBrokenLatexText(value: string) {
  return String(value ?? '')
    .replace(/Ãƒâ€”/g, 'x')
    .replace(/Ã¢â€ â€™/g, '->')
    .replace(/Ã¢â‚¬â€œ|Ã¢â‚¬â€/g, '-')
    .replace(/Ã‚Â·/g, '-')
    .replace(/Ã‚\s*/g, '')
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
    .trim()
}

import type { ReactNode } from 'react'
import DiagramRenderer from '@/components/diagrams/DiagramRenderer'
import GraphDetector from '@/components/graphs/GraphDetector'
import MathRenderer from '@/components/MathRenderer'
import { matchDiagramType } from '@/lib/diagrams/diagramMatcher'
import { detectAndWrapNotation } from '@/lib/notationDetector'

const SECTION_TITLE_PATTERN = /^[A-Za-z][A-Za-z0-9 /&()+-]{1,60}:$/
const MARKDOWN_HEADING_PATTERN = /^(#{1,4})\s+(.+)$/
const INLINE_BOLD_PATTERN = /(\*\*[^*\n]+\*\*)/g
const QUESTION_TAG_PATTERN = /^\[[^\]]+\](?:\s+\[[^\]]+\])+$/u
const NUMBERED_LINE_PATTERN = /^\d+\.\s+/
const BULLET_LINE_PATTERN = /^[*-]\s+/
const OPTION_LINE_PATTERN = /^[A-Z]\.\s+/
const MARK_SCHEME_POINTS_PATTERN = /^(mark scheme points?|ms points?):\s*(.+)$/gim
const DIAGRAM_HINT_PATTERN =
  /\b(diagram|figure|sketch|draw|label|wave|wavelength|amplitude|circuit|resistor|ray|lens|triangle|energy profile|activation energy|molecule|bonding|cell|nucleus|membrane|chloroplast|mitochondria)\b/i

function inferSubject(content: string) {
  if (/\bphysics\b/i.test(content)) return 'Physics'
  if (/\bchemistry\b/i.test(content)) return 'Chemistry'
  if (/\bbiology|cell|nucleus|membrane|chloroplast|mitochondria|photosynthesis\b/i.test(content)) return 'Biology'
  if (/\bmath|mathematics|integral|differentiat|trigonometry|triangle|graph\b/i.test(content)) {
    return 'Mathematics'
  }
  return 'Physics'
}

function renderMathAwareText(text: string, keyBase: string) {
  const parts = text.split(INLINE_BOLD_PATTERN).filter(Boolean)

  return (
    <>
      {parts.map((part, index) => {
        const isBold = part.startsWith('**') && part.endsWith('**')
        const value = cleanBrokenLatexText(isBold ? part.slice(2, -2) : part)
        const rendered = (
          <MathRenderer
            key={`${keyBase}-math-${index}`}
            text={detectAndWrapNotation(value)}
          />
        )

        return isBold ? (
          <strong key={`${keyBase}-strong-${index}`} style={{ fontWeight: 800 }}>
            {rendered}
          </strong>
        ) : (
          rendered
        )
      })}
    </>
  )
}

function getLineKind(line: string) {
  if (NUMBERED_LINE_PATTERN.test(line)) {
    return 'numbered'
  }

  if (BULLET_LINE_PATTERN.test(line) || OPTION_LINE_PATTERN.test(line)) {
    return 'bullet'
  }

  return 'paragraph'
}

function normalizeMarkSchemePointLists(text: string) {
  return text.replace(MARK_SCHEME_POINTS_PATTERN, (match, title: string, rest: string) => {
    const points = rest
      .split(/\s*(?:;|\|)\s*/)
      .map((point) => point.trim())
      .filter(Boolean)

    if (points.length < 2) {
      return match
    }

    return `${title}:\n${points.map((point, index) => `${index + 1}. ${point}`).join('\n')}`
  })
}

function splitReadableLines(line: string) {
  const clean = line.trim()
  if (clean.length < 170) return [clean]

  return clean
    .replace(/\s+(?=(?:We can|Using|Substituting|Rearranging|Now,|Therefore,|So,|Since|The integral|This gives|Finally,|Let)\b)/g, '\n')
    .replace(/([.!?])\s+(?=(?:We|This|Now|Using|Substituting|Rearranging|Therefore|So|The|Since|To)\b)/g, '$1\n')
    .split('\n')
    .map((part) => part.trim())
    .filter(Boolean)
}

function renderParagraph(lines: string[], keyBase: string) {
  const readableLines = lines.flatMap(splitReadableLines)

  return (
    <div key={keyBase} style={{ display: 'grid', gap: '8px' }}>
      {readableLines.map((line, index) => (
        <p
          key={`${keyBase}-p-${index}`}
          style={{
            margin: 0,
            lineHeight: 1.7,
            color: 'rgba(240,236,255,0.94)',
          }}
        >
          {renderMathAwareText(line, `${keyBase}-p-${index}`)}
        </p>
      ))}
    </div>
  )
}

function renderNumberedList(lines: string[], keyBase: string) {
  return (
    <ol
      key={keyBase}
      style={{
        margin: 0,
        paddingLeft: '20px',
        display: 'grid',
        gap: '8px',
        color: 'rgba(240,236,255,0.94)',
      }}
    >
      {lines.map((line, index) => (
        <li key={`${keyBase}-li-${index}`} style={{ lineHeight: 1.7 }}>
          {renderMathAwareText(line.replace(NUMBERED_LINE_PATTERN, ''), `${keyBase}-li-${index}`)}
        </li>
      ))}
    </ol>
  )
}

function renderBulletList(lines: string[], keyBase: string) {
  return (
    <ul
      key={keyBase}
      style={{
        margin: 0,
        paddingLeft: '20px',
        display: 'grid',
        gap: '8px',
        color: 'rgba(240,236,255,0.94)',
      }}
    >
      {lines.map((line, index) => (
        <li key={`${keyBase}-li-${index}`} style={{ lineHeight: 1.7 }}>
          {renderMathAwareText(
            line.replace(BULLET_LINE_PATTERN, '').replace(OPTION_LINE_PATTERN, ''),
            `${keyBase}-li-${index}`
          )}
        </li>
      ))}
    </ul>
  )
}

function renderStructuredBody(lines: string[], keyBase: string) {
  const nodes: ReactNode[] = []
  let group: string[] = []
  let groupKind: 'paragraph' | 'numbered' | 'bullet' | null = null

  const flush = () => {
    if (group.length === 0 || !groupKind) {
      return
    }

    const nextKey = `${keyBase}-${nodes.length}`
    if (groupKind === 'numbered') {
      nodes.push(renderNumberedList(group, nextKey))
    } else if (groupKind === 'bullet') {
      nodes.push(renderBulletList(group, nextKey))
    } else {
      nodes.push(renderParagraph(group, nextKey))
    }

    group = []
    groupKind = null
  }

  lines.forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed) {
      flush()
      return
    }

    const nextKind = getLineKind(trimmed)
    if (groupKind && groupKind !== nextKind) {
      flush()
    }

    groupKind = nextKind
    group.push(trimmed)
  })

  flush()

  return nodes
}

function renderTextBlock(block: string, keyBase: string) {
  const trimmed = block.trim()
  if (!trimmed) {
    return null
  }

  const lines = trimmed.split('\n').map((line) => line.trimEnd())
  const firstLine = lines[0]?.trim() ?? ''
  const markdownHeading = firstLine.match(MARKDOWN_HEADING_PATTERN)

  if (markdownHeading) {
    const level = markdownHeading[1].length
    const heading = markdownHeading[2]
    return (
      <section key={keyBase} style={{ display: 'grid', gap: '10px' }}>
        <div
          style={{
            fontSize: level <= 2 ? '20px' : '15px',
            lineHeight: 1.35,
            fontWeight: 800,
            color: level <= 2 ? '#f4f0ff' : '#c4b5fd',
          }}
        >
          {renderMathAwareText(heading, `${keyBase}-heading`)}
        </div>
        {lines.length > 1 ? (
          <div style={{ display: 'grid', gap: '10px' }}>
            {renderStructuredBody(lines.slice(1), `${keyBase}-heading-body`)}
          </div>
        ) : null}
      </section>
    )
  }

  if (lines.length === 1 && QUESTION_TAG_PATTERN.test(firstLine)) {
    return (
      <div
        key={keyBase}
        style={{
          display: 'inline-flex',
          flexWrap: 'wrap',
          gap: '8px',
          padding: '8px 12px',
          borderRadius: '999px',
          border: '1px solid rgba(96, 165, 250, 0.35)',
          background: 'rgba(59, 130, 246, 0.12)',
          color: '#dbeafe',
          fontSize: '12px',
          fontWeight: 700,
          letterSpacing: '0.02em',
        }}
      >
        {renderMathAwareText(firstLine, keyBase)}
      </div>
    )
  }

  if (SECTION_TITLE_PATTERN.test(firstLine) && lines.length > 1) {
    return (
      <section
        key={keyBase}
        style={{
          display: 'grid',
          gap: '12px',
          padding: '14px 16px',
          borderRadius: '18px',
          border: '1px solid rgba(170,85,255,0.12)',
          background: 'rgba(255,255,255,0.03)',
        }}
      >
        <div
          style={{
            fontSize: '12px',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: '#c4b5fd',
          }}
        >
          {firstLine.slice(0, -1)}
        </div>
        <div style={{ display: 'grid', gap: '12px' }}>
          {renderStructuredBody(lines.slice(1), `${keyBase}-body`)}
        </div>
      </section>
    )
  }

  return (
    <section
      key={keyBase}
      style={{
        display: 'grid',
        gap: '12px',
      }}
    >
      {renderStructuredBody(lines, `${keyBase}-body`)}
    </section>
  )
}

function renderStructuredText(text: string, keyBase: string) {
  const blocks = normalizeMarkSchemePointLists(text)
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)

  if (blocks.length === 0) {
    return null
  }

  return (
    <div
      style={{
        display: 'grid',
        gap: '12px',
      }}
    >
      {blocks.map((block, index) => renderTextBlock(block, `${keyBase}-block-${index}`))}
    </div>
  )
}

export default function RichMessageContent({
  content,
  suppressDiagrams = false,
}: {
  content: string
  suppressDiagrams?: boolean
}) {
  const subject = inferSubject(content)
  const diagramType = matchDiagramType(content, subject)
  const isPlanningMessage = /Past Paper Analysis|Night Before|HIGH PRIORITY|MEDIUM PRIORITY|LOW PRIORITY/i.test(content)
  const shouldRenderDiagram = !suppressDiagrams && !isPlanningMessage && DIAGRAM_HINT_PATTERN.test(content) && diagramType !== 'unknown'

  return (
    <>
      {renderStructuredText(content, 'message')}
      {shouldRenderDiagram && (
        <DiagramRenderer
          hasDiagram
          diagramType={diagramType}
          subject={subject}
          topic={diagramType === 'energy_profile' ? 'Energetics' : diagramType}
          diagramDescription="Simple visual to help understand the answer."
        />
      )}
      <GraphDetector text={content} />
    </>
  )
}
