import { generateResponse, type AiRequestOptions } from '@/lib/ai-service'
import { getSystemPrompt } from '@/lib/prompts'
import { normalizeMode, type Product, type PromptMode } from '@/lib/products'
import { logError } from '@/lib/server/logger'
import { sanitizeSessionContext, type SessionContext } from '@/lib/sessionContext'

type ConversationMessage = {
  role: 'user' | 'assistant'
  content: string
}

type RagContextBlock = {
  sourceTitle: string
  sourceUrl?: string | null
  content: string
  tier?: string | null
}

type ChatResponseInput = {
  message: string
  product: Product
  mode?: PromptMode
  history?: ConversationMessage[]
  ragContext?: RagContextBlock[]
  sessionContext?: SessionContext | null
  aiRequest?: AiRequestOptions
}

const ABROAD_SPECIFIC_TERMS =
  /\b(australia|canada|germany|japan|hungary|turkey|turkiye|uk|united kingdom|usa|united states|europe|masters|master|phd|bachelor|bachelors|undergraduate|scholarship|visa|funds|budget|ielts|gre|toefl|engineering|computer science|cse|economics|biology|chemistry|physics)\b/i

const QBANK_SPECIFIC_TERMS =
  /\b(cambridge|edexcel|physics|chemistry|math|mathematics|biology|economics|accounting|paper|question|mark scheme|mcq|integration|vectors|periodic table|chapter|topic|o level|a level)\b/i

const FOLLOW_UP_PHRASES =
  /\b(anything else|what else|more options|more like this|shortlist|as per my requirement|as per my requirements|based on that|based on this|according to that|according to this|same profile|same requirements|continue|go on|other options|others|more scholarships|anything more)\b/i

function cleanSentence(text: string, maxChars = 220) {
  const compact = text
    .replace(/\bGuidance sample\s+\d+\b/gi, '')
    .replace(/\bscore\s+\d+\b/gi, '')
    .replace(/\bMatch reasons:\b/gi, '')
    .replace(/\bofficial_backed_guidance\b/gi, '')
    .replace(/\btier\d+_[a-z_]+\b/gi, '')
    .replace(/\btopic:\s*/gi, '')
    .replace(/\bcountry:\s*/gi, '')
    .replace(/\s+\|\s+checked\s+[A-Za-z]{3}\s+\d{4}/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!compact) {
    return ''
  }

  if (compact.length <= maxChars) {
    return compact
  }

  return `${compact.slice(0, maxChars - 3).trim()}...`
}

function compactBlock(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

function normalizeUploadedEvidenceText(text: string) {
  return compactBlock(text)
    .replace(/\bpa\s+ss\s+port\b/gi, 'passport')
    .replace(/\bbank\s+sta\s+te\s+ment\b/gi, 'bank statement')
    .replace(/\boffer\s+let\s+ter\b/gi, 'offer letter')
    .replace(/\btb\s+cer\s+tifi\s+cate\b/gi, 'TB certificate')
    .replace(/\btran\s+script\b/gi, 'transcript')
    .replace(/\bmark\s+sheet\b/gi, 'marksheet')
}

function tokenizeSearch(text: string) {
  return compactBlock(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 2)
}

function getUploadedEvidenceChunks(ragContext: RagContextBlock[]) {
  return ragContext.filter((entry) => String(entry.tier ?? '').startsWith('uploaded_file_'))
}

function getUploadedEvidenceText(chunks: RagContextBlock[]) {
  return chunks
    .filter((entry) => entry.tier === 'uploaded_file_chunk')
    .map((entry) => normalizeUploadedEvidenceText(entry.content))
    .join('\n')
}

function extractRelevantUploadedLines(message: string, uploadedText: string, limit = 3) {
  const tokens = new Set(tokenizeSearch(message))
  const lines = uploadedText
    .split(/(?<=[.!?])\s+|\n+/)
    .map((line) => cleanSentence(line, 220))
    .filter(Boolean)

  return lines
    .map((line) => {
      const lineTokens = tokenizeSearch(line)
      const overlap = lineTokens.reduce((total, token) => total + (tokens.has(token) ? 1 : 0), 0)
      return { line, overlap }
    })
    .filter((entry) => entry.overlap > 0)
    .sort((left, right) => right.overlap - left.overlap)
    .slice(0, limit)
    .map((entry) => entry.line)
}

function extractMentionedDocuments(text: string) {
  const normalized = normalizeUploadedEvidenceText(text).toLowerCase()
  const patterns: Array<{ label: string; pattern: RegExp }> = [
    { label: 'passport copy', pattern: /\bpassport(?: copy)?\b/ },
    { label: 'bank statement', pattern: /\bbank statement\b/ },
    { label: 'offer letter', pattern: /\boffer letter\b/ },
    { label: 'TB certificate', pattern: /\btb certificate\b/ },
    { label: 'transcript', pattern: /\btranscript\b/ },
    { label: 'marksheet', pattern: /\bmarksheet\b/ },
  ]

  return patterns.filter((entry) => entry.pattern.test(normalized)).map((entry) => entry.label)
}

function normalizeSubjectLabel(value: string) {
  return value
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

const GRADE_ORDER: Record<string, number> = {
  'A*': 6,
  A: 5,
  B: 4,
  C: 3,
  D: 2,
  E: 1,
  U: 0,
}

function parseRequiredGrades(text: string) {
  const requirements = new Map<string, { grade: string; allowHigher: boolean }>()
  const pattern = /([A-Za-z][A-Za-z &/-]{2,30}) grade must be (A\*?|B|C|D|E|U)( or higher)?/gi

  for (const match of text.matchAll(pattern)) {
    requirements.set(normalizeSubjectLabel(match[1]), {
      grade: match[2].toUpperCase(),
      allowHigher: Boolean(match[3]),
    })
  }

  return requirements
}

function parseObservedGrades(text: string) {
  const grades = new Map<string, string>()
  const subjectPatterns = [
    'Physics',
    'Chemistry',
    'Mathematics',
    'Math',
    'Biology',
    'English',
    'Economics',
    'Accounting',
    'Computer Science',
    'ICT',
  ]

  for (const subject of subjectPatterns) {
    const pattern = new RegExp(`${subject}:\\s*(A\\*?|B|C|D|E|U)\\b`, 'i')
    const match = pattern.exec(text)
    if (match) {
      grades.set(normalizeSubjectLabel(subject), match[1].toUpperCase())
    }
  }

  return grades
}

function compareUploadedGradeEvidence(text: string) {
  const requirements = parseRequiredGrades(text)
  const observed = parseObservedGrades(text)
  if (requirements.size === 0 || observed.size === 0) {
    return null
  }

  const comparisons = Array.from(requirements.entries())
    .map(([subject, requirement]) => {
      const actual = observed.get(subject)
      if (!actual) {
        return null
      }

      const meets = requirement.allowHigher
        ? (GRADE_ORDER[actual] ?? -1) >= (GRADE_ORDER[requirement.grade] ?? 99)
        : actual === requirement.grade

      return {
        subject,
        actual,
        requirement,
        meets,
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))

  if (comparisons.length === 0) {
    return null
  }

  return {
    meets: comparisons.every((entry) => entry.meets),
    comparisons,
  }
}

function parseStructuredUploadedField(text: string, label: string) {
  const pattern = new RegExp(`\\b${label}:\\s*([^\\n.]+)`, 'i')
  return pattern.exec(text)?.[1]?.trim() ?? null
}

function extractUploadedWarningFiles(uploadedChunks: RagContextBlock[]) {
  const labels = new Set<string>()

  for (const entry of uploadedChunks) {
    if (entry.tier !== 'uploaded_file_warning') {
      continue
    }

    const fromContent = /from\s+([^\s]+?\.[a-z0-9]+)/i.exec(entry.content)?.[1]?.trim()
    const fromTitle = /^(.*?)\s+processing note$/i.exec(entry.sourceTitle)?.[1]?.trim()
    const label = fromContent ?? fromTitle
    if (label) {
      labels.add(label)
    }
  }

  return Array.from(labels)
}

function buildUploadedQbankFallback(
  message: string,
  mode: PromptMode,
  uploadedChunks: RagContextBlock[]
) {
  if (uploadedChunks.length === 0) {
    return null
  }

  const warning = uploadedChunks.find((entry) => entry.tier === 'uploaded_file_warning')
  if (warning) {
    return `${warning.content}\n\nBest next step: upload a clearer image/PDF or type the key question text so I can solve it properly.`
  }

  const uploadedText = getUploadedEvidenceText(uploadedChunks)
  const normalizedMessage = message.toLowerCase()
  const gradeDecision = compareUploadedGradeEvidence(uploadedText)
  const observedGrades = parseObservedGrades(uploadedText)

  if (
    observedGrades.size > 0 &&
    /\b(grade|grades|marksheet|result|image|visible|read)\b/i.test(normalizedMessage)
  ) {
    const visibleGrades = Array.from(observedGrades.entries()).map(
      ([subject, grade]) => `- ${subject}: ${grade}`
    )

    return [
      'Final answer: I can reliably read these grades from the uploaded image:',
      ...visibleGrades,
      '',
      'What is verified: these grades come directly from the visible text inside your uploaded file.',
      mode === 'tutor'
        ? 'Next step: if you want, I can now explain what these grades mean for an entry requirement or scholarship rule. Bujhecho?'
        : 'Next step: if you want, I can now compare these grades with a requirement or solve the related question.',
    ].join('\n')
  }

  if (
    gradeDecision &&
    /\b(minimum entry rule|meet the rule|meets the rule|qualif|entry requirement|using both files)\b/i.test(
      normalizedMessage
    )
  ) {
    const directAnswer = gradeDecision.meets
      ? 'Final answer: Yes, the student meets the minimum entry rule.'
      : 'Final answer: No, the student does not fully meet the minimum entry rule.'
    const steps = gradeDecision.comparisons.map((entry, index) => {
      const requirementText = entry.requirement.allowHigher
        ? `${entry.requirement.grade} or higher`
        : entry.requirement.grade
      return `${index + 1}. ${entry.subject}: the student has ${entry.actual}, and the rule requires ${requirementText}.`
    })

    return [
      directAnswer,
      '',
      'Step-by-step check:',
      ...steps,
      '',
      'Why this works: I compared the grade shown in the uploaded marksheet with the minimum grade rule in the uploaded requirement note.',
      '',
      mode === 'tutor'
        ? 'Memory tip: when a rule says "or higher", compare the grade order instead of checking only exact equality. Bujhecho?'
        : 'Memory tip: treat "or higher" as a grade-order check, not an exact-match check.',
    ].join('\n')
  }

  const relevantLines = extractRelevantUploadedLines(message, uploadedText, 2)
  if (relevantLines.length > 0) {
    return [
      'Based on the uploaded file, here is the strongest grounded answer:',
      '',
      relevantLines[0],
      '',
      mode === 'tutor'
        ? 'If you want, I can now explain this step by step from the uploaded evidence. Bujhecho?'
        : 'Next step: if you want, I can explain the same answer step by step from the uploaded evidence.',
    ].join('\n')
  }

  return null
}

function buildUploadedAbroadFallback(message: string, uploadedChunks: RagContextBlock[]) {
  if (uploadedChunks.length === 0) {
    return null
  }

  const warning = uploadedChunks.find((entry) => entry.tier === 'uploaded_file_warning')
  const warningFiles = extractUploadedWarningFiles(uploadedChunks)
  const uploadedText = getUploadedEvidenceText(uploadedChunks)
  if (warning && !uploadedText) {
    return `${warning.content}\n\nBest next step: upload a clearer scan or the original PDF/document so I can check it properly.`
  }

  const normalizedMessage = message.toLowerCase()
  const program = parseStructuredUploadedField(uploadedText, 'Program')
  const country = parseStructuredUploadedField(uploadedText, 'Country')
  const funding = parseStructuredUploadedField(uploadedText, 'Funding')
  const missingLine = extractRelevantUploadedLines(message, uploadedText, 3).find((line) =>
    /\bmissing\b/i.test(line)
  )

  if (
    warningFiles.length > 0 &&
    missingLine &&
    /\b(unreadable|readable|which file|two uploaded pdf|uploaded pdfs|from these two)\b/i.test(
      normalizedMessage
    )
  ) {
    const extractedMissingDocument =
      /(?:your|the)\s+([^,.]+?)\s+is missing/i.exec(missingLine)?.[1]?.trim() ?? null
    const documents = extractMentionedDocuments(missingLine)
    const documentLabel =
      extractedMissingDocument ??
      documents.find((entry) => /\bbank statement\b/i.test(entry)) ??
      documents[0] ??
      cleanSentence(missingLine, 120)

    return [
      `Direct answer: ${warningFiles.join(', ')} ${warningFiles.length === 1 ? 'is' : 'are'} unreadable, and the readable file says the missing document is the ${documentLabel}.`,
      '',
      `What is verified: the readable upload says "${cleanSentence(missingLine, 180)}"`,
      `What is missing: ${warningFiles.join(', ')} could not be read reliably from the current scan.`,
      'Next step: upload a clearer scan for the unreadable PDF if you want me to combine both files more fully.',
    ].join('\n')
  }

  if (
    (program || country || funding) &&
    /\b(read this document|from this document|scholarship name|fully funded|which country|country)\b/i.test(
      normalizedMessage
    )
  ) {
    return [
      'Direct answer:',
      program ? `- Scholarship/program: ${program}` : null,
      country ? `- Country: ${country}` : null,
      funding ? `- Funding: ${funding}` : null,
      '',
      'What is verified: these details came directly from your uploaded document.',
      'What still needs official confirmation: university-specific conditions like IELTS waiver or nomination rules.',
      'Next step: check the official scholarship page before relying on eligibility details.',
    ]
      .filter(Boolean)
      .join('\n')
  }

  if (
    missingLine &&
    /\b(missing|incomplete|which document)\b/i.test(normalizedMessage)
  ) {
    const extractedMissingDocument =
      /(?:your|the)\s+([^,.]+?)\s+is missing/i.exec(missingLine)?.[1]?.trim() ?? null
    const documents = extractMentionedDocuments(missingLine)
    const documentLabel =
      extractedMissingDocument ??
      documents.find((entry) => /\bbank statement\b/i.test(entry)) ??
      documents[0] ??
      cleanSentence(missingLine, 120)
    return [
      `Direct answer: the missing document is the ${documentLabel}.`,
      '',
      `What is verified: your uploaded file says "${cleanSentence(missingLine, 180)}"`,
      'Next step: add that missing document before submission and then re-check the full checklist.',
    ].join('\n')
  }

  const mentionedDocuments = extractMentionedDocuments(uploadedText)
  if (
    mentionedDocuments.length > 0 &&
    /\b(document|documents|checklist|scan|ocr|read reliably)\b/i.test(normalizedMessage)
  ) {
    return [
      'Direct answer:',
      ...mentionedDocuments.map((entry) => `- ${entry}`),
      '',
      'What is verified: these document names are readable from your uploaded text.',
      'Next step: if you want, I can turn this into a clean document checklist for you.',
    ].join('\n')
  }

  const relevantLines = extractRelevantUploadedLines(message, uploadedText, 2)
  if (relevantLines.length > 0) {
    return [
      'Direct answer from your uploaded file:',
      '',
      relevantLines[0],
      '',
      'What is verified: this comes from the uploaded file content.',
      'Next step: if you want, send the destination country or university and I will interpret what this means for you.',
    ].join('\n')
  }

  return null
}

function buildQbankFallback(
  message: string,
  history: ConversationMessage[],
  mode: PromptMode,
  ragContext: RagContextBlock[]
) {
  const uploadedFallback = buildUploadedQbankFallback(message, mode, getUploadedEvidenceChunks(ragContext))
  if (uploadedFallback) {
    return uploadedFallback
  }

  const exact = ragContext.find((entry) => entry.tier === 'qbank_exact_answer')
  const partial = ragContext.find((entry) => entry.tier === 'qbank_partial_answer')
  const concept = ragContext.find((entry) => String(entry.tier).includes('concept'))
  const pair = ragContext.find((entry) => entry.tier === 'qbank_paper_pair')
  const gap = ragContext.find((entry) =>
    ['qbank_gap_status', 'qbank_blocked_recovery', 'qbank_nearby_official'].includes(
      String(entry.tier)
    )
  )

  const lines: string[] = []
  const followUp = isContextDependentFollowUp(message, history, 'qbank')
  const normalized = message.toLowerCase()
  const isTopicAsk = /\b(important|repeat|repeats|topic|chapter|most important)\b/.test(normalized)
  const isConceptAsk =
    /\b(formula|equation|what is|define|definition|explain|different|deriv|integrat|dy\/dx|y=)\b/.test(
      normalized
    )
  const compactConceptText = concept ? cleanSentence(concept.content, 260) : ''

  if (isConceptAsk && concept) {
    lines.push(compactConceptText)
    if (mode === 'tutor') {
      lines.push('If you want, I can turn this into a short step-by-step example next.')
    }
  } else if (isTopicAsk && concept) {
    lines.push(`The strongest revision direction I can support right now is ${compactConceptText}`)
  } else if (exact) {
    lines.push(cleanSentence(exact.content, 320))
  } else if (partial) {
    lines.push(cleanSentence(partial.content, 320))
  } else if (concept) {
    lines.push(compactConceptText)
  }

  if (pair && !lines.some((line) => line.includes(pair.sourceTitle))) {
    lines.push(`The closest matching paper pair I can rely on here is ${pair.sourceTitle}.`)
  }

  if (gap) {
    lines.push(cleanSentence(gap.content, 220))
  }

  if (followUp && !exact && !partial) {
    lines.push('I treated this as a follow-up to your earlier topic instead of a brand-new question.')
  }

  if (isTopicAsk) {
    lines.push('If you tell me the board and year, I can rank the top repeating areas more tightly.')
  } else if (isConceptAsk && mode === 'tutor') {
    lines.push('If you want, I can teach this step by step instead of only giving the final line.')
  }

  return lines.filter(Boolean).join('\n\n')
}

function buildAbroadFallback(
  message: string,
  history: ConversationMessage[],
  ragContext: RagContextBlock[]
) {
  const uploadedFallback = buildUploadedAbroadFallback(message, getUploadedEvidenceChunks(ragContext))
  if (uploadedFallback) {
    return uploadedFallback
  }

  const followUp = isContextDependentFollowUp(message, history, 'abroad')
  const normalized = message.toLowerCase()
  const scholarships = ragContext.filter(
    (entry) => entry.tier === 'tier0_structured_match' || /scholarship/i.test(entry.sourceTitle)
  )
  const scholarship = scholarships[0]
  const guidance = ragContext.find((entry) =>
    ['tier1_official', 'tier2_internal_live', 'official_backed_guidance'].some((tier) =>
      String(entry.tier).includes(tier)
    )
  )

  const lines: string[] = []
  const isShortlistAsk = /\b(shortlist|anything else|more options|more scholarships|other options)\b/.test(
    normalized
  )
  const isPracticalAsk =
    /\b(visa|fund|funds|budget|living|rent|cost|proof of funds|bank statement|maintenance)\b/.test(
      normalized
    )
  const isDocumentAsk = /\b(sop|lor|cv|resume|essay|transcript|document)\b/.test(normalized)

  const scholarshipCards = scholarships.slice(0, 5).map((entry) => ({
    name: entry.sourceTitle,
    country:
      /\bcountry:\s*([^\n.]+)/i.exec(entry.content)?.[1]?.trim() ??
      /\b(australia|canada|germany|japan|united kingdom|united states|europe)\b/i.exec(entry.content)?.[1] ??
      'Check official page',
    degree:
      /\bdegree(?: levels?)?:\s*([^\n.]+)/i.exec(entry.content)?.[1]?.trim() ??
      'Check official page',
    funding:
      /\bfunding(?: type| amount| amount text)?:\s*([^\n.]+)/i.exec(entry.content)?.[1]?.trim() ??
      'Check official page',
    deadline:
      /\bdeadline(?: annual| notes)?:\s*([^\n.]+)/i.exec(entry.content)?.[1]?.trim() ??
      'Check official page',
    matchReason: 'Matches your saved country, degree, and field filters.',
    link: entry.sourceUrl ?? undefined,
  }))

  if ((followUp || isShortlistAsk) && scholarships.length > 1) {
    lines.push('Based on your profile, these are the scholarship options I would shortlist first:')
    lines.push(`<scholarships>${JSON.stringify(scholarshipCards, null, 2)}</scholarships>`)
  } else if (scholarships.length > 1 && /\b(scholarship|funded|masters|phd|bachelor|study abroad)\b/.test(normalized)) {
    lines.push('Here are the strongest scholarship matches I can see right now:')
    lines.push(`<scholarships>${JSON.stringify(scholarshipCards, null, 2)}</scholarships>`)
  } else if (isPracticalAsk && guidance) {
    lines.push('Here is the practical answer first:')
    lines.push(cleanSentence(guidance.content, 320))
  } else if (isDocumentAsk && guidance) {
    lines.push('Here is the honest review direction I would give:')
    lines.push(cleanSentence(guidance.content, 320))
  } else if (scholarship) {
    lines.push(cleanSentence(scholarship.content, 260))
  }

  if (guidance && guidance !== scholarship) {
    lines.push(`Reality check: ${cleanSentence(guidance.content, 180)}`)
  }

  if (followUp || isShortlistAsk) {
    lines.push('Send your CGPA, subject, budget, and preferred countries if you want me to rank this shortlist properly.')
  } else if (isPracticalAsk) {
    lines.push('Send the exact country, city, and your money situation if you want a more realistic answer.')
  } else if (isDocumentAsk) {
    lines.push('Paste the draft or upload the file if you want me to point out what is weak and how to fix it.')
  } else {
    lines.push('If you share your exact profile, country target, and degree goal, I can narrow this properly.')
  }

  return lines.filter(Boolean).join('\n\n')
}

function buildResponseStyleHint(product: Product, message: string) {
  const normalized = message.toLowerCase()

  if (product === 'qbank') {
    if (/\b(formula|equation|what is|define|definition|explain|different|deriv|integrat|dy\/dx|y=)\b/.test(normalized)) {
      return 'Structure it as: Final answer, step-by-step working, why this method works, one common mistake, and one memory tip. Do not use Question/Solution format unless there is an actual retrieved exam question.'
    }

    if (/\b(important|repeat|repeats|topic|chapter|most important)\b/.test(normalized)) {
      return 'Answer like an exam coach. Give the direct priority first, then rank the likely topics, explain why they matter, and end with one clear exam action.'
    }

    if (/\b(question|paper|\b20\d{2}\b)\b/.test(normalized)) {
      return 'If the retrieved context includes a real paper or question, solve it clearly with no reasoning jumps. If not, say exactly which paper detail is still missing.'
    }
  }

  if (product === 'abroad') {
    if (/\b(shortlist|anything else|more options|other options|more scholarships)\b/.test(normalized)) {
      return 'Continue from the earlier student profile and give a realistic shortlist with brief reasons.'
    }

    if (/\b(sop|lor|cv|resume|transcript|essay|document)\b/.test(normalized)) {
      return 'Structure it as: overall verdict, what is strong, what is weak, exact improvement advice, and the top priority fix.'
    }

    if (/\b(visa|fund|funds|budget|living|rent|cost|proof of funds)\b/.test(normalized)) {
      return 'Structure it as: direct answer, requirement breakdown, important risk, what is verified, what still needs official confirmation, and one next step.'
    }
  }

  return null
}

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function shouldUseDirectOverride(message: string) {
  return /\b(just tell me the answer|just the answer|direct mode|give me the answer directly)\b/i.test(
    message
  )
}

function requiresMathFormatting(message: string) {
  return /\b(differentiate|derivative|integrate|formula|equation|sin|cos|tan|log|ln|dy\/dx|physics|chemistry|math|mathematics)\b/i.test(
    message
  )
}

function looksTutorDiagnostic(text: string) {
  return /\?/i.test(text)
}

function looksTutorEnding(text: string) {
  return /(bujhecho\??|practice question\??|now try this|your turn|bolo|can you try)/i.test(text)
}

function containsLatex(text: string) {
  return /\$[^$]+\$|\$\$[\s\S]+?\$\$/i.test(text)
}

async function enforceTutorModeResponse({
  response,
  message,
  product,
  history,
  ragContext,
  sessionContext,
  aiRequest,
}: {
  response: string
  message: string
  product: Product
  history: ConversationMessage[]
  ragContext: RagContextBlock[]
  sessionContext?: SessionContext | null
  aiRequest?: AiRequestOptions
}) {
  if (product !== 'qbank') {
    return response
  }

  const session = sanitizeSessionContext(sessionContext)
  const isFrustrated = session.frustration_level >= 2
  const earlyTurn = session.message_count <= 2
  const directOverride = shouldUseDirectOverride(message)
  const needsQuestion = earlyTurn && !isFrustrated && !directOverride

  const validQuestion = !needsQuestion || looksTutorDiagnostic(response)
  const validLength = countWords(response) <= 200 || isFrustrated
  const validMath = !requiresMathFormatting(message) || containsLatex(response)
  const validEnding = looksTutorEnding(response)

  if (validQuestion && validLength && validMath && validEnding) {
    return response
  }

  try {
    const repairPrompt = [
      'Your last response did not match Rafiq Bhai tutor mode.',
      'Rewrite it as Rafiq Bhai - guide, do not dump the answer first unless direct mode was requested.',
      needsQuestion
        ? 'You must ask one diagnostic question back to the student in this reply.'
        : 'The student seems frustrated or is past the first exchanges, so explain warmly and clearly.',
      validLength ? null : 'Keep it under 200 words.',
      validMath ? null : 'Use LaTeX for any math or formula.',
      validEnding ? null : 'End with either a practice question or a short "Bujhecho?" check.',
      '',
      `Student message: ${message}`,
      '',
      `Your previous reply: ${response}`,
    ]
      .filter(Boolean)
      .join('\n')

    const repaired = await generateResponse(
      buildPromptText(repairPrompt, history, ragContext, product),
      getSystemPrompt(product, 'tutor', sessionContext),
      {
        ...aiRequest,
        maxTokens: 260,
        operation: aiRequest?.operation ?? `${product}_tutor_rewrite`,
      }
    )

    return repaired.trim() || response
  } catch (error) {
    logError('tutor_mode_rewrite_failed', error, {
      product,
      message_preview: message.slice(0, 120),
    })
    return response
  }
}

export function buildFallbackChatResponse({
  message,
  product,
  mode = 'direct',
  history = [],
  ragContext = [],
}: ChatResponseInput) {
  if (ragContext.length === 0) {
    return product === 'qbank'
      ? 'I do not have a specific past-paper match loaded for that yet, but if you give me the board, year, and paper I can narrow it quickly.'
      : 'I do not have enough grounded scholarship context for that yet. Share your CGPA, subject, budget, and target country and I will narrow it.'
  }

  return product === 'qbank'
    ? buildQbankFallback(message, history, mode, ragContext)
    : buildAbroadFallback(message, history, ragContext)
}

export function getResponseBudget(product: Product, mode: PromptMode, message: string): number {
  if (product === 'abroad') {
    if (/\b(sop|lor|cv|resume|transcript|essay|document)\b/i.test(message)) {
      return 560
    }

    return 380
  }

  if (mode === 'tutor') {
    return 420
  }

  if (/\b(formula|equation|what is|define|definition|explain|different|deriv|integrat|dy\/dx|solve)\b/i.test(message)) {
    return 520
  }

  return 440
}

function trimHistoryContent(content: string, maxChars = 260) {
  const compact = content.replace(/\s+/g, ' ').trim()
  if (compact.length <= maxChars) {
    return compact
  }

  return `${compact.slice(0, maxChars - 3).trim()}...`
}

function buildCarriedContext(history: ConversationMessage[], limit = 3) {
  return history
    .filter((entry) => entry.role === 'user')
    .slice(-limit)
    .map((entry) => trimHistoryContent(entry.content, 180))
}

export function isContextDependentFollowUp(
  message: string,
  history: ConversationMessage[] = [],
  product?: Product
) {
  if (history.length === 0) {
    return false
  }

  const normalized = message.replace(/\s+/g, ' ').trim().toLowerCase()
  const tokenCount = normalized.split(' ').filter(Boolean).length
  const hasReferentialLanguage = /\b(it|that|this|those|these|them|same|more|else|requirements?)\b/i.test(
    normalized
  )
  const hasSpecificTerms =
    product === 'qbank'
      ? QBANK_SPECIFIC_TERMS.test(normalized)
      : product === 'abroad'
        ? ABROAD_SPECIFIC_TERMS.test(normalized)
        : ABROAD_SPECIFIC_TERMS.test(normalized) || QBANK_SPECIFIC_TERMS.test(normalized)

  return FOLLOW_UP_PHRASES.test(normalized) || (tokenCount <= 18 && hasReferentialLanguage && !hasSpecificTerms)
}

export function buildRetrievalQuery(
  product: Product,
  message: string,
  history: ConversationMessage[] = []
) {
  if (!isContextDependentFollowUp(message, history, product)) {
    return message
  }

  const carried = buildCarriedContext(history, 3)
  if (carried.length === 0) {
    return message
  }

  return `${carried.join(' ')} ${message}`.trim()
}

export function buildPromptText(
  message: string,
  history: ConversationMessage[] = [],
  ragContext: RagContextBlock[] = [],
  product?: Product
) {
  const recentHistory = history.slice(-6)
  const followUp = isContextDependentFollowUp(message, history)
  const carriedContext = followUp ? buildCarriedContext(history, 3) : []
  const ragBlock =
    ragContext.length > 0
      ? `Retrieved reference context:\n${ragContext
          .slice(0, 4)
          .map(
            (entry, index) =>
              `[${index + 1}]${entry.tier ? ` [${entry.tier}]` : ''} ${entry.sourceTitle}${entry.sourceUrl ? ` | ${entry.sourceUrl}` : ''}\n${trimHistoryContent(entry.content, 420)}`
          )
          .join('\n\n')}\n\n`
      : ''

  const followUpBlock =
    followUp && carriedContext.length > 0
      ? `Follow-up handling rule:\nThis new message depends on the earlier user context. Continue from that context unless the student clearly changes topic.\n\nCarried user context:\n${carriedContext
          .map((entry, index) => `${index + 1}. ${entry}`)
          .join('\n')}\n\n`
      : ''
  const responseStyleHint = product ? buildResponseStyleHint(product, message) : null
  const responseStyleBlock = responseStyleHint
    ? `Answer shape hint:\n${responseStyleHint}\n\n`
    : ''

  if (recentHistory.length === 0) {
    return `${ragBlock}${followUpBlock}${responseStyleBlock}New user message:\n${message}`.trim()
  }

  const historyBlock = recentHistory
    .map((entry) =>
      `${entry.role === 'user' ? 'Student' : 'ScholarHAAB'}: ${trimHistoryContent(entry.content)}`
    )
    .join('\n')

  return `${ragBlock}${followUpBlock}${responseStyleBlock}Recent conversation context:\n${historyBlock}\n\nNew user message:\n${message}`.trim()
}

export async function buildChatResponse({
  message,
  product,
  mode = 'direct',
  history = [],
  ragContext = [],
  sessionContext,
  aiRequest,
}: ChatResponseInput): Promise<string> {
  const trimmedMessage = message.trim()
  if (!trimmedMessage) {
    throw new Error('Message is required')
  }

  const normalizedMode = normalizeMode(product, mode)
  const systemPrompt = getSystemPrompt(product, normalizedMode, sessionContext)
  const maxTokens = getResponseBudget(product, normalizedMode, trimmedMessage)
  const response = await generateResponse(
    buildPromptText(trimmedMessage, history, ragContext, product),
    systemPrompt,
    {
      ...aiRequest,
      maxTokens,
      operation: aiRequest?.operation ?? `${product}_chat`,
    }
  )

  if (normalizedMode === 'tutor') {
    return enforceTutorModeResponse({
      response,
      message: trimmedMessage,
      product,
      history,
      ragContext,
      sessionContext,
      aiRequest,
    })
  }

  return response
}
