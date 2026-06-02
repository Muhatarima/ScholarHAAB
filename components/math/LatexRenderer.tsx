'use client'

import 'katex/dist/katex.min.css'
import { InlineMath, BlockMath } from 'react-katex'

type LatexRendererProps = {
  latex: string
  display?: boolean
  className?: string
}

export default function LatexRenderer({ latex, display = false, className = '' }: LatexRendererProps) {
  if (!latex.trim()) return null

  return (
    <span className={className}>
      {display ? <BlockMath math={latex} /> : <InlineMath math={latex} />}
    </span>
  )
}
