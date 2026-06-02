export type DiagramKind =
  | 'wave'
  | 'circuit'
  | 'ray'
  | 'force'
  | 'molecule'
  | 'bonding'
  | 'reaction_pathway'
  | 'cell'
  | 'organ'
  | 'geometry'
  | 'coordinate'
  | 'vector'

export type DiagramSpec = {
  kind: DiagramKind
  title: string
  description: string
  safeSvg: string
}

function svgFrame(inner: string, label: string) {
  return `<svg role="img" aria-label="${label.replace(/"/g, '')}" viewBox="0 0 300 180" xmlns="http://www.w3.org/2000/svg"><rect width="300" height="180" rx="18" fill="#050514"/><rect x="1" y="1" width="298" height="178" rx="18" fill="none" stroke="rgba(192,132,252,.35)"/>${inner}</svg>`
}

export function generateDiagramSpec(kind: DiagramKind, topic: string = kind): DiagramSpec {
  if (kind === 'wave') {
    return {
      kind,
      title: 'Wave diagram',
      description: 'Shows amplitude and wavelength for transverse-wave questions.',
      safeSvg: svgFrame('<path d="M20 90 C45 35 75 35 100 90 S155 145 180 90 S235 35 260 90" fill="none" stroke="#C084FC" stroke-width="3"/><line x1="20" y1="90" x2="280" y2="90" stroke="#8B7CB8" stroke-dasharray="4"/><text x="115" y="160" fill="#C4B5FD">wavelength λ</text><text x="112" y="58" fill="#FDE68A">amplitude</text>', 'Wave diagram'),
    }
  }

  if (kind === 'circuit') {
    return {
      kind,
      title: 'Circuit diagram',
      description: 'Simple series circuit for current, voltage, and resistance questions.',
      safeSvg: svgFrame('<rect x="45" y="45" width="210" height="95" fill="none" stroke="#E9D5FF" stroke-width="3"/><rect x="126" y="36" width="52" height="18" fill="#100B24" stroke="#C084FC" stroke-width="2"/><text x="144" y="50" fill="#E9D5FF">R</text><line x1="43" y1="80" x2="43" y2="105" stroke="#E9D5FF" stroke-width="4"/><line x1="32" y1="90" x2="56" y2="90" stroke="#E9D5FF" stroke-width="3"/>', 'Circuit diagram'),
    }
  }

  if (kind === 'cell') {
    return {
      kind,
      title: 'Cell diagram',
      description: 'Cell structure visual for nucleus, membrane, cytoplasm, and organelles.',
      safeSvg: svgFrame('<ellipse cx="150" cy="92" rx="105" ry="58" fill="rgba(34,197,94,.08)" stroke="#86EFAC" stroke-width="3"/><circle cx="135" cy="88" r="25" fill="rgba(192,132,252,.25)" stroke="#C084FC" stroke-width="2"/><ellipse cx="196" cy="100" rx="20" ry="10" fill="rgba(250,204,21,.2)" stroke="#FDE68A"/><text x="116" y="92" fill="#F3E8FF">nucleus</text><text x="175" y="132" fill="#FDE68A">mitochondrion</text>', 'Cell diagram'),
    }
  }

  return {
    kind,
    title: `${topic} diagram`,
    description: `Safe SVG academic visual for ${topic}.`,
    safeSvg: svgFrame('<line x1="48" y1="142" x2="260" y2="142" stroke="#8B7CB8"/><line x1="58" y1="24" x2="58" y2="150" stroke="#8B7CB8"/><path d="M58 128 C100 92 145 70 210 44" fill="none" stroke="#C084FC" stroke-width="3"/><text x="210" y="160" fill="#C4B5FD">x</text><text x="35" y="35" fill="#C4B5FD">y</text>', `${topic} diagram`),
  }
}

export function suggestDiagramKind(text: string): DiagramKind | null {
  const lower = text.toLowerCase()
  if (/wave|wavelength|amplitude/.test(lower)) return 'wave'
  if (/circuit|resistor|current|voltage/.test(lower)) return 'circuit'
  if (/ray|lens|reflection|refraction/.test(lower)) return 'ray'
  if (/force|free body|weight|normal/.test(lower)) return 'force'
  if (/molecule|bonding|covalent|ionic/.test(lower)) return 'bonding'
  if (/cell|nucleus|organ/.test(lower)) return 'cell'
  if (/triangle|geometry/.test(lower)) return 'geometry'
  if (/coordinate|graph|curve/.test(lower)) return 'coordinate'
  if (/vector/.test(lower)) return 'vector'
  return null
}
