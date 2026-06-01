export const LEVELS = ['O Level', 'A Level'] as const
export const BOARDS = ['Cambridge', 'Edexcel'] as const

export const STAGES = {
  'O Level': ['Class 9', 'Class 10', 'Candidate'],
  'A Level': ['AS', 'A2', 'Full A Level Candidate'],
} as const

export const SUBJECTS = {
  'O Level': [
    'Physics',
    'Chemistry',
    'Biology',
    'Mathematics',
    'English Language',
    'English Literature',
    'Economics',
    'Business Studies',
    'Accounting',
    'Computer Science',
    'ICT',
    'Bangla',
  ],
  'A Level': [
    'Physics',
    'Chemistry',
    'Biology',
    'Mathematics',
    'Further Mathematics',
    'Economics',
    'Business',
    'Accounting',
    'Computer Science',
    'Psychology',
  ],
} as const

export const LANGUAGES = ['English', 'Banglish', 'Bengali support'] as const
export const EXPLANATION_STYLES = [
  'Short exam-focused',
  'Step-by-step teacher style',
  'Simple beginner explanation',
  'Banglish friendly',
  'Mark scheme focused',
] as const

export type SetupLevel = (typeof LEVELS)[number]
export type SetupBoard = (typeof BOARDS)[number]
