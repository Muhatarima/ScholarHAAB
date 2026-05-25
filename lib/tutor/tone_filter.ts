const BANNED_PHRASES = [
  'certainly',
  'of course',
  'great question',
  "i'd be happy to",
  'i hope this helps',
  'in conclusion',
  'to summarize',
  'as an ai',
  'as a language model',
  'i cannot',
  'i am unable',
  'please note that',
  'it is important to note',
  'furthermore',
  'moreover',
  'in addition to',
  'it should be noted',
  'needless to say',
]

const REPLACEMENTS: Record<string, string> = {
  certainly: 'okay so',
  'of course': 'right —',
  'great question': '',
  "i'd be happy to": "let's",
  'i hope this helps': 'come back if stuck',
  'in conclusion': 'so basically',
  furthermore: 'also',
  moreover: 'and',
  'it is important to note': 'key thing —',
}

export function filterTone(text: string): string {
  let result = text
  for (const [banned, replacement] of Object.entries(REPLACEMENTS)) {
    const regex = new RegExp(banned, 'gi')
    result = result.replace(regex, replacement)
  }
  for (const phrase of BANNED_PHRASES) {
    if (!REPLACEMENTS[phrase]) {
      const regex = new RegExp(`${phrase}[^.]*\\.\\s*`, 'gi')
      result = result.replace(regex, '')
    }
  }
  return result.trim()
}

export function hasBannedPhrases(text: string): boolean {
  return BANNED_PHRASES.some((phrase) => text.toLowerCase().includes(phrase))
}

export { BANNED_PHRASES, REPLACEMENTS }

