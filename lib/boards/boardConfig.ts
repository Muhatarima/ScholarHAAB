export type Board = 'cambridge' | 'edexcel' | 'both'
export type Level = 'O Level' | 'A Level' | 'IGCSE' | 'IAL'

export interface BoardInfo {
  name: string
  fullName: string
  levels: Level[]
  gradingSystem: string
  markingStyle: string
  paperPrefix: string
}

export const BOARD_CONFIG: Record<Board, BoardInfo> = {
  cambridge: {
    name: 'Cambridge',
    fullName: 'Cambridge Assessment International Education (CAIE)',
    levels: ['O Level', 'A Level'],
    gradingSystem: 'A*-U',
    markingStyle: 'Mark points with allow/reject language',
    paperPrefix: 'Cambridge',
  },
  edexcel: {
    name: 'Edexcel',
    fullName: 'Pearson Edexcel International',
    levels: ['IGCSE', 'IAL'],
    gradingSystem: 'A*-U',
    markingStyle: 'B marks (accuracy), M marks (method), A marks (answer)',
    paperPrefix: 'Edexcel',
  },
  both: {
    name: 'Both Boards',
    fullName: 'Cambridge + Edexcel',
    levels: ['O Level', 'A Level', 'IGCSE', 'IAL'],
    gradingSystem: 'A*-U',
    markingStyle: 'Mixed marking conventions',
    paperPrefix: 'Past Paper',
  },
}

export const EDEXCEL_SUBJECTS = {
  oLevel: {
    Physics: '4PH1',
    Chemistry: '4CH1',
    Mathematics_A: '4MA1',
    Mathematics_B: '4MB1',
    Additional_Mathematics: '4AM1',
    Biology: '4BI1',
    English_Language: '4EA1',
    English_Literature: '4ET1',
    Commerce: '4CM1',
    Economics: '4EC1',
    Accounting: '4AC1',
    Business_Studies: '4BS1',
    Computer_Science: '4IT1',
    Geography: '4GE1',
    History: '4HI1',
    Islamiyat: '4IS1',
    Human_Biology: '4HB1',
    Science_Double_Award: '4SC1',
    Statistics: '4ST1',
  },
  aLevel: {
    Physics: '8PH0',
    Chemistry: '8CH0',
    Mathematics: '8MA0',
    Further_Mathematics: '8FM0',
    Biology: '8BI0',
    English_Language: '8EN0',
    English_Literature: '8ET0',
    Economics: '8EC0',
    Computer_Science: '8CP0',
    Accounting: '8AC0',
    Business: '8BS0',
    Geography: '8GE0',
    History: '8HI0',
    Psychology: '8PS0',
    Sociology: '8SO0',
    Statistics: '8ST0',
    Further_Pure_Mathematics: '8FP0',
  },
}

export const CAMBRIDGE_SUBJECTS = {
  oLevel: {
    Physics: '5054',
    Chemistry: '5070',
    Mathematics: '4024',
    Additional_Mathematics: '4037',
    Biology: '5090',
    English_Language: '1123',
    Economics: '2281',
    Computer_Science: '2210',
    Islamiyat: '2058',
    Accounting: '7707',
    Commerce: '7100',
    Business_Studies: '7115',
  },
  aLevel: {
    Physics: '9702',
    Chemistry: '9701',
    Mathematics: '9709',
    Further_Mathematics: '9231',
    Biology: '9700',
    English_Language: '9093',
    Economics: '9708',
    Computer_Science: '9618',
    Accounting: '9706',
    Psychology: '9990',
  },
}

export function detectBoard(text: string): Board {
  const lower = text.toLowerCase()
  if (
    lower.includes('edexcel') ||
    lower.includes('pearson') ||
    lower.includes('ial') ||
    lower.includes('igcse')
  ) {
    return 'edexcel'
  }
  if (
    lower.includes('cambridge') ||
    lower.includes('caie') ||
    lower.includes('cie')
  ) {
    return 'cambridge'
  }
  return 'both'
}

export function getBoardContext(board: Board): string {
  const info = BOARD_CONFIG[board]
  return `
Board: ${info.fullName}
Marking: ${info.markingStyle}
Grade scale: ${info.gradingSystem}
`.trim()
}
