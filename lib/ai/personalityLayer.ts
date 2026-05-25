type Tone = 'calculation' | 'explanation' | 'definition' | 'confused' | 'general'

const REACTIONS: Record<Tone, string[]> = {
  calculation: [
    'Ooh calculation time! 🧮',
    'Classic exam question this one!',
    "Arre let's crack this!",
    "Good one — let's break it down.",
    'This type comes up EVERY year btw 👀',
  ],
  explanation: [
    'Great question — this confuses so many students.',
    'Okay let me explain this properly.',
    'Haan this one needs a bit of thinking.',
    'Arre good that you asked this!',
    'This is actually fascinating once you see it.',
  ],
  definition: [
    'Sharp! Definitions score easy marks.',
    'Cambridge LOVES asking this.',
    'Quick one — but must be precise!',
    'This is a freebie if you know the words.',
    'Examiners are strict about definitions — listen up!',
  ],
  confused: [
    "Don't worry — this confuses everyone at first.",
    "Haan it looks scary but it's actually simple.",
    "Okay let's slow down and go step by step.",
    "You're not alone — this trips up lots of students.",
    'Good that you asked rather than guessing!',
  ],
  general: [
    "Let's get into it!",
    'Good question!',
    'Okay here we go!',
    'Shoja answer দিই —',
    'Let me help you with this.',
  ],
}

const CHALLENGES = [
  'Now try this: what if the value was doubled? 🤔',
  'Quick check — can you tell me WHY that formula works?',
  'Your turn — solve one similar question without looking.',
  'What mark would you give yourself for this topic? 1-10?',
  'Next step: try a past paper question on this topic!',
  "Think you've got it? Try without looking at the formula 😄",
]

const EDEXCEL_REACTIONS = {
  mark_explanation: [
    "Edexcel gives B marks for accuracy — let's make sure you get all of them!",
    'This is an M1 moment — show the METHOD clearly!',
    'Pearson wants to see your working — every step = marks!',
    "Edexcel IAL style — let's nail the mark scheme!",
  ],
  encouragement: [
    'Edexcel papers are actually quite fair once you know the style!',
    "Pearson loves clear working — you're already halfway there!",
    'IAL students often score higher because the marking is transparent!',
  ],
}

export function detectMessageTone(message: string): Tone {
  const lower = message.toLowerCase()

  if (/calculate|find|determine|work out|solve|value|answer|formula|frequency|wavelength|wave speed/.test(lower)) {
    return 'calculation'
  }
  if (/confus|don.?t understand|bujhte parchi na|bujhini|bujhi nai|stuck|atke/.test(lower)) {
    return 'confused'
  }
  if (/explain|why|how does|what causes|kivabe|keno|bujhiye/.test(lower)) {
    return 'explanation'
  }
  if (/define|what is|what are|state|ki hoy|ki/.test(lower)) {
    return 'definition'
  }
  return 'general'
}

export function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function addPersonalityOpening(
  tone: string,
  response: string
): string {
  const alreadyPersonal = /^(Arre|Ooh|Haan|Okay|Let|Good|Classic|Sharp|Quick|Don.t|Great|Shoja|Almost|Close)/i.test(
    response.trim()
  )

  if (alreadyPersonal) return response

  const reactions = REACTIONS[tone as Tone] || REACTIONS.general
  const opening = getRandomItem(reactions)

  return `${opening}\n\n${response}`
}

export function removeRoboticHeaders(response: string): string {
  return response
    .replace(/\*\*Confidence:\*\*\s*(?:✅|🔶|⚠️|🧠)?\s*(VERIFIED|PARTIAL|REASONING|EXPERT)/g, '')
    .replace(/\*\*Source:\*\*\s*/g, '📚 ')
    .replace(/\*\*Solution:\*\*\s*/g, '')
    .replace(/\*\*Mark Scheme:\*\*\s*/g, '\nCambridge marks this as:\n')
    .replace(/\*\*Examiner Tip:\*\*\s*/g, '\n💡 Exam tip: ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function addConfidenceCasually(
  response: string,
  badge: string,
  level: string
): string {
  const confidenceLines: Record<string, string> = {
    VERIFIED: '*(Straight from Cambridge past papers ✅)*',
    PARTIAL: '*(Similar past paper found — adapted for you 🔶)*',
    REASONING: '*(My best Cambridge reasoning — no exact past paper ⚠️)*',
    EXPERT: '*(Cambridge expert answer — verify with mark scheme 🧠)*',
  }

  const line = confidenceLines[level] || ''
  if (!line || response.includes(line) || response.includes(badge)) return response

  const lines = response.split('\n')
  if (lines.length > 1) {
    lines.splice(1, 0, line)
    return lines.join('\n')
  }
  return `${response}\n${line}`
}

export function polishResponse(
  rawResponse: string,
  messageTone: string,
  confidenceBadge: string,
  confidenceLevel: string,
  board?: string
): string {
  let response = rawResponse

  response = removeRoboticHeaders(response)
  response = addConfidenceCasually(
    response,
    confidenceBadge,
    confidenceLevel
  )

  if (board === 'edexcel') {
    response = response
      .replace(/Cambridge/g, 'Edexcel')
      .replace(/CAIE/g, 'Pearson')
      .replace(/mark scheme/g, 'Edexcel mark scheme')

    if (!/Edexcel|Pearson/.test(response)) {
      response = `${getRandomItem(EDEXCEL_REACTIONS.mark_explanation)}\n\n${response}`
    }
  }

  response = addPersonalityOpening(messageTone, response)

  const endsWithQuestion = /[?](\s*[🎯🤔😄])?$/.test(response.trim())
  if (!endsWithQuestion) {
    response = `${response}\n\n${getRandomItem(CHALLENGES)}`
  }

  return response
}
