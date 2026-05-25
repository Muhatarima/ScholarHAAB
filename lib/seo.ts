import type { Metadata } from 'next'

export const SITE_NAME = 'ScholarHAAB'
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://scholarhaab.com'
export const SITE_DESCRIPTION =
  'ScholarHAAB helps Bangladeshi students with Cambridge and Edexcel A Level and O Level past-paper solving, tutor-mode learning, and repeated-topic exam prep.'

export function buildMetadata({
  title,
  description,
  path = '/',
  keywords = [],
}: {
  title: string
  description: string
  path?: string
  keywords?: string[]
}): Metadata {
  const url = new URL(path, SITE_URL).toString()

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export type SeoLandingPage = {
  slug: string
  title: string
  description: string
  board?: string
  level?: string
  subject?: string
  samplePrompts: string[]
  keywords: string[]
}

export const QBANK_SEO_PAGES: SeoLandingPage[] = [
  {
    slug: 'edexcel-a-level-physics-past-paper-solver',
    title: 'Edexcel A Level Physics Past Paper Solver',
    description:
      'Search year-wise Edexcel A Level Physics papers, topic hints, formulas, and solved answer guidance in ScholarHAAB QBank.',
    board: 'Edexcel',
    level: 'A Level',
    subject: 'Physics',
    samplePrompts: [
      '2021 physics edexcel paper 1 solve',
      'important questions of vectors in Edexcel A Level Physics',
      'find graphs and practical questions from recent Edexcel physics papers',
    ],
    keywords: ['edexcel a level physics past paper solver', 'physics paper 1 edexcel answer', 'a level physics important questions'],
  },
  {
    slug: 'edexcel-a-level-chemistry-past-paper-solver',
    title: 'Edexcel A Level Chemistry Past Paper Solver',
    description:
      'Use ScholarHAAB QBank to search Edexcel A Level Chemistry papers, repeated topics, formula help, and structured answer guidance.',
    board: 'Edexcel',
    level: 'A Level',
    subject: 'Chemistry',
    samplePrompts: [
      '2022 chemistry edexcel unit 1 important questions',
      'periodic table repeat questions Edexcel A Level Chemistry',
      'solve equilibrium question from recent Edexcel chemistry papers',
    ],
    keywords: ['edexcel a level chemistry past paper solver', 'a level chemistry important questions', 'periodic table edexcel chemistry questions'],
  },
  {
    slug: 'edexcel-a-level-maths-past-paper-solver',
    title: 'Edexcel A Level Maths Past Paper Solver',
    description:
      'Find Edexcel A Level Maths past-paper questions by year, topic, and paper code with ScholarHAAB QBank.',
    board: 'Edexcel',
    level: 'A Level',
    subject: 'Mathematics',
    samplePrompts: [
      '2021 maths edexcel paper 1 solve',
      'important integration questions in Edexcel A Level maths',
      'vector questions year wise Edexcel A Level',
    ],
    keywords: ['edexcel a level maths past paper solver', 'integration questions edexcel a level maths', 'vector questions year wise maths'],
  },
  {
    slug: 'cambridge-a-level-biology-past-paper-solver',
    title: 'Cambridge A Level Biology Past Paper Solver',
    description:
      'Search Cambridge A Level Biology papers, diagrams, graphs, and practical-heavy questions in ScholarHAAB QBank.',
    board: 'Cambridge',
    level: 'A Level',
    subject: 'Biology',
    samplePrompts: [
      '2020 Cambridge A Level Biology paper 4 solve',
      'diagram and graph questions in A Level Biology',
      'important practical questions in Cambridge Biology',
    ],
    keywords: ['cambridge a level biology past paper solver', 'a level biology practical questions', 'biology diagram questions cambridge'],
  },
  {
    slug: 'cambridge-o-level-physics-past-paper-solver',
    title: 'Cambridge O Level Physics Past Paper Solver',
    description:
      'ScholarHAAB QBank helps with Cambridge O Level Physics past papers, topic-wise solving, and important repeated questions.',
    board: 'Cambridge',
    level: 'O Level',
    subject: 'Physics',
    samplePrompts: [
      '2023 O Level Physics important questions',
      'solve motion graph question Cambridge O Level Physics',
      'top electricity questions in O Level physics',
    ],
    keywords: ['o level physics past paper solver', 'cambridge o level physics questions', 'motion graph o level physics'],
  },
  {
    slug: 'cambridge-o-level-chemistry-past-paper-solver',
    title: 'Cambridge O Level Chemistry Past Paper Solver',
    description:
      'Use ScholarHAAB QBank for Cambridge O Level Chemistry past papers, topic-wise queries, and important repeat-question analysis.',
    board: 'Cambridge',
    level: 'O Level',
    subject: 'Chemistry',
    samplePrompts: [
      '2021 O Level Chemistry solve',
      'important periodic table questions O Level Chemistry',
      'find acid base and salt questions year wise',
    ],
    keywords: ['o level chemistry past paper solver', 'periodic table o level chemistry questions', 'cambridge chemistry year wise questions'],
  },
  {
    slug: 'cambridge-o-level-biology-past-paper-solver',
    title: 'Cambridge O Level Biology Past Paper Solver',
    description:
      'Search Cambridge O Level Biology questions by year and topic, including diagram-heavy and table-based questions.',
    board: 'Cambridge',
    level: 'O Level',
    subject: 'Biology',
    samplePrompts: [
      '2024 O Level Biology paper 2 solve',
      'important biology diagrams O Level',
      'which biology topics repeat most in recent Cambridge O Level papers',
    ],
    keywords: ['o level biology past paper solver', 'biology diagrams o level', 'cambridge o level biology important questions'],
  },
  {
    slug: 'cambridge-o-level-economics-past-paper-solver',
    title: 'Cambridge O Level Economics Past Paper Solver',
    description:
      'ScholarHAAB QBank supports Cambridge O Level Economics paper search, theory revision, and repeated-topic guidance.',
    board: 'Cambridge',
    level: 'O Level',
    subject: 'Economics',
    samplePrompts: [
      '2022 O Level Economics solve',
      'market structure important questions O Level Economics',
      'year wise elasticity questions Cambridge Economics',
    ],
    keywords: ['o level economics past paper solver', 'market structure questions o level economics', 'elasticity past paper questions'],
  },
]
