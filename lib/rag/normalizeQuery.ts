export type NormalizedQuery = {
  original: string
  normalizedQuery: string
  language: 'english' | 'banglish' | 'mixed'
  corrections: string[]
}

const WORD_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bwaev\b/gi, 'wave'],
  [/\bwerk\b/gi, 'work'],
  [/\bphsyics\b|\bfisiks\b|\bfiziks\b/gi, 'physics'],
  [/\bchemestry\b|\bkemistry\b/gi, 'chemistry'],
  [/\bmathamatics\b|\bmaths\b/gi, 'mathematics'],
  [/\bphotsynthesis\b/gi, 'photosynthesis'],
  [/\bdifferentation\b/gi, 'differentiation'],
  [/\bnucelus\b/gi, 'nucleus'],
  [/\belctron\b/gi, 'electron'],
  [/\baccleration\b/gi, 'acceleration'],
  [/\bbcz\b|\bcz\b/gi, 'because'],
  [/\bpls\b|\bplz\b/gi, 'please'],
  [/\bhw\b/gi, 'how'],
  [/\bwat\b/gi, 'what'],
  [/\bnxt\b/gi, 'next'],
  [/\bidk\b/gi, "I do not know"],
  [/\bomg\b|\blol\b/gi, ''],
]

const BANGLISH_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bbhai\b/gi, ''],
  [/\ber\b/gi, 'of'],
  [/\bki\b|\bকি\b/gi, 'what'],
  [/\bkeno\b|\bকেনো\b/gi, 'why'],
  [/\bkivabe\b|\bকিভাবে\b/gi, 'how'],
  [/\bbujhte parchi na\b|\bbujhini\b|\bbujhina\b|\bbujhte partasi na\b|\bবুঝিনি\b/gi, 'do not understand'],
  [/\bbujhiye dao\b|\bবুঝিয়ে দাও\b/gi, 'explain please'],
  [/\barekbar\b|\bআরেকবার\b/gi, 'again'],
  [/\beasy kore bolo\b/gi, 'explain simply'],
  [/\bshort kore\b/gi, 'briefly'],
  [/\bdetails e\b/gi, 'in detail'],
  [/\bporer ta\b|\bnext ta\b/gi, 'next'],
  [/\baro dao\b/gi, 'give more'],
  [/\bshesh\b/gi, 'finished'],
  [/\bhelp koro\b/gi, 'help'],
  [/\bpari na\b|\bparina\b/gi, 'cannot do'],
  [/\bskip korsi\b|\bskip korechi\b|\bkori nai\b/gi, 'skipped'],
  [/\bkal exam\b|\bexam kal\b/gi, 'exam tomorrow'],
  [/\bpanic kortesi\b|\bdar lagche\b/gi, 'panic'],
]

export function normalizeQuery(input: string): NormalizedQuery {
  const original = input ?? ''
  let normalized = original
  const corrections: string[] = []

  for (const [pattern, replacement] of [...WORD_REPLACEMENTS, ...BANGLISH_REPLACEMENTS]) {
    if (pattern.test(normalized)) {
      corrections.push(`${pattern.source} -> ${replacement}`)
      normalized = normalized.replace(pattern, replacement)
    }
  }

  normalized = normalized
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

  const hasBanglaScript = /[\u0980-\u09FF]/.test(original)
  const hasBanglish = BANGLISH_REPLACEMENTS.some(([pattern]) => {
    pattern.lastIndex = 0
    return pattern.test(original)
  })

  return {
    original,
    normalizedQuery: normalized,
    language: hasBanglaScript && /[a-z]/i.test(original) ? 'mixed' : hasBanglaScript || hasBanglish ? 'banglish' : 'english',
    corrections,
  }
}
