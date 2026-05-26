'use client'

import type { ReactNode } from 'react'
import DiagramRenderer from '@/components/diagrams/DiagramRenderer'
import GraphDetector from '@/components/graphs/GraphDetector'
import MathRenderer from '@/components/MathRenderer'
import { matchDiagramType } from '@/lib/diagrams/diagramMatcher'
import { detectAndWrapNotation } from '@/lib/notationDetector'

const SECTION_TITLE_PATTERN = /^[A-Za-z][A-Za-z0-9 /&()+-]{1,60}:$/
const QUESTION_TAG_PATTERN = /^\[[^\]]+\](?:\s+\[[^\]]+\])+$/u
const NUMBERED_LINE_PATTERN = /^\d+\.\s+/
const BULLET_LINE_PATTERN = /^[*-]\s+/
const OPTION_LINE_PATTERN = /^[A-Z]\.\s+/
const MARK_SCHEME_POINTS_PATTERN = /^(mark scheme points?|ms points?):\s*(.+)$/gim
const DIAGRAM_HINT_PATTERN =
  /\b(diagram|figure|sketch|draw|label|wave|wavelength|amplitude|circuit|resistor|ray|lens|triangle|energy profile|activation energy)\b/i

function inferSubject(content: string) {
  if (/\bphysics\b/i.test(content)) return 'Physics'
  if (/\bchemistry\b/i.test(content)) return 'Chemistry'
  if (/\bmath|mathematics|integral|differentiat|trigonometry|triangle|graph\b/i.test(content)) {
    return 'Mathematics'
  }
  return 'Physics'
}

function renderMathAwareText(text: string, keyBase: string) {
  return <MathRenderer key={keyBase} text={detectAndWrapNotation(text)} />
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

function renderParagraph(lines: string[], keyBase: string) {
  return (
    <div key={keyBase} style={{ display: 'grid', gap: '8px' }}>
      {lines.map((line, index) => (
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

export default function RichMessageContent({ content }: { content: string }) {
  const subject = inferSubject(content)
  const diagramType = matchDiagramType(content, subject)
  const isPlanningMessage = /Past Paper Analysis|Night Before|HIGH PRIORITY|MEDIUM PRIORITY|LOW PRIORITY/i.test(content)
  const shouldRenderDiagram = !isPlanningMessage && DIAGRAM_HINT_PATTERN.test(content) && diagramType !== 'unknown'

  return (
    <>
      {renderStructuredText(content, 'message')}
      {shouldRenderDiagram && (
        <DiagramRenderer
          hasDiagram
          diagramType={diagramType}
          subject={subject}
          topic={diagramType === 'energy_profile' ? 'Energetics' : diagramType}
          diagramDescription="Auto-generated fallback visual based on the answer text. Use the original source paper for exact exam artwork when available."
        />
      )}
      <GraphDetector text={content} />
    </>
  )
}
