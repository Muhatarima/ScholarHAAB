import { SUPPORTED_SUBJECTS } from '../../audits/dataset/coverage_matrix'

export type GeneratedQuery = {
  id: string
  queryText: string
  type: 'exact' | 'topic' | 'chapter' | 'mark_scheme' | 'formula' | 'theory' | 'banglish' | 'typo' | 'mixed'
  expectedSubject: string
  expectedTopic: string
  expectedBoard: string
  expectedLevel: string
  expectedYear: number | null
}

const TEMPLATES: Record<GeneratedQuery['type'], string[]> = {
  exact: [
    'May June {year} {subject} Paper {paper} Question {question}',
    'Oct Nov {year} {subject} Paper {paper} Q{question}',
    '{subject} {year} paper {paper} q{question}'
  ],
  topic: [
    '{topic} definition and key points',
    'explain the concept of {topic}',
    'questions on {topic} for exam'
  ],
  chapter: [
    '{topic} chapter exercises',
    '{subject} chapter on {topic}',
    'syllabus details for {topic}'
  ],
  mark_scheme: [
    'mark scheme for {topic} questions',
    'how to gain marks in {topic}',
    'examiner expectations for {topic}'
  ],
  formula: [
    'equations for {topic}',
    'formula of {topic} in {subject}',
    'derive the formula for {topic}'
  ],
  theory: [
    'theory of {topic}',
    'explain the theory behind {topic}',
    'detailed notes on {topic}'
  ],
  banglish: [
    'bhai {topic} bujhte parchi na',
    'amake {topic} bujhiye dao',
    '{topic} er formula ki hobe'
  ],
  typo: [
    '{typoTopic} definition {subject}',
    'explain {typoTopic} in detail',
    '{typoTopic} formula'
  ],
  mixed: [
    'A Level {subject} {topic} formula and question',
    'O Level {subject} {topic} past paper question',
    '{board} {level} {subject} {topic} theory'
  ]
}

const TOPIC_TYPOS: Record<string, string> = {
  'Wave Motion': 'waev motoin',
  'Organic Chemistry': 'organik chemestry',
  'Chemical Bonding': 'chemikall bondng',
  'Integration': 'integreshon',
  'Differentiation': 'differentiasion',
  'Forces and Motion': 'forces n motin',
  'Photosynthesis': 'photosinthsis',
  'Work, Energy and Power': 'work energgy',
  'Rates of Reaction': 'rates of rection',
  'Electromagnetic Induction': 'electromagnatic'
}

export function generateTestQueries(count = 5000): GeneratedQuery[] {
  const queries: GeneratedQuery[] = []
  
  const subjects = ['Physics', 'Chemistry', 'Biology', 'Mathematics']
  const topics: Record<string, string[]> = {
    'Physics': ['Wave Motion', 'Forces and Motion', 'Work, Energy and Power', 'Electromagnetic Induction'],
    'Chemistry': ['Chemical Bonding', 'Organic Chemistry', 'Rates of Reaction'],
    'Biology': ['Photosynthesis'],
    'Mathematics': ['Integration', 'Differentiation']
  }
  const boards = ['Cambridge', 'Edexcel']
  const levels = ['O Level', 'A Level']
  const years = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]
  
  const queryTypes: GeneratedQuery['type'][] = ['exact', 'topic', 'chapter', 'mark_scheme', 'formula', 'theory', 'banglish', 'typo', 'mixed']

  for (let i = 0; i < count; i++) {
    const type = queryTypes[i % queryTypes.length]
    const subject = subjects[i % subjects.length]
    const subjectTopics = topics[subject] || ['General']
    const topic = subjectTopics[i % subjectTopics.length]
    const board = boards[i % boards.length]
    const level = levels[i % levels.length]
    const year = years[i % years.length]
    const templates = TEMPLATES[type]
    const template = templates[i % templates.length]

    const queryText = template
      .replace('{subject}', subject)
      .replace('{topic}', topic)
      .replace('{board}', board)
      .replace('{level}', level)
      .replace('{year}', String(year))
      .replace('{paper}', String((i % 4) + 1))
      .replace('{question}', String((i % 10) + 1))
      .replace('{typoTopic}', TOPIC_TYPOS[topic] || topic)

    queries.push({
      id: `query_${String(i + 1).padStart(4, '0')}`,
      queryText,
      type,
      expectedSubject: subject,
      expectedTopic: topic,
      expectedBoard: board,
      expectedLevel: level,
      expectedYear: type === 'exact' || type === 'mixed' ? year : null
    })
  }

  return queries
}
