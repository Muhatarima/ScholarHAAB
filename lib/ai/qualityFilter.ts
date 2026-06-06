function stripLatexCommands(response: string) {
  return response
    .replace(/\\ce\{([^{}]+)\}/g, '$1')
    .replace(/\\(?:text|mathrm|mathbf)\{([^{}]*)\}/g, '$1')
    .replace(/\\(?:left|right)\b/g, '')
}

function removeFillerOpeners(response: string) {
  return response.replace(/^\s*(Certainly!|Of course!|Great question!|Sure!|Absolutely!)[\s,.-]*/i, '').trimStart()
}

function replaceRefusals(response: string) {
  if (!/\b(I don't have|I do not have|I cannot|I can't|not enough information)\b/i.test(response)) {
    return response
  }

  return response.replace(
    /\b(I don't have|I do not have|I cannot|I can't|not enough information)[^.!\n]*(?:[.!\n]|$)/gi,
    'No verified past-paper match is loaded for that exact wording. '
  )
}

function trimLongResponse(response: string) {
  const words = response.split(/\s+/).filter(Boolean)
  if (words.length <= 400) return response
  return `${words.slice(0, 390).join(' ')}\n\nKey point: revise the formula, one worked example, and the mark-scheme wording.`
}

export function filterResponse(response: string): string {
  return trimLongResponse(replaceRefusals(removeFillerOpeners(stripLatexCommands(response))))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n')
    .trim()
}
