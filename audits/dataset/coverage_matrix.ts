// Matrix builder — manifest JSONL optional at runtime via lib/dataset/common

export type CoverageGrid = {
  board: string
  level: string
  subject: string
  year: number
  paper_type: string
  expected: boolean
  found: boolean
  parsed: boolean
  inserted: boolean
}

export const SUPPORTED_BOARDS = ['Cambridge', 'Edexcel']
export const SUPPORTED_LEVELS = ['O Level', 'A Level']
export const SUPPORTED_YEARS = Array.from({ length: 10 }, (_, i) => 2016 + i) // 2016 to 2025

export const SUPPORTED_SUBJECTS = [
  'Physics',
  'Chemistry',
  'Biology',
  'Mathematics',
  'Further Mathematics',
  'Accounting',
  'Economics',
  'Business',
  'ICT',
  'Computer Science',
  'English'
]

export const REQUIRED_CONTENT_TYPES = ['qp', 'ms', 'er', 'syllabus', 'theory', 'formula']

export function buildExpectedMatrix(): CoverageGrid[] {
  const grid: CoverageGrid[] = []

  for (const board of SUPPORTED_BOARDS) {
    for (const level of SUPPORTED_LEVELS) {
      for (const subject of SUPPORTED_SUBJECTS) {
        for (const year of SUPPORTED_YEARS) {
          for (const type of REQUIRED_CONTENT_TYPES) {
            // Examiner Reports (er) are Cambridge-only
            if (type === 'er' && board !== 'Cambridge') continue

            grid.push({
              board,
              level,
              subject,
              year,
              paper_type: type,
              expected: true,
              found: false,
              parsed: false,
              inserted: false
            })
          }
        }
      }
    }
  }

  return grid
}
