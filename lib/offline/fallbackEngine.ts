import cachedQuestions from './cachedQuestions.json';

export interface CachedQuestion {
  id: string;
  subject: string;
  level: string;
  topic: string;
  year: number;
  question_text: string;
  mark_scheme: string;
  mark_scheme_points: string[];
  step_by_step: string;
  source: string;
  confidence: string;
  keywords: string[];
}

export interface FallbackAnswer {
  found: boolean;
  question?: CachedQuestion;
  confidence: string;
  isOffline: boolean;
  message: string;
}

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9+\-/^ ]/g, ' ');
}

export function getOfflineAnswer(query: string, subject?: string): FallbackAnswer {
  const queryLower = normalise(query);
  const queryWords = queryLower.split(/\s+/).filter((word) => word.length > 3);

  let bestMatch: CachedQuestion | null = null;
  let bestScore = 0;

  for (const question of cachedQuestions as CachedQuestion[]) {
    if (subject && question.subject.toLowerCase() !== subject.toLowerCase()) {
      continue;
    }

    let score = 0;
    const topicLower = normalise(question.topic);
    const questionWords = normalise(question.question_text).split(/\s+/);

    for (const keyword of question.keywords) {
      if (queryLower.includes(normalise(keyword))) {
        score += 3;
      }
    }

    for (const word of queryWords) {
      if (questionWords.includes(word)) {
        score += 1;
      }
    }

    if (queryLower.includes(topicLower)) {
      score += 5;
    }

    if (normalise(question.subject) && queryLower.includes(normalise(question.subject))) {
      score += 2;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = question;
    }
  }

  if (bestMatch && bestScore >= 5) {
    return {
      found: true,
      question: bestMatch,
      confidence: 'PARTIAL',
      isOffline: true,
      message: 'Showing cached answer - reconnect for live verified results.',
    };
  }

  const subjectFallbacks: Record<string, string> = {
    Physics:
      'For Physics questions, remember: state the formula first, substitute values, show every step, and include units in the final answer. Cambridge awards marks for working shown.',
    Mathematics:
      'For Mathematics questions, write the method clearly, show all algebraic steps, and check your answer by substitution where possible.',
    Chemistry:
      'For Chemistry questions, identify the question type first, use precise terminology, and link bonding or structure to property explanations.',
    Biology:
      'For Biology questions, use precise scientific language, reference specific structures, and link structure to function.',
  };

  const genericAdvice =
    subjectFallbacks[subject || ''] ||
    'Currently offline. Please reconnect for verified Cambridge and Edexcel past paper answers with mark schemes.';

  return {
    found: false,
    confidence: 'OFFLINE',
    isOffline: true,
    message: genericAdvice,
  };
}

export function isNetworkAvailable(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}
