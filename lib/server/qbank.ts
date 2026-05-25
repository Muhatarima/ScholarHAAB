import fs from 'node:fs'
import path from 'node:path'
import type { PromptMode } from '@/lib/products'
import type { SessionContext } from '@/lib/sessionContext'
import {
  getCompiledLatestQuestionYear,
  searchCompiledQbankQuestions,
  searchCompiledQbankRepeatGroups,
  searchCompiledQbankTopicFrequency,
  type CompiledQbankQuestionRow,
  type CompiledQbankRepeatGroup,
  type CompiledQbankTopicFrequency,
} from '@/lib/server/qbank-compiled-questions'
import { searchQbankPdfChunks } from '@/lib/server/qbank-pdf-chunks'
import {
  searchQbankBlockedRecovery,
  type QbankBlockedRecoveryMatch,
} from '@/lib/server/qbank-blocked-recovery'
import { searchQbankConcepts, type QbankConceptMatch } from '@/lib/server/qbank-concepts'
import { searchQbankGapStatuses } from '@/lib/server/qbank-gap-status'
import { searchNearbyQbankResources, searchQbankPaperPairs } from '@/lib/server/qbank-paper-pairs'
import { searchQbankPapers } from '@/lib/server/qbank-papers'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'
import { searchQbankSources } from '@/lib/server/qbank-sources'

type QbankSeedRow = {
  id: string
  record_type: 'qbank_topic' | 'qbank_question'
  board: string
  level: string
  subject: string
  chapter: string
  topic: string
  importance_score?: number
  repeat_years?: string[]
  exam_tips?: string[]
  summary?: string
  search_text?: string
  year?: number
  paper?: string
  question_label?: string
  question_text?: string
  answer_summary?: string
  method_steps?: string[]
  repeat_signal?: string
  source_label?: string
  source_url?: string | null
  answer_source_url?: string | null
  link_quality?: 'exact' | 'hierarchical' | 'unlinked' | 'unknown'
  link_score?: number
  link_confidence?: 'high' | 'medium' | 'low' | 'none'
  answer_ready?: boolean
}

export type QbankContextChunk = {
  id: string
  content: string
  sourceTitle: string
  sourceUrl: string | null
  tier: string
  lastChecked: string | null
  score: number
}

type TopicMatch = {
  id: string
  board: string
  level: string
  subject: string
  chapter: string
  topic: string
  importanceScore: number
  summary: string
  repeatYears: string[]
  examTips: string[]
  sourceLabel: string | null
  sourceUrl: string | null
  questionCount?: number
  totalFrequency?: number
}

type QuestionMatch = {
  id: string
  board: string
  level: string
  subject: string
  chapter: string
  topic: string
  year: number | null
  paper: string | null
  questionLabel: string | null
  questionText: string
  answerSummary: string
  methodSteps: string[]
  repeatSignal: string | null
  sourceLabel: string | null
  sourceUrl: string | null
  answerSourceUrl: string | null
  linkQuality: 'exact' | 'hierarchical' | 'unlinked' | 'unknown'
  linkScore: number
  linkConfidence: 'high' | 'medium' | 'low' | 'none'
  answerReady: boolean
  marks?: number | null
  questionType?: string | null
  options?: string[]
  solution?: string | null
  frequency?: number
  pageStart?: number | null
  pageEnd?: number | null
  sourcePdf?: string | null
}

export type QbankRepeatMatch = CompiledQbankRepeatGroup
export type QbankQueryClass =
  | 'GENERAL_KNOWLEDGE'
  | 'TOPIC_SEARCH'
  | 'PAPER_SEARCH'
  | 'CONCEPT_SEARCH'

function shouldDirectOverride(rawMessage: string) {
  return /\b(just tell me the answer|just the answer|direct mode|give me the answer directly)\b/i.test(
    rawMessage
  )
}

function shouldTutorScaffold(
  mode: PromptMode,
  rawMessage: string,
  sessionContext?: SessionContext | null
) {
  return (
    mode === 'tutor' &&
    !shouldDirectOverride(rawMessage) &&
    (sessionContext?.frustration_level ?? 0) < 2
  )
}

function isTutorFrustrated(mode: PromptMode, sessionContext?: SessionContext | null) {
  return mode === 'tutor' && (sessionContext?.frustration_level ?? 0) >= 2
}

function buildTutorScaffoldReply(lines: string[]) {
  return lines.join('\n')
}

function formatMonomialTerm(coefficient: number, power: number) {
  if (power === 0) {
    return String(coefficient)
  }

  const absCoefficient = Math.abs(coefficient)
  const sign = coefficient < 0 ? '-' : ''
  const coefficientPart = absCoefficient === 1 ? '' : String(absCoefficient)

  if (power === 1) {
    return `${sign}${coefficientPart}x`
  }

  return `${sign}${coefficientPart}x^${power}`
}

function formatIntegratedMonomial(coefficient: number, power: number) {
  const nextPower = power + 1
  if (coefficient % nextPower === 0) {
    return `${formatMonomialTerm(coefficient / nextPower, nextPower)} + C`
  }

  if (coefficient === 1) {
    return `\\frac{x^${nextPower}}{${nextPower}} + C`
  }

  return `\\frac{${coefficient}}{${nextPower}}x^${nextPower} + C`
}

type StemFormulaCard = {
  title: string
  formula: string
  explanation: string
  tip: string
  scaffoldQuestion: string
  scaffoldHint: string
  practicePrompt: string
  tutorLead?: string
}

function buildStemFormulaReply(
  mode: PromptMode,
  rawMessage: string,
  sessionContext: SessionContext | null | undefined,
  card: StemFormulaCard
) {
  if (shouldTutorScaffold(mode, rawMessage, sessionContext)) {
    return [
      `Acha, ${card.title.toLowerCase()} is one of those formulas you want to own properly.`,
      '',
      card.scaffoldQuestion,
      '',
      `Small hint: ${card.scaffoldHint}`,
      '',
      'Bolo, then I will take you through the full formula. Bujhecho?',
    ].join('\n')
  }

  if (isTutorFrustrated(mode, sessionContext)) {
    return [
      'Thik ache, let me just walk you through this together, step by step.',
      '',
      card.tutorLead ?? `The core formula for ${card.title.toLowerCase()} is:`,
      '',
      `$$${card.formula}$$`,
      '',
      card.explanation,
      '',
      `Practice next: ${card.practicePrompt}`,
    ].join('\n')
  }

  return [
    `The core formula for ${card.title.toLowerCase()} is:`,
    '',
    `$$${card.formula}$$`,
    '',
    card.explanation,
    '',
    `Exam tip: ${card.tip}`,
  ].join('\n')
}

function buildQbankClarifyingQuestion(parsed: QbankParsedQuery) {
  const needsBoardClarification =
    !parsed.board &&
    (parsed.intent === 'question_lookup' || parsed.intent === 'solve') &&
    Boolean(parsed.subject || parsed.level)

  if (needsBoardClarification) {
    const scope = [parsed.level, parsed.subject, parsed.topicHints[0]].filter(Boolean).join(' ')
    return scope
      ? `Did you mean Cambridge or Edexcel for this ${scope} request?`
      : 'Did you mean Cambridge or Edexcel for this question set?'
  }

  const needsYearClarification =
    parsed.board &&
    !parsed.year &&
    parsed.yearStart === null &&
    parsed.yearEnd === null &&
    parsed.intent === 'question_lookup' &&
    !parsed.wantsMostRepeated &&
    !parsed.wantsPrediction

  if (needsYearClarification) {
    const scope = [parsed.board, parsed.level, parsed.subject, parsed.topicHints[0], parsed.paper]
      .filter(Boolean)
      .join(' ')
    return scope
      ? `Which year do you want for ${scope}?`
      : `Which year do you want for ${parsed.board}?`
  }

  return null
}

function matchesPaperCode(questionPaper: string | null, pairPaperCode: string | null) {
  if (!questionPaper || !pairPaperCode) {
    return false
  }

  const left = questionPaper.toLowerCase()
  const right = pairPaperCode.toLowerCase()
  return left.includes(right) || right.includes(left)
}

function normalizeLoose(value: string | null | undefined) {
  return (value ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function compactText(text: string, maxChars = 220) {
  const compact = text.replace(/\s+/g, ' ').trim()
  if (compact.length <= maxChars) {
    return compact
  }

  return `${compact.slice(0, maxChars - 3).trim()}...`
}

function formatQbankScope(parsed: QbankParsedQuery) {
  const parts = [
    parsed.board,
    parsed.level,
    parsed.subject,
    parsed.year ? String(parsed.year) : null,
    parsed.paper,
  ].filter(Boolean)

  return parts.length > 0 ? parts.join(' ') : null
}

function buildConceptMemoryTip(match: QbankConceptMatch) {
  if (match.examTips.length > 0) {
    return match.examTips[0]
  }

  if (match.answerPatterns.length > 0) {
    return match.answerPatterns[0]
  }

  return null
}

function buildQuestionSupportLine(
  question: QuestionMatch,
  pair: QbankPaperPairMatch | null
) {
  const sourceBits = [
    question.sourceUrl ? 'question paper' : null,
    question.answerSourceUrl || pair?.markSchemeUrl ? 'mark scheme' : null,
    pair?.examinerReportUrl ? 'examiner report' : null,
  ].filter(Boolean)

  if (sourceBits.length === 0) {
    return null
  }

  return `Official support loaded: ${sourceBits.join(' + ')}.`
}

function buildMarkSchemeStatusLine(question: QuestionMatch) {
  if (question.linkQuality === 'exact') {
    return 'Mark-scheme status: exact official question-to-mark-scheme link loaded.'
  }

  if (question.linkQuality === 'hierarchical') {
    return `Mark-scheme status: partial official linkage only (${question.linkConfidence} confidence), so keep the method and wording close to the mark scheme.`
  }

  if (question.answerReady) {
    return 'Mark-scheme status: answer-ready summary found, but the exact official link is still not clean.'
  }

  return 'Mark-scheme status: exact official answer linkage is still limited, so use this as a guided solution and verify the final wording against the mark scheme.'
}

function buildQuestionFinalAnswer(
  question: QuestionMatch,
  usableAnswer: string | null,
  usableSolution: string | null
) {
  if (usableAnswer) {
    return usableAnswer
  }

  if (question.methodSteps.length > 0) {
    return question.methodSteps[question.methodSteps.length - 1] ?? question.methodSteps[0]
  }

  if (usableSolution) {
    return compactText(usableSolution, 220)
  }

  return 'The exact official final answer text is not fully clean in the current dataset yet, so treat this as a guided solve and verify against the mark scheme.'
}

function pushSection(lines: string[], title: string, sectionLines: Array<string | null | undefined>) {
  const normalizedLines = sectionLines
    .map((line) => (line ?? '').trim())
    .filter(Boolean)

  if (normalizedLines.length === 0) {
    return
  }

  if (lines.length > 0 && lines[lines.length - 1] !== '') {
    lines.push('')
  }

  lines.push(`${title}:`)
  lines.push(...normalizedLines)
}

function buildPaperResourceReply(
  context: Awaited<ReturnType<typeof retrieveQbankContext>>
) {
  const paper = context.paperMatches[0]
  const pair = context.paperPairMatches[0]

  if (!paper && !pair) {
    return null
  }

  const board = paper?.board ?? pair?.board ?? context.parsedQuery.board ?? 'This board'
  const level = paper?.level ?? pair?.level ?? context.parsedQuery.level ?? ''
  const subject = paper?.subject ?? pair?.subject ?? context.parsedQuery.subject ?? 'subject'
  const year = paper?.year ?? pair?.year ?? context.parsedQuery.year ?? 'that year'
  const paperLabel =
    paper?.paper ??
    (pair?.paperCode ? `Paper ${pair.paperCode}` : context.parsedQuery.paper ?? 'that paper')

  const lines = [
    `Paper identified: ${board} | ${level} ${subject} | ${year} | ${paperLabel}`.replace(
      /\s+/g,
      ' '
    ),
    '',
  ]

  const resources = [
    pair?.questionPaperUrl ? 'question paper' : null,
    pair?.markSchemeUrl ? 'mark scheme' : null,
    pair?.examinerReportUrl ? 'examiner report' : null,
    pair?.confidentialInstructionsUrl ? 'practical instructions' : null,
  ].filter(Boolean)

  if (resources.length > 0) {
    lines.push(`Available support: ${resources.join(', ')}.`)
  }

  if (paper?.focusTopics?.length) {
    lines.push('')
    lines.push('Top 3 topics from this paper:')
    paper.focusTopics.slice(0, 3).forEach((topic, index) => {
      lines.push(`${index + 1}. ${topic}`)
    })
  }

  const keyQuestionTypes = Array.from(
    new Set(
      context.questionMatches
        .map((match) => match.questionType)
        .filter((value): value is string => Boolean(value))
    )
  ).slice(0, 3)

  if (keyQuestionTypes.length > 0) {
    lines.push('')
    lines.push(`Key question types: ${keyQuestionTypes.join(', ')}.`)
  }

  lines.push(
    '',
    'If you want, I can now pull out the most important question styles from this paper and explain how to solve them.'
  )

  return lines.join('\n')
}

function formatQuestionTag(question: QuestionMatch) {
  return `[${question.board}] [${question.year ?? 'Unknown Year'}] [${question.topic}] [${
    question.marks ?? 'Marks unknown'
  }]`
}

function formatQuestionPreview(question: QuestionMatch) {
  return `${formatQuestionTag(question)} ${compactText(question.questionText, 180)}`
}

function getDistinctPaperLevels(
  paperMatches: Array<{ level: string }>,
  paperPairMatches: Array<{ level: string }>
) {
  return Array.from(
    new Set(
      [...paperMatches.map((row) => row.level), ...paperPairMatches.map((row) => row.level)].filter(
        Boolean
      )
    )
  )
}

function buildPaperLevelClarifier(
  context: Awaited<ReturnType<typeof retrieveQbankContext>>
) {
  if (!context.ambiguousPaperLevel) {
    return null
  }

  const options = getDistinctPaperLevels(context.paperMatches, context.paperPairMatches)
    .slice(0, 2)
    .map((level) => {
      const paper =
        context.paperMatches.find((row) => row.level === level) ??
        context.paperPairMatches.find((row) => row.level === level)

      if (!paper) {
        return level
      }

      const title = 'paperTitle' in paper ? paper.paperTitle : paper.paperCode ? `Paper ${paper.paperCode}` : 'paper'
      return `${level}: ${title}`
    })

  if (options.length === 0) {
    return null
  }

  return [
    `I found more than one ${formatQbankScope(context.parsedQuery) ?? 'paper'} track in the loaded data, so I need one quick clarification first:`,
    '',
    ...options.map((option, index) => `${index + 1}. ${option}`),
    '',
    `Which board or level do you mean: ${options.map((option) => option.split(':')[0]).join(' or ')}? If you know the year as well, send that too.`,
  ].join('\n')
}

function buildSimpleMathSolveReply(
  mode: PromptMode,
  rawMessage: string,
  sessionContext?: SessionContext | null
) {
  const normalized = rawMessage.toLowerCase().replace(/\s+/g, ' ').trim()
  const wantsDerivative = /\b(differentiate|derivative|differentation|differentiation|dy\/dx|diff)\b/.test(
    normalized
  )
  const wantsIntegration = /\b(integrate|integration|anti-derivative|antiderivative)\b/.test(
    normalized
  )

  if (!wantsDerivative && !wantsIntegration) {
    return null
  }

  const extracted = wantsDerivative
    ? normalized
        .replace(/^.*?(differentiate|derivative of|dy\/dx|diff)\s*/i, '')
        .replace(/^y\s*=\s*/i, '')
        .trim()
    : normalized
        .replace(/^.*?(integrate|integration of|anti-derivative of|antiderivative of)\s*/i, '')
        .trim()

  if (wantsIntegration) {
    const directIntegrals: Array<{
      pattern: RegExp
      expression: string
      integral: string
      rule: string
      tip: string
    }> = [
      {
        pattern: /^(sinx|sin x)$/,
        expression: 'sin x',
        integral: '-\\cos x + C',
        rule: '\\int \\sin x \\, dx = -\\cos x + C',
        tip: 'Differentiate your final answer to check the sign.',
      },
      {
        pattern: /^(cosx|cos x)$/,
        expression: 'cos x',
        integral: '\\sin x + C',
        rule: '\\int \\cos x \\, dx = \\sin x + C',
        tip: 'Do not drop the constant of integration in an exam solution.',
      },
      {
        pattern: /^(e\^x|e x|exp\(x\))$/,
        expression: 'e^x',
        integral: 'e^x + C',
        rule: '\\int e^x \\, dx = e^x + C',
        tip: 'This is one of the cleanest integrals because the function stays the same.',
      },
      {
        pattern: /^(1\/x|1 \/ x|one over x)$/,
        expression: '\\frac{1}{x}',
        integral: '\\ln |x| + C',
        rule: '\\int \\frac{1}{x} \\, dx = \\ln |x| + C',
        tip: 'Use ln|x|, not just ln x, because x can be negative.',
      },
    ]

    for (const entry of directIntegrals) {
      if (!entry.pattern.test(extracted)) {
        continue
      }

      if (shouldTutorScaffold(mode, rawMessage, sessionContext)) {
        return buildTutorScaffoldReply([
          'Acha, this is a standard integral and very scoreable.',
          '',
          `Tell me first: if you differentiate ${entry.integral.replace(/\s*\+\s*C$/, '')}, what do you get?`,
          '',
          `Hint: memorize the standard rule $$${entry.rule}$$`,
          '',
          'Bolo, then I will guide the next step. Bujhecho?',
        ])
      }

      if (isTutorFrustrated(mode, sessionContext)) {
        return [
          'Thik ache, let me just walk you through this together, step by step.',
          '',
          `You want to integrate $${entry.expression}$.`,
          `Use the standard rule: $$${entry.rule}$$`,
          '',
          'So the result is:',
          `$$\\int ${entry.expression} \\, dx = ${entry.integral}$$`,
          '',
          `Memory tip: ${entry.tip}`,
        ].join('\n')
      }

      return [
        `To integrate $${entry.expression}$, use the standard rule:`,
        `$$${entry.rule}$$`,
        '',
        'Final answer:',
        `$$\\int ${entry.expression} \\, dx = ${entry.integral}$$`,
        '',
        `Memory tip: ${entry.tip}`,
      ].join('\n')
    }
  }

  const directPatterns: Array<{
    pattern: RegExp
    expression: string
    derivative: string
    rule: string
    tip: string
  }> = [
    {
      pattern: /^(sinx|sin x)$/,
      expression: 'sin x',
      derivative: '\\cos x',
      rule: '\\frac{d}{dx}(\\sin x) = \\cos x',
      tip: 'For basic trig derivatives: sin -> cos, cos -> -sin, tan -> sec^2.',
    },
    {
      pattern: /^(cosx|cos x)$/,
      expression: 'cos x',
      derivative: '-\\sin x',
      rule: '\\frac{d}{dx}(\\cos x) = -\\sin x',
      tip: 'Watch the minus sign. That is the usual place students drop marks.',
    },
    {
      pattern: /^(tanx|tan x)$/,
      expression: 'tan x',
      derivative: '\\sec^2 x',
      rule: '\\frac{d}{dx}(\\tan x) = \\sec^2 x',
      tip: 'Do not write sec x. It must be sec squared x.',
    },
    {
      pattern: /^(e\^x|e x|exp\(x\))$/,
      expression: 'e^x',
      derivative: 'e^x',
      rule: '\\frac{d}{dx}(e^x) = e^x',
      tip: 'This is one of the few functions whose derivative stays the same.',
    },
    {
      pattern: /^(lnx|ln x|logx|log x)$/,
      expression: 'ln x',
      derivative: '\\frac{1}{x}',
      rule: '\\frac{d}{dx}(\\ln x) = \\frac{1}{x}',
      tip: 'Keep the domain in mind: ln x only works for x > 0.',
    },
  ]

  for (const entry of directPatterns) {
    if (!wantsDerivative) {
      continue
    }

    if (!entry.pattern.test(extracted)) {
      continue
    }

    if (shouldTutorScaffold(mode, rawMessage, sessionContext)) {
      return buildTutorScaffoldReply([
        'Acha, differentiation eta khub common and very scoreable.',
        '',
        `Before I give the full step, tell me this: what does $\\frac{dy}{dx}$ represent here?`,
        '',
        `Tiny hint: for trig functions, you should memorize the standard rule $${entry.rule}$`,
        '',
        `Bolo, then I will guide you to the next part. Bujhecho?`,
      ])
    }

    if (isTutorFrustrated(mode, sessionContext)) {
      return [
        'Thik ache, let me just walk you through this together, step by step.',
        '',
        `You want the derivative of $y = ${entry.expression}$.`,
        `Use the standard rule: $$${entry.rule}$$`,
        '',
        `So the result is:`,
        `$$\\frac{dy}{dx} = ${entry.derivative}$$`,
        '',
        `Practice next: what is $\\frac{d}{dx}(\\cos x)$?`,
      ].join('\n')
    }

    if (mode === 'tutor') {
      return [
        `Let us do it step by step.`,
        '',
        `You want the derivative of $y = ${entry.expression}$.`,
        '',
        `1. Recall the standard rule: $$${entry.rule}$$`,
        `2. Apply it directly to the given function.`,
        `3. So the derivative is:`,
        `$$\\frac{dy}{dx} = ${entry.derivative}$$`,
        '',
        `Memory tip: ${entry.tip}`,
      ].join('\n')
    }

    return [
      `The derivative of $y = ${entry.expression}$ is straightforward.`,
      '',
      `Use the standard rule: $$${entry.rule}$$`,
      '',
      `Final answer:`,
      `$$\\frac{dy}{dx} = ${entry.derivative}$$`,
      '',
      `Memory tip: ${entry.tip}`,
    ].join('\n')
  }

  const monomialMatch = extracted.match(/^([0-9]+)?x(?:\^?([0-9]+))?$/)

  if (monomialMatch) {
    const coefficient = monomialMatch[1] ? Number(monomialMatch[1]) : 1
    const power = monomialMatch[2] ? Number(monomialMatch[2]) : 1
    const derivative = formatMonomialTerm(coefficient * power, power - 1)
    const integrated = formatIntegratedMonomial(coefficient, power)

    if (wantsIntegration) {
      if (shouldTutorScaffold(mode, rawMessage, sessionContext)) {
        return buildTutorScaffoldReply([
          'Bhalo, this is a power-rule integral.',
          '',
          'Tell me first: when you integrate $x^n$, what happens to the power?',
          '',
          'Hint: use $\\int x^n \\, dx = \\frac{x^{n+1}}{n+1} + C$ for $n \\neq -1$.',
          '',
          `Try it for $${formatMonomialTerm(coefficient, power)}$, then I will confirm it. Bujhecho?`,
        ])
      }

      if (isTutorFrustrated(mode, sessionContext)) {
        return [
          'Thik ache, let me just walk you through this together, step by step.',
          '',
          'Start from the power rule:',
          '$$\\int x^n \\, dx = \\frac{x^{n+1}}{n+1} + C$$',
          `Here the term is $${formatMonomialTerm(coefficient, power)}$.`,
          '',
          'So the answer is:',
          `$$\\int ${formatMonomialTerm(coefficient, power)} \\, dx = ${integrated}$$`,
          '',
          'Memory tip: add 1 to the power, then divide by that new power.',
        ].join('\n')
      }

      return [
        'Use the integration power rule here.',
        '',
        '$$\\int x^n \\, dx = \\frac{x^{n+1}}{n+1} + C$$',
        '',
        `So for $${formatMonomialTerm(coefficient, power)}$:`,
        `$$\\int ${formatMonomialTerm(coefficient, power)} \\, dx = ${integrated}$$`,
        '',
        'Memory tip: add 1 to the power, then divide by that new power.',
      ].join('\n')
    }

    if (shouldTutorScaffold(mode, rawMessage, sessionContext)) {
      return buildTutorScaffoldReply([
        'Bhalo, this is a power-rule question.',
        '',
        `Tell me first: if you differentiate $x^3$, what happens to the power?`,
        '',
        `Hint: use $\\frac{d}{dx}(x^n) = nx^{n-1}$.`,
        '',
        `Try this one, then I will help with $x^${power}$. Bujhecho?`,
      ])
    }

    if (isTutorFrustrated(mode, sessionContext)) {
      return [
        'Thik ache, let me just walk you through this together, step by step.',
        '',
        `Start from the power rule: $\\frac{d}{dx}(x^n) = nx^{n-1}$.`,
        `Here $n = ${power}$.`,
        '',
        `So the answer is:`,
        `$$\\frac{d}{dx}(x^{${power}}) = ${derivative}$$`,
        '',
        `Practice next: what is $\\frac{d}{dx}(x^{${power + 1}})$?`,
      ].join('\n')
    }

    if (mode === 'tutor') {
      return [
        `Use the power rule here.`,
        '',
        `1. Start from the rule $\\frac{d}{dx}(x^n) = nx^{n-1}$.`,
        `2. Here $n = ${power}$.`,
        `3. Apply it directly:`,
        `$$\\frac{d}{dx}(x^{${power}}) = ${derivative}$$`,
        '',
        `Memory tip: bring the power down, then reduce the power by 1.`,
      ].join('\n')
    }

    return [
      `Use the power rule for this one.`,
      '',
      `Since $\\frac{d}{dx}(x^n) = nx^{n-1}$, we get:`,
      `$$\\frac{d}{dx}(x^{${power}}) = ${derivative}$$`,
      '',
      `Memory tip: bring the power down, then reduce the power by 1.`,
    ].join('\n')
  }

  return null
}

export function buildQbankGeneralKnowledgeReply(
  mode: PromptMode,
  rawMessage: string,
  sessionContext?: SessionContext | null
) {
  const simpleSolve = buildSimpleMathSolveReply(mode, rawMessage, sessionContext)
  if (simpleSolve) {
    return simpleSolve
  }

  const normalized = rawMessage.toLowerCase().replace(/\s+/g, ' ').trim()
  if (/\bintegration by parts\b/.test(normalized)) {
    if (shouldTutorScaffold(mode, rawMessage, sessionContext)) {
      return [
        'Acha, integration by parts onek student-er first e awkward lage.',
        '',
        'Tell me this first: when you see two things multiplied inside an integral, which part would you choose as $u$?',
        '',
        'Small hint: choose the part that becomes simpler after differentiation.',
        '',
        'Bolo, then I will help you set up the full method. Bujhecho?',
      ].join('\n')
    }

    if (isTutorFrustrated(mode, sessionContext)) {
      return [
        'Thik ache, let me just walk you through this together, step by step.',
        '',
        'Integration by parts is used when an integral contains two multiplied parts.',
        `The core formula is:`,
        `$$\\int u \\, dv = uv - \\int v \\, du$$`,
        '',
        'Choose $u$ as the part that becomes simpler after differentiation, and choose $dv$ as the part you can integrate easily.',
        '',
        'Practice next: try choosing $u$ and $dv$ for $\\int x e^x \\, dx$.',
      ].join('\n')
    }

    return [
      `Integration by parts is the method you use when an integral has two multiplied parts.`,
      '',
      `The core formula is:`,
      `$$\\int u \\, dv = uv - \\int v \\, du$$`,
      '',
      `Choose $u$ as the part that becomes simpler when differentiated, and let $dv$ be the part that is easier to integrate.`,
      '',
      mode === 'tutor'
        ? `If you want, I can now solve one easy example like $\\int x e^x \\, dx$ step by step.`
        : `Exam tip: always write down $u$, $dv$, $du$, and $v$ clearly before expanding the final line.`,
    ].join('\n')
  }

  if (/\bvector(s)?\b/.test(normalized) && /\b(help|understand|explain|teach)\b/.test(normalized)) {
    if (shouldTutorScaffold(mode, rawMessage, sessionContext)) {
      return [
        'Acha, vectors niye confused howa khub normal.',
        '',
        'Tell me first: what is the difference between a scalar and a vector?',
        '',
        'Tiny hint: one of them has only size, the other has size plus direction.',
        '',
        'Bolo, then I will build the topic from there. Bujhecho?',
      ].join('\n')
    }

    return [
      `Vectors are quantities that have both magnitude and direction.`,
      '',
      `A scalar only has magnitude, like mass or temperature. A vector has magnitude plus direction, like velocity or force.`,
      '',
      `The first thing to remember is this: if two vectors are equal, both the size and the direction must match.`,
      '',
      `If you want, I can teach vectors from zero with one very easy example next.`,
    ].join('\n')
  }

  if (
    /\bif all\b/.test(normalized) &&
    /\bare\b/.test(normalized) &&
    /\ball dogs are mammals\b/.test(normalized) &&
    /\ball mammals are animals\b/.test(normalized)
  ) {
    return [
      'Yes, dogs are animals.',
      '',
      'Reason: all dogs are mammals, and all mammals are animals.',
      'Therefore dogs must also be animals.',
      '',
      mode === 'tutor'
        ? 'This is a simple chain rule: if A is inside B, and B is inside C, then A is inside C.'
        : 'This is a valid logical deduction because the category chain stays consistent all the way through.',
    ].join('\n')
  }

  if (/\bideal gas( formula| equation| law)?\b/.test(normalized)) {
    return buildStemFormulaReply(mode, rawMessage, sessionContext, {
      title: 'ideal gas law',
      formula: 'PV = nRT',
      explanation:
        'Here $P$ means pressure, $V$ means volume, $n$ is number of moles, $R$ is the gas constant, and $T$ is temperature in kelvin.',
      tip: 'Convert temperature to kelvin before substituting values.',
      scaffoldQuestion: 'Before I give the full line, can you tell me what the $P$ in gas equations usually stands for?',
      scaffoldHint: 'The full relation connects pressure, volume, moles, and temperature.',
      practicePrompt: 'if temperature rises while $n$ and $V$ stay fixed, what happens to $P$?',
    })
  }

  if (/\bohm'?s law\b|\bohms law\b|\bvoltage formula\b|\bcurrent formula\b|\bresistance formula\b/.test(normalized)) {
    return buildStemFormulaReply(mode, rawMessage, sessionContext, {
      title: "Ohm's law",
      formula: 'V = IR',
      explanation:
        'Voltage equals current times resistance, so you can rearrange it to $I = \\frac{V}{R}$ or $R = \\frac{V}{I}$ when needed.',
      tip: 'Write the core form $V = IR$ first, then rearrange only if the question asks for current or resistance.',
      scaffoldQuestion: 'Before I give the full line, what quantity does the symbol $I$ represent in electricity?',
      scaffoldHint: 'This formula links voltage, current, and resistance.',
      practicePrompt: 'if $V = 12$ V and $R = 4 \\Omega$, what is the current?',
    })
  }

  if (/\bkinetic energy( formula| equation)?\b/.test(normalized)) {
    return buildStemFormulaReply(mode, rawMessage, sessionContext, {
      title: 'kinetic energy',
      formula: 'E_k = \\frac{1}{2}mv^2',
      explanation:
        'Here $m$ is mass and $v$ is speed. The square on $v$ is why speed changes have a big effect on kinetic energy.',
      tip: 'If speed doubles, kinetic energy becomes four times larger because of the $v^2$ term.',
      scaffoldQuestion: 'Before I give the full line, which variable in energy formulas usually stands for speed?',
      scaffoldHint: 'This formula depends on mass and the square of velocity.',
      practicePrompt: 'what happens to kinetic energy if speed doubles but mass stays the same?',
    })
  }

  if (/\bmomentum( formula| equation)?\b/.test(normalized)) {
    return buildStemFormulaReply(mode, rawMessage, sessionContext, {
      title: 'momentum',
      formula: 'p = mv',
      explanation: 'Momentum equals mass times velocity, so heavier or faster objects have more momentum.',
      tip: 'Momentum is a vector quantity, so direction matters as well as size.',
      scaffoldQuestion: 'Before I give the full line, what two things combine to describe momentum?',
      scaffoldHint: 'Think about mass and motion together.',
      practicePrompt: 'if mass stays the same and speed doubles, what happens to momentum?',
    })
  }

  if (/\bdensity( formula| equation)?\b/.test(normalized)) {
    return buildStemFormulaReply(mode, rawMessage, sessionContext, {
      title: 'density',
      formula: '\\rho = \\frac{m}{V}',
      explanation: 'Density is mass per unit volume, so the same mass packed into less volume gives a higher density.',
      tip: 'Keep units consistent, such as kg m^{-3} or g cm^{-3}, before comparing answers.',
      scaffoldQuestion: 'Before I give the full line, what happens to density if mass stays fixed but volume gets smaller?',
      scaffoldHint: 'Density tells you how tightly matter is packed.',
      practicePrompt: 'if an object has 20 g mass and volume 5 cm^3, what is its density?',
    })
  }

  if (/\bmole( formula| equation)?\b|\bnumber of moles\b/.test(normalized)) {
    return buildStemFormulaReply(mode, rawMessage, sessionContext, {
      title: 'number of moles',
      formula: 'n = \\frac{m}{M}',
      explanation:
        'Here $n$ is number of moles, $m$ is mass, and $M$ is molar mass. This is the starting formula for many stoichiometry questions.',
      tip: 'Make sure mass and molar mass use compatible units, usually grams and g mol^{-1}.',
      scaffoldQuestion: 'Before I give the full line, what does the symbol $n$ usually stand for in chemistry?',
      scaffoldHint: 'This formula connects mass and molar mass.',
      practicePrompt: 'if a sample has mass 18 g and molar mass 18 g mol^{-1}, how many moles is it?',
    })
  }

  if (/\bconcentration( formula| equation)?\b/.test(normalized)) {
    return buildStemFormulaReply(mode, rawMessage, sessionContext, {
      title: 'concentration',
      formula: 'c = \\frac{n}{V}',
      explanation:
        'Concentration is moles of solute per unit volume of solution, so divide the amount in moles by the volume in dm^3.',
      tip: 'Convert volume into dm^3 before substituting if the question gives the volume in cm^3.',
      scaffoldQuestion: 'Before I give the full line, what unit is volume usually converted to for concentration calculations?',
      scaffoldHint: 'Cambridge and Edexcel usually want volume in dm^3 here.',
      practicePrompt: 'if $n = 0.5$ mol and $V = 0.25$ dm^3, what is the concentration?',
    })
  }

  if (/\bstoichiometry\b/.test(normalized) && /\b(what is|explain|help|understand|teach)\b/.test(normalized)) {
    return [
      'Stoichiometry is the part of chemistry where you use the balanced equation to compare amounts of reactants and products.',
      '',
      'The key idea is the mole ratio. Once the equation is balanced, the coefficients tell you how many moles of one substance react with or produce another.',
      '',
      'Exam tip: always balance the equation first, then convert everything into moles before using the ratio.',
    ].join('\n')
  }

  if (/\bequilibrium\b/.test(normalized) && /\b(what is|explain|help|understand|teach)\b/.test(normalized)) {
    return [
      'Dynamic equilibrium is the state where the forward and backward reactions continue, but at the same rate.',
      '',
      'That means the amounts of reactants and products stay constant even though particles are still reacting.',
      '',
      'Exam tip: do not say the reactions stop. In equilibrium, both directions are still happening.',
    ].join('\n')
  }

  if (/\belectrolysis\b/.test(normalized) && /\b(what is|explain|help|understand|teach)\b/.test(normalized)) {
    return [
      'Electrolysis is the decomposition of an ionic compound using electricity.',
      '',
      'Positive ions move to the cathode and gain electrons, while negative ions move to the anode and lose electrons.',
      '',
      'Exam tip: always say which ion goes to which electrode and whether it is oxidized or reduced.',
    ].join('\n')
  }

  return null
}

function pickBestPaperPair(
  question: QuestionMatch,
  paperPairMatches: QbankPaperPairMatch[]
) {
  return (
    paperPairMatches.find(
      (pair) =>
        normalizeLoose(pair.subject) === normalizeLoose(question.subject) &&
        normalizeLoose(pair.level) === normalizeLoose(question.level) &&
        normalizeLoose(pair.board) === normalizeLoose(question.board) &&
        (!question.year || pair.year === question.year) &&
        (!question.paper || !pair.paperCode || matchesPaperCode(question.paper, pair.paperCode))
    ) ?? null
  )
}

function pickBestPaperMatch(
  question: QuestionMatch,
  paperMatches: Array<{
    board: string
    level: string
    subject: string
    year: number | null
    paper: string
    sourceUrl: string | null
  }>
) {
  return (
    paperMatches.find(
      (paper) =>
        normalizeLoose(paper.subject) === normalizeLoose(question.subject) &&
        normalizeLoose(paper.level) === normalizeLoose(question.level) &&
        normalizeLoose(paper.board) === normalizeLoose(question.board) &&
        (!question.year || paper.year === question.year) &&
        (!question.paper || normalizeLoose(paper.paper).includes(normalizeLoose(question.paper)))
    ) ?? null
  )
}

function enrichQuestionMatch(
  question: QuestionMatch,
  paperPairMatches: QbankPaperPairMatch[],
  paperMatches: Array<{
    board: string
    level: string
    subject: string
    year: number | null
    paper: string
    sourceUrl: string | null
  }>
): QuestionMatch {
  const pair = pickBestPaperPair(question, paperPairMatches)
  const paper = pickBestPaperMatch(question, paperMatches)

  return {
    ...question,
    sourceUrl: question.sourceUrl ?? pair?.questionPaperUrl ?? paper?.sourceUrl ?? null,
    answerSourceUrl:
      question.answerSourceUrl ??
      pair?.markSchemeUrl ??
      pair?.specimenMarkSchemeUrl ??
      null,
    answerReady:
      question.answerReady ||
      Boolean(question.answerSummary && (question.answerSourceUrl || pair?.markSchemeUrl)),
  }
}

export function buildQbankGroundedReply(
  mode: PromptMode,
  context: Awaited<ReturnType<typeof retrieveQbankContext>>,
  sessionContext?: SessionContext | null
) {
  const paperLevelClarifier = buildPaperLevelClarifier(context)
  if (paperLevelClarifier) {
    return paperLevelClarifier
  }

  const clarifyingQuestion = buildQbankClarifyingQuestion(context.parsedQuery)
  if (clarifyingQuestion) {
    return clarifyingQuestion
  }

  const scope = formatQbankScope(context.parsedQuery)
  const topQuestion = context.questionMatches[0]
  const topConcept = context.conceptMatches[0]
  const paperResourceReply =
    !topQuestion && context.parsedQuery.queryClass === 'PAPER_SEARCH'
      ? buildPaperResourceReply(context)
      : null
  const topGap = context.gapMatches[0]
  const topRecovery = context.blockedRecoveryMatches[0]
  const topNearby = context.nearbyResourceMatches[0]
  const topRepeatMatches = context.repeatMatches.slice(0, 3)
  const preferConcept =
    context.parsedQuery.intent === 'formula_lookup' ||
    context.parsedQuery.intent === 'concept_lookup'

  if (paperResourceReply) {
    if (shouldTutorScaffold(mode, context.parsedQuery.raw, sessionContext)) {
      return [
        'Acha, I found the paper track.',
        '',
        `Before I break it down, tell me this: which part worries you most - the topic, the question style, or time pressure in the paper?`,
        '',
        'Once you tell me that, I will guide you like an older brother instead of dumping the whole paper at once. Bujhecho?',
      ].join('\n')
    }

    return paperResourceReply
  }

  if (topConcept && preferConcept) {
    if (shouldTutorScaffold(mode, context.parsedQuery.raw, sessionContext)) {
      return [
        `Acha, ${topConcept.topic} is important and very learnable.`,
        '',
        `Tell me first: what part of ${topConcept.topic} feels confusing right now?`,
        '',
        `Small hint: ${topConcept.conceptSummary}`,
        '',
        'Bolo, then I will guide the next step. Bujhecho?',
      ].join('\n')
    }

    const lines: string[] = []

    if (topConcept.formulaCandidates.length > 0) {
      lines.push(
        `The formula you should remember first is ${topConcept.formulaCandidates
          .slice(0, 2)
          .map((formula) => `$${formula}$`)
          .join(' or ')}.`
      )
      lines.push('')
    }

    lines.push(
      scope
        ? `For ${scope}, the clean idea is ${topConcept.topic}.`
        : `The key idea here is ${topConcept.topic}.`
    )
    lines.push('')
    lines.push(topConcept.conceptSummary)

    if (topConcept.examTips.length > 0) {
      lines.push('')
      lines.push(`Exam tip: ${topConcept.examTips[0]}`)
    }

    if (mode === 'tutor') {
      lines.push('')
      lines.push('If you want, I can turn this into one worked example next.')
    }

    return lines.join('\n')
  }

  if (
    topRepeatMatches.length > 0 &&
    (context.parsedQuery.wantsMostRepeated ||
      context.parsedQuery.wantsPrediction ||
      context.parsedQuery.intent === 'topic_review')
  ) {
    if (shouldTutorScaffold(mode, context.parsedQuery.raw, sessionContext)) {
      return [
        'Acha, this is a smart exam strategy question.',
        '',
        "Based on past papers, I can rank the recurring topics for you - but tell me first: are you asking because your exam is close, or because one chapter still feels weak?",
        '',
        `Small hint: ${topRepeatMatches[0].topic} is near the top of the list.`,
        '',
        'Bolo, then I will guide your revision plan properly. Bujhecho?',
      ].join('\n')
    }

    const lines = [
      "Based on past papers, here's the frequency breakdown:",
      '',
    ]

    if (scope) {
      lines.push(`Scope: ${scope}`)
      lines.push('')
    }

    topRepeatMatches.forEach((match, index) => {
      lines.push(
        `${index + 1}. ${match.topic}: ${match.frequency} repeated pattern${match.frequency === 1 ? '' : 's'} across ${match.years.join(', ')}.`
      )
    })

    if (topRepeatMatches[0]) {
      lines.push('')
      lines.push(`Highest weight topic: ${topRepeatMatches[0].topic}. If you are short on time, revise this first.`)
    }

    if (context.questionMatches.length > 0 && context.parsedQuery.queryClass === 'TOPIC_SEARCH') {
      lines.push('')
      lines.push('Good example questions to revise after that:')
      context.questionMatches.slice(0, 3).forEach((match, index) => {
        lines.push(`${index + 1}. ${formatQuestionPreview(match)}`)
      })
    }

    lines.push('')
    lines.push('Exam tip: prioritize the top one first, then revise the next two with mark-scheme language.')
    return lines.join('\n')
  }

  if (
    context.parsedQuery.queryClass === 'PAPER_SEARCH' &&
    /\bimportant|repeat|repeats|likely|focus\b/.test(context.parsedQuery.normalized)
  ) {
    if (shouldTutorScaffold(mode, context.parsedQuery.raw, sessionContext)) {
      return [
        'Acha, paper-based revision is the right move.',
        '',
        'Before I shortlist the most important areas, tell me: do you want likely topics, hard questions, or the fastest-scoring parts first?',
        '',
        'Once you choose one, I will guide the paper strategy properly. Bujhecho?',
      ].join('\n')
    }

    const lines: string[] = [
      scope
        ? `For ${scope}, these are the strongest paper-linked areas I can justify from the loaded data:`
        : 'These are the strongest paper-linked areas I can justify from the loaded data:',
      '',
    ]

    const focusTopics = context.paperMatches[0]?.focusTopics?.slice(0, 3) ?? []
    if (focusTopics.length > 0) {
      focusTopics.forEach((topic, index) => {
        lines.push(`${index + 1}. ${topic}`)
      })
    } else if (context.questionMatches.length > 0) {
      context.questionMatches.slice(0, 3).forEach((match, index) => {
        lines.push(`${index + 1}. ${formatQuestionPreview(match)}`)
      })
    } else if (context.conceptMatches.length > 0) {
      context.conceptMatches.slice(0, 3).forEach((match, index) => {
        lines.push(`${index + 1}. ${match.topic}`)
      })
    } else if (context.paperMatches.length > 0) {
      lines.push(
        `I have the paper match loaded, but I do not have enough clean question-level extraction yet to rank the top exact questions confidently.`
      )
      lines.push(
        `The closest paper I can support is ${context.paperMatches[0].board} ${context.paperMatches[0].level} ${context.paperMatches[0].subject} ${context.paperMatches[0].year ?? ''} ${context.paperMatches[0].paper}.`
      )
    }

    if (context.questionMatches.length > 0) {
      lines.push('')
      lines.push('If you want, I can solve one of these in full next.')
    }

    return lines.join('\n')
  }

  if (topQuestion) {
    const pair = pickBestPaperPair(topQuestion, context.paperPairMatches)
    const supportLine = buildQuestionSupportLine(topQuestion, pair)
    const shouldListMultiple =
      context.questionMatches.length > 1 &&
      (context.parsedQuery.wantsSimilar ||
        context.parsedQuery.yearStart !== null ||
        context.parsedQuery.yearEnd !== null ||
        (context.parsedQuery.intent === 'question_lookup' && !context.parsedQuery.paper))
    const usableSolution =
      topQuestion.solution && topQuestion.solution.length <= 420
        ? topQuestion.solution
        : null
    const usableAnswer =
      topQuestion.answerSummary && topQuestion.answerSummary.length <= 220
        ? topQuestion.answerSummary
        : null
    const finalAnswer = buildQuestionFinalAnswer(topQuestion, usableAnswer, usableSolution)
    const markSchemeStatus = buildMarkSchemeStatusLine(topQuestion)

    if (shouldListMultiple) {
      const lines = [
        scope
          ? `For ${scope}, these are the clearest question matches I can show you first:`
          : 'These are the clearest question matches I can show you first:',
        '',
      ]

      context.questionMatches.slice(0, 3).forEach((match, index) => {
        lines.push(`${index + 1}. ${formatQuestionPreview(match)}`)
      })

      lines.push('')
      lines.push('Tell me which one you want solved first, and I will do it step by step.')
      return lines.join('\n')
    }

    const lines: string[] = [formatQuestionTag(topQuestion)]

    pushSection(lines, 'Question', [
      topQuestion.questionText || 'Exact question text is limited in the current extraction.',
    ])

    if (topQuestion.options && topQuestion.options.length > 0) {
      pushSection(lines, 'Options', topQuestion.options)
    }

    if (mode === 'tutor' && shouldTutorScaffold(mode, context.parsedQuery.raw, sessionContext)) {
      return [
        `Acha, I found a strong question match in ${topQuestion.topic}.`,
        '',
        `Before I solve it, tell me this: which step would you try first?`,
        '',
        `Small hint: ${topQuestion.methodSteps[0] ?? usableAnswer ?? 'start by identifying what the question is really asking.'}`,
        '',
        'Try that first, then I will take you to the next step. Bujhecho?',
      ].join('\n')
    }

    if (mode === 'tutor') {
      const tutorLines: string[] = []
      if (topQuestion.methodSteps.length > 0) {
        tutorLines.push(`1. ${topQuestion.methodSteps[0]}`)
        if (topQuestion.methodSteps[1]) {
          tutorLines.push(`2. Then move to: ${topQuestion.methodSteps[1]}`)
        }
      } else if (usableAnswer) {
        tutorLines.push(usableAnswer)
      } else {
        tutorLines.push('Send the exact full question text or screenshot and I will walk through it step by step.')
      }

      pushSection(lines, 'Tutor path', tutorLines)
      pushSection(lines, 'Mark-scheme focus', [
        supportLine ?? 'Keep each step explicit and write the key result in clean exam language.',
        markSchemeStatus,
      ])
    } else {
      pushSection(lines, 'Final answer', [finalAnswer])

      if (topQuestion.methodSteps.length > 0) {
        pushSection(
          lines,
          'Step-by-step working',
          topQuestion.methodSteps.slice(0, 5).map((step, index) => `${index + 1}. ${step}`)
        )
      } else if (usableSolution) {
        pushSection(lines, 'Step-by-step working', [usableSolution])
      }

      pushSection(lines, 'Why this scores', [
        supportLine ?? 'Write the core result clearly, show the method, and keep the wording close to the marking points.',
        markSchemeStatus,
      ])
    }

    if (topQuestion.frequency && topQuestion.frequency > 1) {
      pushSection(lines, 'Repeat signal', [
        `This question pattern appears ${topQuestion.frequency} times in the compiled dataset.`,
      ])
    }

    return lines.join('\n')
  }

  if (topConcept) {
    if (shouldTutorScaffold(mode, context.parsedQuery.raw, sessionContext)) {
      return [
        `Acha, let us build ${topConcept.topic} gently.`,
        '',
        `Tell me first: what do you already know about ${topConcept.topic}? Even one line is enough.`,
        '',
        `Small hint: ${topConcept.conceptSummary}`,
        '',
        'Bolo, then I will guide the next step. Bujhecho?',
      ].join('\n')
    }

    const lines = [
      scope ? `For ${scope}, this is the concept I would focus on:` : `This is the concept I would focus on first:`,
      '',
      topConcept.conceptSummary,
    ]

    if (topConcept.formulaCandidates.length > 0) {
      lines.push('')
      lines.push(`Formula: ${topConcept.formulaCandidates.slice(0, 3).join(' | ')}`)
    }

    if (topConcept.examTips.length > 0) {
      lines.push(`Exam tip: ${topConcept.examTips[0]}`)
    }

    if (mode === 'tutor') {
      lines.push('')
      lines.push('If you want, I can now show one exam-style example using this.')
    }

    return lines.join('\n')
  }

  if (topRecovery || topGap || topNearby) {
    const nearbyText = topNearby
      ? `Nearest official fallback I can see: ${topNearby.title}.`
      : null
    const blockText = topRecovery
      ? `That exact file is officially listed, but the source is blocking direct access right now.`
      : topGap
        ? `I do not have the exact requested file cleanly loaded yet.`
        : null

    return [blockText, nearbyText, 'If you want, I can use the nearest official alternative instead of guessing.']
      .filter(Boolean)
      .join('\n')
  }

  return null
}

export function buildQbankOfflineReply(
  mode: PromptMode,
  context: Awaited<ReturnType<typeof retrieveQbankContext>>,
  sessionContext?: SessionContext | null
) {
  const clarifyingQuestion = buildQbankClarifyingQuestion(context.parsedQuery)
  if (clarifyingQuestion) {
    return clarifyingQuestion
  }

  const simpleSolve = buildSimpleMathSolveReply(mode, context.parsedQuery.raw, sessionContext)
  if (simpleSolve) {
    return simpleSolve
  }

  const directGeneralKnowledge = buildQbankGeneralKnowledgeReply(
    mode,
    context.parsedQuery.raw,
    sessionContext
  )
  if (directGeneralKnowledge) {
    return directGeneralKnowledge
  }

  const scope = formatQbankScope(context.parsedQuery)
  const topConcept = context.conceptMatches[0]
  const topQuestion = context.questionMatches[0]
  const paperResourceReply =
    !topQuestion && context.parsedQuery.queryClass === 'PAPER_SEARCH'
      ? buildPaperResourceReply(context)
      : null
  const topRepeatMatches = context.repeatMatches.slice(0, 3)
  const topTopicMatches = context.topicMatches.slice(0, 3)
  const uniqueTopics = new Map<string, { title: string; reason: string }>()

  for (const match of topTopicMatches) {
    const key = `${match.subject}:${match.topic}`.toLowerCase()
    if (!uniqueTopics.has(key)) {
      uniqueTopics.set(key, {
        title: match.topic,
        reason:
          compactText(match.summary, 120) ||
          compactText(match.examTips[0] ?? '', 120) ||
          'Shows up often enough to be worth active revision.',
      })
    }
  }

  for (const match of context.conceptMatches.slice(0, 4)) {
    const key = `${match.subject}:${match.topic}`.toLowerCase()
    if (!uniqueTopics.has(key)) {
      uniqueTopics.set(key, {
        title: match.topic,
        reason:
          compactText(match.conceptSummary, 120) ||
          compactText(match.examTips[0] ?? '', 120) ||
          'Worth revising because it connects to multiple question styles.',
      })
    }
  }

  for (const match of context.questionMatches.slice(0, 6)) {
    const key = `${match.subject}:${match.topic}`.toLowerCase()
    if (!uniqueTopics.has(key)) {
      uniqueTopics.set(key, {
        title: match.topic,
        reason:
          compactText(match.answerSummary, 120) ||
          compactText(match.questionText, 120) ||
          'Shows up in paper-style questions often enough to deserve revision time.',
      })
    }
  }

  if (paperResourceReply) {
    if (shouldTutorScaffold(mode, context.parsedQuery.raw, sessionContext)) {
      return [
        'Acha, I found the paper direction.',
        '',
        'Tell me first: do you want the likely topics, the hardest question, or a safe scoring plan?',
        '',
        'Bolo, then I will guide it step by step. Bujhecho?',
      ].join('\n')
    }

    return paperResourceReply
  }

  if (
    context.parsedQuery.intent === 'topic_review' ||
    context.parsedQuery.wantsMostRepeated ||
    context.parsedQuery.wantsPrediction
  ) {
    if (topRepeatMatches.length > 0) {
      const lines = [
        scope
          ? `For ${scope}, these are the strongest repeated areas I can justify from the loaded papers:`
          : 'These are the strongest repeated areas I can justify from the loaded papers:',
        '',
      ]

      topRepeatMatches.forEach((entry, index) => {
        lines.push(
          `${index + 1}. ${entry.topic}: ${entry.frequency} repeated pattern${entry.frequency === 1 ? '' : 's'} across ${entry.years.join(', ')}.`
        )
      })

      if (context.questionMatches.length > 0) {
        lines.push('')
        lines.push('Good revision examples:')
        context.questionMatches.slice(0, 3).forEach((match, index) => {
          lines.push(`${index + 1}. ${formatQuestionPreview(match)}`)
        })
      }

      lines.push('')
      lines.push('If you want, I can now take one of these and show you the solving pattern step by step.')
      return lines.join('\n')
    }

    const topicList = Array.from(uniqueTopics.values()).slice(0, 3)
    if (topicList.length > 0) {
      const lines = [
        scope
          ? `For ${scope}, I would revise these areas first:`
          : `The topics I would revise first are:`,
        '',
      ]

      topicList.forEach((entry, index) => {
        lines.push(`${index + 1}. ${entry.title}: ${entry.reason}`)
      })

      if (context.parsedQuery.year || context.parsedQuery.paper) {
        lines.push('')
        lines.push('This is a smart revision order, not a fake guarantee that these are the only questions coming.')
      }

      lines.push('')
      lines.push(
        context.parsedQuery.year || context.parsedQuery.paper
          ? 'If you want, send the exact question from that paper and I will solve it properly.'
          : 'If you tell me the board and year, I can tighten this ranking further.'
      )

      return lines.join('\n')
    }
  }

  if (
    (context.parsedQuery.intent === 'formula_lookup' ||
      context.parsedQuery.intent === 'concept_lookup' ||
      context.parsedQuery.intent === 'general') &&
    topConcept
  ) {
    const formulaLine =
      topConcept.formulaCandidates.length > 0
        ? `The main formula here is ${topConcept.formulaCandidates[0]}.`
        : null
    const tipLine = buildConceptMemoryTip(topConcept)
    const lead =
      scope && topConcept.topic.toLowerCase() !== scope.toLowerCase()
        ? `For ${scope}, the clean idea is ${topConcept.topic}.`
        : `The clean idea here is ${topConcept.topic}.`

    return [
      lead,
      '',
      formulaLine,
      compactText(topConcept.conceptSummary, 320),
      tipLine ? `Exam tip: ${compactText(tipLine, 180)}` : null,
      mode === 'tutor'
        ? 'If you want, I can turn this into a short step-by-step worked example next.'
        : 'If you want, I can show how this turns up inside a real exam question next.',
    ]
      .filter(Boolean)
      .join('\n\n')
  }

  if (
    topQuestion &&
    (context.parsedQuery.intent === 'question_lookup' ||
      (context.parsedQuery.intent === 'solve' &&
        (context.parsedQuery.year ||
          context.parsedQuery.yearStart !== null ||
          context.parsedQuery.paper)))
  ) {
    return buildQbankGroundedReply(mode, context)
  }

  if (topConcept) {
    return [
      scope ? `For ${scope}, this is the cleanest direction I can support right now:` : 'This is the cleanest direction I can support right now:',
      '',
      compactText(topConcept.conceptSummary, 320),
      topConcept.formulaCandidates[0]
        ? `Formula: ${topConcept.formulaCandidates[0]}`
        : null,
      mode === 'tutor'
        ? 'If you want, I can now teach this slowly with one easy example.'
        : 'If you want, I can connect this to an exam-style question next.',
    ]
      .filter(Boolean)
      .join('\n')
  }

  return buildQbankGroundedReply(mode, context)
}

export type QbankParsedQuery = {
  raw: string
  normalized: string
  queryClass: QbankQueryClass
  board: string | null
  level: string | null
  subject: string | null
  year: number | null
  yearStart: number | null
  yearEnd: number | null
  paper: string | null
  intent:
    | 'topic_review'
    | 'question_lookup'
    | 'solve'
    | 'concept_lookup'
    | 'formula_lookup'
    | 'general'
  topicHints: string[]
  queryTerms: string[]
  wantsMostRepeated: boolean
  wantsPrediction: boolean
  wantsSimilar: boolean
}

export type QbankPdfChunkMatch = {
  id: string
  documentId: string
  board: string
  level: string
  subject: string
  title: string
  year: number | null
  resourceType: string
  content: string
  visualRich: boolean
  visualRisk: string | null
  imageObjects: number
  visualTags: string[]
  sourceUrl: string | null
}

export type QbankPaperPairMatch = {
  id: string
  board: string
  level: string
  subject: string
  year: number | null
  session: string | null
  paperCode: string | null
  questionPaperUrl: string | null
  markSchemeUrl: string | null
  examinerReportUrl: string | null
  confidentialInstructionsUrl: string | null
  specimenMarkSchemeUrl: string | null
  completeness: 'full' | 'partial'
}

export type QbankNearbyResourceMatch = {
  id: string
  board: string
  level: string
  subject: string
  year: number | null
  session: string | null
  paperCode: string | null
  resourceType: string
  title: string
  url: string
  yearDistance: number | null
  samePaper: boolean
  completeness: 'full' | 'partial'
}

export type QbankGapMatch = {
  id: string
  board: string
  level: string
  subject: string
  year: number | null
  resourceType: string
  status: 'access_blocked' | 'source_page_available' | 'not_yet_published'
  httpStatus: number | null
  effectiveMinYear: number | null
  effectiveMaxYear: number | null
  sourceUrls: string[]
}

export type QbankBlockedRecoveryContextMatch = QbankBlockedRecoveryMatch
export type QbankConceptContextMatch = QbankConceptMatch

const DATA_DIR = path.join(process.cwd(), 'data')
let cachedSeedRows: QbankSeedRow[] | null = null

function isMissingQbankError(error: unknown): boolean {
  const code = (error as { code?: string })?.code
  const message = String((error as { message?: string })?.message ?? '')
  return code === '42P01' || code === 'PGRST205' || /qbank_topic_map|qbank_questions/i.test(message)
}

function expandQueryAliases(query: string) {
  return query
    .replace(/\bcambrige\b/gi, 'cambridge')
    .replace(/\bcambridgee\b/gi, 'cambridge')
    .replace(/\bedexel\b/gi, 'edexcel')
    .replace(/\bedexl\b/gi, 'edexcel')
    .replace(/\bedxcel\b/gi, 'edexcel')
    .replace(/\bial\b/gi, 'international advanced level')
    .replace(/\bigcse\b/gi, 'international gcse')
    .replace(/\bo level\b/gi, 'o level')
    .replace(/\ba level\b/gi, 'a level')
}

function normalizeQuery(query: string) {
  return expandQueryAliases(query)
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(query: string) {
  return normalizeQuery(query)
    .toLowerCase()
    .split(' ')
    .filter((token) => token.length > 2)
}

const QUERY_TERM_STOPWORDS = new Set([
  'a',
  'all',
  'and',
  'board',
  'boards',
  'cambridge',
  'caie',
  'edexcel',
  'from',
  'give',
  'important',
  'last',
  'level',
  'levels',
  'marks',
  'most',
  'of',
  'paper',
  'papers',
  'past',
  'question',
  'questions',
  'recent',
  'repeated',
  'show',
  'similar',
  'solve',
  'subject',
  'subjects',
  'the',
  'this',
  'topic',
  'topics',
  'what',
  'which',
  'wise',
  'with',
  'year',
  'years',
])

function getQueryTerms(normalized: string) {
  return tokenize(normalized).filter((token) => !QUERY_TERM_STOPWORDS.has(token) && !/^20\d{2}$/.test(token))
}

function isFormulaStyleQuery(normalized: string) {
  return /\b(formula|formulas|equation|equations|expression|ideal gas|gas law|gas laws)\b/.test(
    normalized
  )
}

function isFreeformSolveQuery(normalized: string) {
  return /\b(solve|working|step by step|differentiate|differentiation|derivative|derive|integrate|integration|simplify|simplification|factor|factorise|factorize|expand|dy\/dx)\b|y\s*=|sinx|cosx|tanx/.test(
    normalized
  )
}

function isGeneralKnowledgeExplainQuery(normalized: string) {
  return /\b(what is|explain|define|how does|how do you|when do you use|meaning of)\b/.test(
    normalized
  )
}

function classifyQbankQuery(normalized: string, hasPaperScope: boolean, hasRepeatScope: boolean) {
  if (
    !hasPaperScope &&
    (isFormulaStyleQuery(normalized) ||
      isFreeformSolveQuery(normalized) ||
      isGeneralKnowledgeExplainQuery(normalized))
  ) {
    return 'GENERAL_KNOWLEDGE' as const
  }

  if (hasPaperScope) {
    return 'PAPER_SEARCH' as const
  }

  if (hasRepeatScope) {
    return 'TOPIC_SEARCH' as const
  }

  return 'CONCEPT_SEARCH' as const
}

function shouldSkipQuestionRetrieval(parsed: QbankParsedQuery) {
  return parsed.queryClass !== 'PAPER_SEARCH'
}

export function parseQbankQuery(query: string): QbankParsedQuery {
  const normalized = normalizeQuery(query).toLowerCase()
  const yearRangeMatch =
    normalized.match(/\b(20\d{2})\s*[-/]\s*(20\d{2})\b/) ??
    normalized.match(/\b(20\d{2})\s+to\s+(20\d{2})\b/)
  const yearMatch = normalized.match(/\b(20\d{2})\b/)
  const paperMatch = normalized.match(/\b(paper\s*\d+[a-z]?|paper\s*[a-z]|\bp\d+\b|pure mathematics\s*\d+)\b/i)
  const latestYear = normalized.includes('last year') ? getCompiledLatestQuestionYear() : null

  const board = normalized.includes('edexcel')
    ? 'Edexcel'
    : normalized.includes('cambridge') || normalized.includes('cie')
      ? 'Cambridge'
      : normalized.includes('pearson')
        ? 'Edexcel'
        : null

  const level = normalized.includes('o level')
    ? 'O Level'
    : normalized.includes('a level')
      ? 'A Level'
      : normalized.includes('international gcse')
        ? 'IGCSE'
        : normalized.includes('international advanced level')
          ? 'International Advanced Level'
          : null

  const subject = normalized.includes('physics')
    ? 'Physics'
    : normalized.includes('chemistry') || normalized.includes('chem')
      ? 'Chemistry'
      : normalized.includes('further mathematics') || normalized.includes('further maths')
        ? 'Further Mathematics'
        : normalized.includes('math') || normalized.includes('mathematics') || normalized.includes('maths')
          ? 'Mathematics'
          : normalized.includes('biology') || normalized.includes('bio')
            ? 'Biology'
            : normalized.includes('information technology') || /\bict\b/.test(normalized)
              ? 'Information Technology'
              : normalized.includes('computer science') || normalized.includes('comp sci')
                ? 'Computer Science'
                : normalized.includes('economics') || normalized.includes('econ')
                ? 'Economics'
                : normalized.includes('business')
                  ? 'Business'
                  : normalized.includes('accounting') || normalized.includes('accounts')
                    ? 'Accounting'
                    : normalized.includes('english')
                      ? 'English'
                        : null

  const wantsMostRepeated = /\b(most repeated|most common|repeat most|repeats the most|frequency|frequent)\b/.test(
    normalized
  )
  const wantsPrediction = /\b(predict|prediction|appear most|comes most|recently)\b/.test(
    normalized
  )
  const wantsSimilar = /\b(similar|other boards|same type|like this)\b/.test(normalized)
  const hasRepeatScope =
    wantsMostRepeated || wantsPrediction || /\b(important|repeat|topic|chapter|year wise|yearwise)\b/.test(normalized)
  const hasPaperScope =
    Boolean(yearRangeMatch || yearMatch || paperMatch || latestYear) ||
    /\b(question|questions|paper|papers|mark scheme|ms|qp|last year)\b/.test(normalized)

  const topicHints = [
    'ideal gas equation',
    'ideal gas formula',
    'ideal gas',
    'gas law',
    'gas laws',
    'organic chemistry',
    'formula',
    'formulas',
    'equation',
    'equations',
    'vectors',
    'vector',
    'integration',
    'differentiation',
    'wave motion',
    'thermodynamics',
    'periodic table',
    'periodic trends',
    'equilibrium',
    'energetics',
    'stoichiometry',
    'mechanics',
    'algebra',
    'calculus',
    'kinematics',
    'motion graphs',
    'circuits',
    'electricity',
    'functions',
    'graph',
    'graphs',
    'diagram',
    'diagrams',
    'table',
    'tables',
    'image',
    'images',
    'chart',
    'practical',
    'apparatus',
    'algorithm',
    'pseudocode',
    'programming',
    'market structure',
    'elasticity',
    'cash flow',
    'ledger',
    'poetry',
    'comprehension',
    'mechanics',
    'statistics',
  ].filter((hint) => normalized.includes(hint))

  const queryClass = classifyQbankQuery(normalized, hasPaperScope, hasRepeatScope)
  const intent =
    queryClass === 'GENERAL_KNOWLEDGE'
      ? isFormulaStyleQuery(normalized)
        ? 'formula_lookup'
        : isFreeformSolveQuery(normalized)
          ? 'solve'
          : 'general'
      : queryClass === 'TOPIC_SEARCH'
        ? 'topic_review'
        : queryClass === 'PAPER_SEARCH'
          ? /tutor/.test(normalized) || isFreeformSolveQuery(normalized)
            ? 'solve'
            : 'question_lookup'
          : isFormulaStyleQuery(normalized)
            ? 'formula_lookup'
            : 'concept_lookup'

  const year =
    yearRangeMatch
      ? null
      : yearMatch
        ? Number(yearMatch[1])
        : latestYear

  return {
    raw: query,
    normalized,
    queryClass,
    board,
    level,
    subject,
    year,
    yearStart: yearRangeMatch ? Number(yearRangeMatch[1]) : null,
    yearEnd: yearRangeMatch ? Number(yearRangeMatch[2]) : null,
    paper: paperMatch ? paperMatch[1].replace(/\s+/g, ' ').trim() : null,
    intent,
    topicHints,
    queryTerms: getQueryTerms(normalized),
    wantsMostRepeated,
    wantsPrediction,
    wantsSimilar,
  }
}

function matchesParsedFilters(row: QbankSeedRow, parsed: QbankParsedQuery) {
  if (parsed.board && !row.board.toLowerCase().includes(parsed.board.toLowerCase())) {
    return false
  }

  if (parsed.level && !row.level.toLowerCase().includes(parsed.level.toLowerCase())) {
    return false
  }

  if (parsed.subject && !row.subject.toLowerCase().includes(parsed.subject.toLowerCase())) {
    return false
  }

  if (parsed.year && row.record_type === 'qbank_question' && row.year && row.year !== parsed.year) {
    return false
  }

  if (parsed.paper && row.record_type === 'qbank_question' && row.paper) {
    const normalizedPaper = row.paper.toLowerCase()
    const queryPaper = parsed.paper.toLowerCase()
    if (!normalizedPaper.includes(queryPaper) && !queryPaper.includes(normalizedPaper)) {
      return false
    }
  }

  return true
}

function getSeedRows() {
  if (cachedSeedRows) {
    return cachedSeedRows
  }

  if (!fs.existsSync(DATA_DIR)) {
    cachedSeedRows = []
    return cachedSeedRows
  }

  const seedFiles = fs
    .readdirSync(DATA_DIR)
    .filter((file) => /^qbank_seed.*\.jsonl$/i.test(file))
    .sort()

  cachedSeedRows = seedFiles.flatMap((file) => {
    const raw = fs.readFileSync(path.join(DATA_DIR, file), 'utf8')
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as QbankSeedRow)
  })

  return cachedSeedRows
}

function scoreSeedRow(row: QbankSeedRow, query: string, parsed: QbankParsedQuery) {
  const tokens = tokenize(query)
  const normalizedQuery = normalizeQuery(query).toLowerCase()
  const haystack = [
    row.board,
    row.level,
    row.subject,
    row.chapter,
    row.topic,
    row.search_text,
    row.summary,
    row.question_text,
    row.answer_summary,
    row.paper,
    row.question_label,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  let score = 0
  for (const token of tokens) {
    if (haystack.includes(token)) {
      score += 3
    }
  }

  if (/\b20\d{2}\b/.test(normalizedQuery) && row.year && normalizedQuery.includes(String(row.year))) {
    score += 6
  }

  if (/paper/i.test(normalizedQuery) && row.paper) {
    score += 4
  }

  if (
    /important|repeat|topic|chapter|vector|vectors/i.test(normalizedQuery) &&
    row.record_type === 'qbank_topic'
  ) {
    score += 4
  }

  if (/solve|answer|question|working|year wise|yearwise/i.test(normalizedQuery) && row.record_type === 'qbank_question') {
    score += 4
  }

  if ((parsed.intent === 'formula_lookup' || parsed.intent === 'concept_lookup') && row.record_type === 'qbank_question') {
    score -= 18
  }

  if (row.record_type === 'qbank_question') {
    if (row.link_quality === 'exact') {
      score += 18
    } else if (row.link_quality === 'hierarchical') {
      score += row.link_confidence === 'medium' ? 8 : 2
    } else if (row.link_quality === 'unlinked') {
      score -= 4
    }

    if (row.answer_ready) {
      score += 6
    }
  }

  if (row.board && normalizedQuery.includes(row.board.toLowerCase())) {
    score += 5
  }

  if (row.subject && normalizedQuery.includes(row.subject.toLowerCase())) {
    score += 4
  }

  if (row.topic && normalizedQuery.includes(row.topic.toLowerCase())) {
    score += 5
  }

  if (row.chapter && normalizedQuery.includes(row.chapter.toLowerCase())) {
    score += 4
  }

  return score
}

function buildTopicContent(row: TopicMatch) {
  return [
    `${row.board} ${row.level} ${row.subject}`,
    `${row.chapter} - ${row.topic}`,
    row.summary,
    row.totalFrequency ? `Total frequency: ${row.totalFrequency}` : '',
    row.questionCount ? `Question count: ${row.questionCount}` : '',
    row.repeatYears.length > 0 ? `Repeat years: ${row.repeatYears.join(', ')}` : '',
    row.examTips.length > 0 ? `Exam tips: ${row.examTips.join(' ')}` : '',
  ]
    .filter(Boolean)
    .join('. ')
}

function buildQuestionContent(row: QuestionMatch) {
  const linkageLine =
    row.linkQuality === 'exact'
      ? 'Official answer linkage: exact mark-scheme match.'
      : row.linkQuality === 'hierarchical'
        ? `Official answer linkage: partial ${row.linkConfidence}-confidence mark-scheme match. Use carefully.`
        : 'Official answer linkage: no exact official answer span linked yet. Use the question paper and mark scheme together.'

  const header = `[${row.board}] [${row.year ?? 'Unknown Year'}] [${row.topic}] [${row.marks ?? 'Marks unknown'}]`

  return [
    header,
    `${row.board} ${row.level} ${row.subject}`,
    row.paper || '',
    row.questionLabel || '',
    row.questionText,
    row.options && row.options.length > 0 ? `Options: ${row.options.join(' | ')}` : '',
    linkageLine,
    `Answer summary: ${row.answerSummary}`,
    row.solution ? `Solution: ${row.solution}` : '',
    row.methodSteps.length > 0 ? `Method: ${row.methodSteps.join(' ')}` : '',
    row.frequency ? `Frequency: ${row.frequency}` : '',
    row.repeatSignal ? `Repeat pattern: ${row.repeatSignal}` : '',
  ]
    .filter(Boolean)
    .join('. ')
}

function mapSeedTopic(row: QbankSeedRow): TopicMatch {
  return {
    id: row.id,
    board: row.board,
    level: row.level,
    subject: row.subject,
    chapter: row.chapter,
    topic: row.topic,
    importanceScore: row.importance_score ?? 50,
    summary: row.summary ?? '',
    repeatYears: row.repeat_years ?? [],
    examTips: row.exam_tips ?? [],
    sourceLabel: row.source_label ?? null,
    sourceUrl: row.source_url ?? null,
  }
}

function mapSeedQuestion(row: QbankSeedRow): QuestionMatch {
  return {
    id: row.id,
    board: row.board,
    level: row.level,
    subject: row.subject,
    chapter: row.chapter,
    topic: row.topic,
    year: row.year ?? null,
    paper: row.paper ?? null,
    questionLabel: row.question_label ?? null,
    questionText: row.question_text ?? '',
    answerSummary: row.answer_summary ?? '',
    methodSteps: row.method_steps ?? [],
    repeatSignal: row.repeat_signal ?? null,
    sourceLabel: row.source_label ?? null,
    sourceUrl: row.source_url ?? null,
    answerSourceUrl: row.answer_source_url ?? null,
    linkQuality: row.link_quality ?? 'unknown',
    linkScore: row.link_score ?? 0,
    linkConfidence: row.link_confidence ?? 'none',
    answerReady: row.answer_ready ?? false,
    marks: null,
    questionType: null,
    options: [],
    solution: null,
    frequency: 1,
    pageStart: null,
    pageEnd: null,
    sourcePdf: null,
  }
}

function splitSolutionSteps(solution: string | null) {
  return (solution ?? '')
    .split(/\r?\n|(?<=[.?!])\s+(?=[A-Z0-9(])/)
    .map((step) => step.replace(/\s+/g, ' ').trim())
    .filter((step) => step.length >= 8)
    .slice(0, 5)
}

function mapCompiledQuestion(row: CompiledQbankQuestionRow): QuestionMatch {
  const answerSummary = (row.answer ?? row.solution ?? '').replace(/\s+/g, ' ').trim()

  return {
    id: row.id,
    board: row.board,
    level: row.level,
    subject: row.subject,
    chapter: row.topic,
    topic: row.topic,
    year: row.year,
    paper: row.paper,
    questionLabel: row.question_number,
    questionText: row.question_text,
    answerSummary,
    methodSteps: splitSolutionSteps(row.solution),
    repeatSignal: row.frequency > 1 ? `Seen ${row.frequency} times in the compiled bank.` : null,
    sourceLabel: path.basename(row.source_pdf),
    sourceUrl: row.source_url,
    answerSourceUrl: row.answer_source_url,
    linkQuality: row.link_quality,
    linkScore: row.frequency * 10 + (row.answer_ready ? 15 : 0),
    linkConfidence: row.link_confidence,
    answerReady: row.answer_ready,
    marks: row.marks,
    questionType: row.question_type,
    options: row.options,
    solution: row.solution,
    frequency: row.frequency,
    pageStart: row.page_start,
    pageEnd: row.page_end,
    sourcePdf: row.source_pdf,
  }
}

function mapCompiledTopic(row: CompiledQbankTopicFrequency): TopicMatch {
  return {
    id: `compiled_topic_${row.board}_${row.level}_${row.subject}_${row.topic}`.replace(/[^\w-]/g, '_'),
    board: row.board,
    level: row.level,
    subject: row.subject,
    chapter: 'Repeat analysis',
    topic: row.topic,
    importanceScore: row.total_frequency,
    summary: `${row.topic} appears in ${row.question_count} dataset-backed question${row.question_count === 1 ? '' : 's'} across ${row.years.length} year${row.years.length === 1 ? '' : 's'}.`,
    repeatYears: row.years.map(String),
    examTips: [],
    sourceLabel: 'compiled topic frequency',
    sourceUrl: null,
    questionCount: row.question_count,
    totalFrequency: row.total_frequency,
  }
}

function rankQuestionMatch(row: QuestionMatch, parsed: QbankParsedQuery) {
  let score = 0

  if (shouldSkipQuestionRetrieval(parsed)) {
    score -= 120
  }

  if (row.linkQuality === 'exact') {
    score += 80
  } else if (row.linkQuality === 'hierarchical') {
    score += row.linkConfidence === 'medium' ? 35 : 14
  } else if (row.linkQuality === 'unlinked') {
    score -= 18
  }

  if (row.answerReady) {
    score += 18
  }

  if (parsed.year && row.year === parsed.year) {
    score += 14
  }

  if ((parsed.yearStart !== null || parsed.yearEnd !== null) && row.year !== null) {
    const inRange =
      (parsed.yearStart === null || row.year >= parsed.yearStart) &&
      (parsed.yearEnd === null || row.year <= parsed.yearEnd)
    score += inRange ? 12 : -20
  }

  if (parsed.paper && row.paper?.toLowerCase().includes(parsed.paper.toLowerCase())) {
    score += 12
  }

  if (parsed.subject && row.subject.toLowerCase().includes(parsed.subject.toLowerCase())) {
    score += 10
  }

  if (parsed.intent === 'solve' || parsed.intent === 'question_lookup') {
    score += row.questionText.length > 40 ? 8 : 0
  }

  if (parsed.topicHints.some((hint) => row.questionText.toLowerCase().includes(hint) || row.topic.toLowerCase().includes(hint))) {
    score += 8
  }

  if (parsed.queryTerms.some((term) => row.topic.toLowerCase().includes(term) || row.questionText.toLowerCase().includes(term))) {
    score += 10
  }

  if ((parsed.wantsMostRepeated || parsed.wantsPrediction) && row.frequency) {
    score += Math.min(row.frequency * 5, 30)
  } else if (row.frequency) {
    score += Math.min(row.frequency * 2, 12)
  }

  if (row.marks) {
    score += 2
  }

  return score
}

function clampRelevance(value: number) {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))))
}

function countMatchedTerms(text: string, terms: string[]) {
  const normalizedText = normalizeLoose(text)
  if (!normalizedText) {
    return 0
  }

  return terms.filter((term) => term.length >= 3 && normalizedText.includes(term.toLowerCase())).length
}

function computeQuestionRelevance(row: QuestionMatch, parsed: QbankParsedQuery) {
  let relevance = 0

  if (parsed.subject) {
    relevance += normalizeLoose(row.subject) === normalizeLoose(parsed.subject) ? 0.22 : -0.18
  }

  if (parsed.board) {
    relevance += normalizeLoose(row.board) === normalizeLoose(parsed.board) ? 0.16 : -0.14
  }

  if (parsed.level) {
    relevance += normalizeLoose(row.level) === normalizeLoose(parsed.level) ? 0.1 : -0.08
  }

  if (parsed.year) {
    relevance += row.year === parsed.year ? 0.22 : -0.2
  }

  if ((parsed.yearStart !== null || parsed.yearEnd !== null) && row.year !== null) {
    const inRange =
      (parsed.yearStart === null || row.year >= parsed.yearStart) &&
      (parsed.yearEnd === null || row.year <= parsed.yearEnd)
    relevance += inRange ? 0.18 : -0.18
  }

  if (parsed.paper) {
    relevance += row.paper && matchesPaperCode(row.paper, parsed.paper) ? 0.2 : -0.18
  }

  const queryHits =
    countMatchedTerms(`${row.topic} ${row.chapter} ${row.questionText}`, parsed.queryTerms) * 0.05
  const hintHits =
    parsed.topicHints.filter(
      (hint) =>
        normalizeLoose(`${row.topic} ${row.chapter} ${row.questionText}`)?.includes(hint.toLowerCase())
    ).length * 0.08
  relevance += Math.min(queryHits + hintHits, 0.2)

  if (row.linkQuality === 'exact') {
    relevance += 0.12
  } else if (row.linkQuality === 'hierarchical') {
    relevance += 0.07
  }

  if (row.answerReady) {
    relevance += 0.05
  }

  return clampRelevance(relevance)
}

function computePaperRelevance(
  row: {
    board: string
    level: string
    subject: string
    year: number | null
    paper: string
    paperCode?: string | null
    paperTitle?: string
    focusTopics?: string[]
  },
  parsed: QbankParsedQuery
) {
  let relevance = 0

  if (parsed.subject) {
    relevance += normalizeLoose(row.subject) === normalizeLoose(parsed.subject) ? 0.24 : -0.18
  }

  if (parsed.board) {
    relevance += normalizeLoose(row.board) === normalizeLoose(parsed.board) ? 0.16 : -0.14
  }

  if (parsed.level) {
    relevance += normalizeLoose(row.level) === normalizeLoose(parsed.level) ? 0.1 : -0.08
  }

  if (parsed.year) {
    relevance += row.year === parsed.year ? 0.24 : -0.22
  }

  if (parsed.paper) {
    const paperText = `${row.paper} ${row.paperCode ?? ''} ${row.paperTitle ?? ''}`
    relevance += normalizeLoose(paperText)?.includes(normalizeLoose(parsed.paper) ?? '') ? 0.22 : -0.18
  }

  const hintHits =
    countMatchedTerms(`${row.paperTitle ?? ''} ${(row.focusTopics ?? []).join(' ')}`, parsed.queryTerms) * 0.05
  relevance += Math.min(hintHits, 0.12)

  return clampRelevance(relevance)
}

function computeConceptRelevance(row: QbankConceptMatch, parsed: QbankParsedQuery) {
  let relevance = 0

  if (parsed.subject) {
    relevance += normalizeLoose(row.subject) === normalizeLoose(parsed.subject) ? 0.24 : -0.18
  }

  if (parsed.board) {
    relevance += normalizeLoose(row.board) === normalizeLoose(parsed.board) ? 0.12 : -0.1
  }

  if (parsed.level) {
    relevance += normalizeLoose(row.level) === normalizeLoose(parsed.level) ? 0.1 : -0.08
  }

  const haystack = `${row.chapter} ${row.topic} ${row.conceptSummary} ${row.formulaCandidates.join(' ')}`
  const hintHits = parsed.topicHints.filter(
    (hint) => normalizeLoose(haystack)?.includes(hint.toLowerCase())
  ).length
  const termHits = countMatchedTerms(haystack, parsed.queryTerms)
  relevance += Math.min(hintHits * 0.14 + termHits * 0.05, 0.36)

  if (parsed.intent === 'formula_lookup' && row.formulaCandidates.length > 0) {
    relevance += 0.14
  }

  if (row.examTips.length > 0 || row.conceptSummary.length > 40) {
    relevance += 0.08
  }

  return clampRelevance(relevance)
}

async function searchTopicsInDb(query: string): Promise<TopicMatch[]> {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('qbank_topic_map')
    .select(
      'id, board, level, subject, chapter, topic, importance_score, repeat_years, exam_tips, summary, source_label, source_url'
    )
    .textSearch('fts', normalizeQuery(query), {
      type: 'websearch',
      config: 'english',
    })
    .order('importance_score', { ascending: false })
    .limit(4)

  if (error) {
    throw error
  }

  return (
    (data as
      | Array<{
          id: string
          board: string
          level: string
          subject: string
          chapter: string
          topic: string
          importance_score: number
          repeat_years: string[] | null
          exam_tips: string[] | null
          summary: string
          source_label: string | null
          source_url: string | null
        }>
      | null) ?? []
  ).map((row) => ({
    id: row.id,
    board: row.board,
    level: row.level,
    subject: row.subject,
    chapter: row.chapter,
    topic: row.topic,
    importanceScore: row.importance_score,
    summary: row.summary,
    repeatYears: row.repeat_years ?? [],
    examTips: row.exam_tips ?? [],
    sourceLabel: row.source_label,
    sourceUrl: row.source_url,
  }))
}

async function searchQuestionsInDb(query: string): Promise<QuestionMatch[]> {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('qbank_questions')
    .select(
      'id, board, level, subject, chapter, topic, year, paper, question_label, question_text, answer_summary, method_steps, repeat_signal, source_label, source_url'
    )
    .textSearch('fts', normalizeQuery(query), {
      type: 'websearch',
      config: 'english',
    })
    .order('year', { ascending: false })
    .limit(4)

  if (error) {
    throw error
  }

  return (
    (data as
      | Array<{
          id: string
          board: string
          level: string
          subject: string
          chapter: string
          topic: string
          year: number | null
          paper: string | null
          question_label: string | null
          question_text: string
          answer_summary: string
          method_steps: string[] | null
          repeat_signal: string | null
          source_label: string | null
          source_url: string | null
        }>
      | null) ?? []
  ).map((row) => ({
    id: row.id,
    board: row.board,
    level: row.level,
    subject: row.subject,
    chapter: row.chapter,
    topic: row.topic,
    year: row.year,
    paper: row.paper,
    questionLabel: row.question_label,
    questionText: row.question_text,
    answerSummary: row.answer_summary,
    methodSteps: row.method_steps ?? [],
    repeatSignal: row.repeat_signal,
    sourceLabel: row.source_label,
    sourceUrl: row.source_url,
    answerSourceUrl: null,
    linkQuality: 'unknown',
    linkScore: 0,
    linkConfidence: 'none',
    answerReady: false,
  }))
}

function searchTopicsInSeed(query: string): TopicMatch[] {
  const parsed = parseQbankQuery(query)
  const rows = getSeedRows().filter((row) => matchesParsedFilters(row, parsed))
  const candidates = rows.length > 0 ? rows : getSeedRows()

  return candidates
    .filter((row) => row.record_type === 'qbank_topic')
    .map((row) => ({ row, score: scoreSeedRow(row, query, parsed) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((entry) => mapSeedTopic(entry.row))
}

function searchQuestionsInSeed(query: string): QuestionMatch[] {
  const parsed = parseQbankQuery(query)
  if (shouldSkipQuestionRetrieval(parsed)) {
    return []
  }
  const rows = getSeedRows().filter((row) => matchesParsedFilters(row, parsed))
  const candidates = rows.length > 0 ? rows : getSeedRows()

  return candidates
    .filter((row) => row.record_type === 'qbank_question')
    .map((row) => ({ row, score: scoreSeedRow(row, query, parsed) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => mapSeedQuestion(entry.row))
    .sort((a, b) => rankQuestionMatch(b, parsed) - rankQuestionMatch(a, parsed))
    .slice(0, 4)
}

export async function searchQbankTopics(query: string) {
  const parsed = parseQbankQuery(query)
  const compiledMatches = searchCompiledQbankTopicFrequency(parsed, 4).map(mapCompiledTopic)
  if (compiledMatches.length > 0) {
    return { enabled: true, source: 'compiled', matches: compiledMatches }
  }

  try {
    const matches = await searchTopicsInDb(query)
    if (matches.length > 0) {
      return { enabled: true, source: 'db', matches }
    }
  } catch (error) {
    if (!isMissingQbankError(error)) {
      throw error
    }
  }

  return {
    enabled: false,
    source: 'seed',
    matches: searchTopicsInSeed(query),
  }
}

export async function searchQbankQuestions(query: string) {
  const parsed = parseQbankQuery(query)

  const compiledMatches = searchCompiledQbankQuestions(parsed, 6)
    .map(mapCompiledQuestion)
    .sort((a, b) => rankQuestionMatch(b, parsed) - rankQuestionMatch(a, parsed))
    .slice(0, 4)

  if (compiledMatches.length > 0) {
    return {
      enabled: true,
      source: 'compiled',
      matches: compiledMatches,
    }
  }

  if (shouldSkipQuestionRetrieval(parsed)) {
    return {
      enabled: false,
      source: 'seed',
      matches: [] as QuestionMatch[],
    }
  }

  try {
    const matches = await searchQuestionsInDb(query)
    if (matches.length > 0) {
      return {
        enabled: true,
        source: 'db',
        matches: matches
          .sort((a, b) => rankQuestionMatch(b, parsed) - rankQuestionMatch(a, parsed))
          .slice(0, 4),
      }
    }
  } catch (error) {
    if (!isMissingQbankError(error)) {
      throw error
    }
  }

  return {
    enabled: false,
    source: 'seed',
    matches: searchQuestionsInSeed(query),
  }
}

export function searchQbankRepeatGroups(query: string) {
  return searchCompiledQbankRepeatGroups(parseQbankQuery(query), 5)
}

function buildEmptyQbankContext(parsedQuery: QbankParsedQuery) {
  return {
    enabled: false,
    chunks: [] as QbankContextChunk[],
    topicMatches: [] as TopicMatch[],
    conceptMatches: [] as QbankConceptMatch[],
    repeatMatches: [] as QbankRepeatMatch[],
    questionMatches: [] as QuestionMatch[],
    paperMatches: [] as Awaited<ReturnType<typeof searchQbankPapers>>['matches'],
    paperPairMatches: [] as QbankPaperPairMatch[],
    pdfChunkMatches: [] as QbankPdfChunkMatch[],
    gapMatches: [] as QbankGapMatch[],
    blockedRecoveryMatches: [] as QbankBlockedRecoveryContextMatch[],
    nearbyResourceMatches: [] as QbankNearbyResourceMatch[],
    sourceMatches: [] as Awaited<ReturnType<typeof searchQbankSources>>['matches'],
    sourceMode: 'seed' as const,
    parsedQuery,
    ambiguousPaperLevel: false,
    showSources: false,
    bestSourceRelevance: 0,
  }
}

export async function retrieveQbankContext(message: string) {
  const parsedQuery = parseQbankQuery(message)
  if (parsedQuery.queryClass === 'GENERAL_KNOWLEDGE') {
    return buildEmptyQbankContext(parsedQuery)
  }

  const wantsPaperRetrieval = parsedQuery.queryClass === 'PAPER_SEARCH'
  const wantsTopicRetrieval = parsedQuery.queryClass === 'TOPIC_SEARCH'
  const wantsConceptRetrieval =
    parsedQuery.queryClass === 'CONCEPT_SEARCH' || parsedQuery.queryClass === 'TOPIC_SEARCH'

  const [topicResult, questionResult, sourceResult, paperResult, conceptResult] = await Promise.all([
    wantsTopicRetrieval || wantsConceptRetrieval
      ? searchQbankTopics(message)
      : Promise.resolve({ enabled: false, source: 'seed' as const, matches: [] as TopicMatch[] }),
    wantsPaperRetrieval
      ? searchQbankQuestions(message)
      : Promise.resolve({ enabled: false, source: 'seed' as const, matches: [] as QuestionMatch[] }),
    wantsPaperRetrieval
      ? searchQbankSources(parsedQuery)
      : Promise.resolve({ enabled: false, matches: [] as Awaited<ReturnType<typeof searchQbankSources>>['matches'] }),
    wantsPaperRetrieval
      ? searchQbankPapers(parsedQuery)
      : Promise.resolve({ enabled: false, matches: [] as Awaited<ReturnType<typeof searchQbankPapers>>['matches'] }),
    wantsConceptRetrieval || wantsPaperRetrieval
      ? searchQbankConcepts(parsedQuery)
      : Promise.resolve({ enabled: false, matches: [] as QbankConceptMatch[] }),
  ])
  const paperPairMatches = wantsPaperRetrieval ? searchQbankPaperPairs(parsedQuery) : []
  const pdfChunkMatches = wantsPaperRetrieval ? searchQbankPdfChunks(parsedQuery) : []
  const gapMatches = wantsPaperRetrieval ? (searchQbankGapStatuses(parsedQuery) as QbankGapMatch[]) : []
  const blockedRecoveryMatches = wantsPaperRetrieval
    ? (searchQbankBlockedRecovery(parsedQuery) as QbankBlockedRecoveryContextMatch[])
    : []
  const nearbyResourceMatches = wantsPaperRetrieval
    ? (searchNearbyQbankResources(parsedQuery, gapMatches) as QbankNearbyResourceMatch[])
    : []
  const repeatMatches = searchQbankRepeatGroups(message)

  const enrichedQuestionMatches = questionResult.matches.map((row) =>
    enrichQuestionMatch(row, paperPairMatches, paperResult.matches)
  )

  const prioritizedQuestionMatches = [...enrichedQuestionMatches]
    .sort((a, b) => rankQuestionMatch(b, parsedQuery) - rankQuestionMatch(a, parsedQuery))
  const strongQuestionMatches = prioritizedQuestionMatches.filter(
    (row) => computeQuestionRelevance(row, parsedQuery) >= 0.75
  )
  const strongConceptMatches = conceptResult.matches.filter(
    (row) => computeConceptRelevance(row, parsedQuery) >= 0.75
  )
  const strongTopicMatches = topicResult.matches.filter(
    (row) =>
      parsedQuery.queryClass === 'TOPIC_SEARCH' ||
      computeConceptRelevance(
        {
          ...row,
          sourceUrls: row.sourceUrl ? [row.sourceUrl] : [],
          sourceLabels: row.sourceLabel ? [row.sourceLabel] : [],
          conceptSummary: row.summary,
          formulaCandidates: [],
          questionExamples: [],
          answerPatterns: [],
          repeatYears: row.repeatYears,
          importanceScore: row.importanceScore,
        },
        parsedQuery
      ) >= 0.75
  )
  const strongPaperMatches = paperResult.matches.filter(
    (row) => computePaperRelevance(row, parsedQuery) >= 0.75
  )
  const ambiguousPaperLevel =
    parsedQuery.queryClass === 'PAPER_SEARCH' &&
    !parsedQuery.level &&
    getDistinctPaperLevels(strongPaperMatches, paperPairMatches).length > 1
  const bestSourceRelevance = Math.max(
    strongQuestionMatches[0] ? computeQuestionRelevance(strongQuestionMatches[0], parsedQuery) : 0,
    strongPaperMatches[0] ? computePaperRelevance(strongPaperMatches[0], parsedQuery) : 0,
    paperPairMatches[0] ? 0.86 : 0
  )

  const questionChunks: QbankContextChunk[] = strongQuestionMatches.slice(0, 2).map((row) => ({
    id: row.id,
    content: buildQuestionContent(row),
    sourceTitle: `${row.board} ${row.level} ${row.subject}${row.year ? ` ${row.year}` : ''}${row.paper ? ` ${row.paper}` : ''}${row.questionLabel ? ` ${row.questionLabel}` : ''}${row.linkQuality === 'exact' ? ' [exact]' : row.linkQuality === 'hierarchical' ? ' [partial]' : ' [question-only]'}`,
    sourceUrl: row.sourceUrl ?? row.answerSourceUrl,
    tier:
      row.linkQuality === 'exact'
        ? 'qbank_exact_answer'
        : row.linkQuality === 'hierarchical'
          ? 'qbank_partial_answer'
          : questionResult.source === 'compiled'
            ? 'qbank_compiled_question'
            : questionResult.enabled
            ? 'qbank_db'
            : 'qbank_seed',
    lastChecked: null,
    score: computeQuestionRelevance(row, parsedQuery),
  }))

  const topicChunks: QbankContextChunk[] = strongTopicMatches.slice(0, 2).map((row) => ({
    id: row.id,
    content: buildTopicContent(row),
    sourceTitle: `${row.board} ${row.level} ${row.subject} - ${row.topic}`,
    sourceUrl: row.sourceUrl,
    tier:
      topicResult.source === 'compiled'
        ? 'qbank_compiled_topic'
        : topicResult.enabled
          ? 'qbank_db'
          : 'qbank_seed',
    lastChecked: null,
    score:
      parsedQuery.queryClass === 'TOPIC_SEARCH'
        ? 0.92
        : computeConceptRelevance(
            {
              ...row,
              sourceUrls: row.sourceUrl ? [row.sourceUrl] : [],
              sourceLabels: row.sourceLabel ? [row.sourceLabel] : [],
              conceptSummary: row.summary,
              formulaCandidates: [],
              questionExamples: [],
              answerPatterns: [],
              repeatYears: row.repeatYears,
              importanceScore: row.importanceScore,
            },
            parsedQuery
          ),
  }))

  const repeatChunks: QbankContextChunk[] = repeatMatches.slice(0, 2).map((row) => ({
    id: row.repeat_group_id,
    content: `${row.board} ${row.level} ${row.subject}. ${row.topic}. Repeated ${row.frequency} times across ${row.years.join(', ')}. Representative question: ${row.representative_question}`,
    sourceTitle: `${row.subject} repeated pattern - ${row.topic}`,
    sourceUrl: null,
    tier: 'qbank_repeat_group',
    lastChecked: null,
    score: parsedQuery.queryClass === 'TOPIC_SEARCH' ? 0.94 : 0.82,
  }))

  const conceptChunks: QbankContextChunk[] = strongConceptMatches.slice(0, 2).map((row) => ({
    id: row.id,
    content: `${row.board} ${row.level} ${row.subject}. ${row.chapter} - ${row.topic}. ${row.conceptSummary} ${row.formulaCandidates.length > 0 ? `Formula hints: ${row.formulaCandidates.join(' | ')}.` : ''} ${row.examTips.length > 0 ? `Exam tips: ${row.examTips.join(' ')}` : ''}`,
    sourceTitle: `${row.subject} concept - ${row.topic}`,
    sourceUrl: row.sourceUrls[0] ?? null,
    tier: conceptResult.enabled ? 'qbank_concept_db' : 'qbank_concept_seed',
    lastChecked: null,
    score: computeConceptRelevance(row, parsedQuery),
  }))

  const sourceChunks: QbankContextChunk[] = strongPaperMatches.length > 0 || paperPairMatches.length > 0
    ? sourceResult.matches.slice(0, 2).map((row) => ({
    id: row.id,
    content: `${row.title}. Provider: ${row.provider}. Board: ${row.board}. Level: ${row.level}. Subject: ${row.subject}. Use this source as ${row.allowedUse}.`,
    sourceTitle: row.title,
    sourceUrl: row.url,
    tier: sourceResult.enabled ? 'qbank_source_db' : 'qbank_source_seed',
    lastChecked: null,
    score: strongPaperMatches[0] ? computePaperRelevance(strongPaperMatches[0], parsedQuery) : 0.82,
      }))
    : []

  const paperChunks: QbankContextChunk[] = strongPaperMatches.slice(0, 2).map((row) => ({
    id: row.id,
    content: `${row.board} ${row.level} ${row.subject}. ${row.year ?? 'Unknown year'} ${row.paper}. ${row.paperTitle}. ${row.session ? `Session: ${row.session}.` : ''} ${row.focusTopics.length > 0 ? `Focus topics: ${row.focusTopics.join(', ')}.` : ''}`,
    sourceTitle: `${row.board} ${row.level} ${row.subject} ${row.year ?? ''} ${row.paper}`.trim(),
    sourceUrl: row.sourceUrl,
    tier: paperResult.enabled ? 'qbank_paper_db' : 'qbank_paper_seed',
    lastChecked: null,
    score: computePaperRelevance(row, parsedQuery),
  }))

  const paperPairChunks: QbankContextChunk[] = paperPairMatches.length > 0 ? paperPairMatches.slice(0, 2).map((row) => ({
    id: row.id,
    content: `${row.board} ${row.level} ${row.subject}. ${row.year ?? 'Unknown year'} ${row.paperCode ? `Paper ${row.paperCode}.` : ''} Pair completeness: ${row.completeness}. ${row.questionPaperUrl ? 'Question paper available.' : ''} ${row.markSchemeUrl ? 'Mark scheme available.' : ''} ${row.examinerReportUrl ? 'Examiner report available.' : ''} ${row.confidentialInstructionsUrl ? 'Practical/confidential instructions available.' : ''}`,
    sourceTitle: `${row.board} ${row.level} ${row.subject} ${row.year ?? ''} ${row.paperCode ? `Paper ${row.paperCode}` : 'paper pair'}`.trim(),
    sourceUrl: row.questionPaperUrl ?? row.markSchemeUrl ?? row.examinerReportUrl ?? row.specimenMarkSchemeUrl,
    tier: 'qbank_paper_pair',
    lastChecked: null,
    score: 0.86,
  })) : []
  const pdfTextChunks: QbankContextChunk[] = pdfChunkMatches.slice(0, 2).map((row) => ({
    id: row.id,
    content: `${row.board} ${row.level} ${row.subject}. ${row.title}. ${row.content}`,
    sourceTitle: `${row.subject} PDF evidence - ${row.title}`.trim(),
    sourceUrl: row.sourceUrl,
    tier: 'qbank_pdf_chunk',
    lastChecked: null,
    score: 0.8,
  }))

  const blockedRecoveryChunks: QbankContextChunk[] = blockedRecoveryMatches.slice(0, 2).map((row) => ({
    id: row.id,
    content: `Blocked recovery status: ${row.board} ${row.level} ${row.subject} ${row.year ?? 'unknown year'} ${row.resourceType.replace(/_/g, ' ')} is officially listed but still externally access-blocked${row.officialHttpStatus ? ` (HTTP ${row.officialHttpStatus})` : ''}. Exact filename: ${row.exactFilename ?? 'unknown'}. ${
      row.mirrorPageUrl
        ? `Mirror support page exists from ${row.mirrorProvider ?? 'a secondary provider'}${row.mirrorEvidenceType === 'exact_file_name' && row.mirrorFileNames.length ? ` with matching mirror file names: ${row.mirrorFileNames.slice(0, 3).join(', ')}` : ''}. Use the mirror page as a recovery path, but do not pretend the exact file body is loaded.`
        : 'Do not pretend the file body is loaded. Use nearby official alternatives and tell the student this exact file remains blocked in collection.'
    }`,
    sourceTitle: `${row.subject} ${row.year ?? ''} ${row.resourceType.replace(/_/g, ' ')} blocked recovery`.trim(),
    sourceUrl:
      row.mirrorPageUrl ?? row.officialUrl ?? row.supportSourceUrls[0] ?? row.publicListingUrls[0] ?? null,
    tier: 'qbank_blocked_recovery',
    lastChecked: null,
    score: 0.95,
  }))

  const gapChunks: QbankContextChunk[] = gapMatches.slice(0, 2).map((row) => ({
    id: row.id,
    content:
      row.status === 'access_blocked'
        ? `Coverage status: ${row.board} ${row.level} ${row.subject} ${row.year ?? 'unknown year'} ${row.resourceType.replace(/_/g, ' ')} is listed on an official source but currently access-blocked${row.httpStatus ? ` (HTTP ${row.httpStatus})` : ''}. Do not claim the exact paper or report text is loaded. Tell the student the official listing exists but the file is not publicly retrievable in the current dataset.`
        : row.status === 'source_page_available'
          ? `Coverage status: ${row.board} ${row.level} ${row.subject} ${row.year ?? 'unknown year'} ${row.resourceType.replace(/_/g, ' ')} has an official source page, but the exact PDF is not recovered into the current dataset yet. Do not pretend the exact text is loaded.`
          : `Coverage status: ${row.board} ${row.level} ${row.subject} ${row.year ?? 'unknown year'} ${row.resourceType.replace(/_/g, ' ')} is not yet published in the current known official window. Do not invent this paper or report.`,
    sourceTitle: `${row.board} ${row.level} ${row.subject} ${row.year ?? ''} ${row.resourceType.replace(/_/g, ' ')} coverage status`.trim(),
    sourceUrl: row.sourceUrls[0] ?? null,
    tier: 'qbank_gap_status',
    lastChecked: null,
    score: 0.9,
  }))

  const nearbyResourceChunks: QbankContextChunk[] = nearbyResourceMatches.slice(0, 2).map((row) => ({
    id: row.id,
    content: `Closest official fallback: ${row.board} ${row.level} ${row.subject} ${row.year ?? 'unknown year'} ${row.paperCode ? `Paper ${row.paperCode}. ` : ''}${row.resourceType.replace(/_/g, ' ')} is available from an official source. ${row.yearDistance === null ? '' : `This is ${row.yearDistance} year${row.yearDistance === 1 ? '' : 's'} away from the requested year. `}${row.samePaper ? 'Paper code matches the requested paper. ' : ''}Use this as the nearest official alternative, not as proof that the blocked year has identical content.`,
    sourceTitle: row.title,
    sourceUrl: row.url,
    tier: 'qbank_nearby_official',
    lastChecked: null,
    score: 0.88,
  }))

  const preferConceptFirst =
    parsedQuery.intent === 'formula_lookup' || parsedQuery.intent === 'concept_lookup'
  const preferTopicFirst = parsedQuery.intent === 'topic_review'

  return {
    enabled:
      blockedRecoveryChunks.length > 0 ||
      gapChunks.length > 0 ||
      nearbyResourceChunks.length > 0 ||
      conceptChunks.length > 0 ||
      repeatChunks.length > 0 ||
      questionChunks.length > 0 ||
      topicChunks.length > 0 ||
      sourceChunks.length > 0 ||
      paperChunks.length > 0 ||
      paperPairChunks.length > 0 ||
      pdfTextChunks.length > 0,
    chunks: (
      preferConceptFirst
        ? [
            ...conceptChunks,
            ...repeatChunks,
            ...topicChunks,
            ...questionChunks,
            ...paperPairChunks,
            ...paperChunks,
            ...pdfTextChunks,
            ...blockedRecoveryChunks,
            ...gapChunks,
            ...nearbyResourceChunks,
            ...sourceChunks,
          ]
        : preferTopicFirst
          ? [
              ...repeatChunks,
              ...topicChunks,
              ...conceptChunks,
              ...paperChunks,
              ...paperPairChunks,
              ...questionChunks,
              ...pdfTextChunks,
              ...blockedRecoveryChunks,
              ...gapChunks,
              ...nearbyResourceChunks,
              ...sourceChunks,
            ]
        : [
            ...questionChunks,
            ...paperPairChunks,
            ...paperChunks,
            ...repeatChunks,
            ...conceptChunks,
            ...topicChunks,
            ...pdfTextChunks,
            ...blockedRecoveryChunks,
            ...gapChunks,
            ...nearbyResourceChunks,
            ...sourceChunks,
          ]
    ).slice(0, 4),
    topicMatches: topicResult.matches,
    conceptMatches: strongConceptMatches,
    repeatMatches,
    questionMatches: strongQuestionMatches,
    paperMatches: strongPaperMatches,
    paperPairMatches,
    pdfChunkMatches,
    gapMatches,
    blockedRecoveryMatches,
    nearbyResourceMatches,
    sourceMatches: sourceResult.matches,
    sourceMode:
      questionResult.source === 'compiled' || topicResult.source === 'compiled'
        ? 'compiled'
        : questionResult.enabled || topicResult.enabled || sourceResult.enabled || paperResult.enabled
          ? 'db'
        : 'seed',
    parsedQuery,
    ambiguousPaperLevel,
    showSources:
      !ambiguousPaperLevel &&
      parsedQuery.queryClass === 'PAPER_SEARCH' &&
      (
        bestSourceRelevance >= 0.75 ||
      paperPairMatches.length > 0 ||
      pdfTextChunks.length > 0 ||
      sourceResult.matches.length > 0 ||
      gapChunks.length > 0 ||
        blockedRecoveryChunks.length > 0
      ),
    bestSourceRelevance,
  }
}
