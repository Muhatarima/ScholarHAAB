import { loadStudentMemory } from '@/lib/memory/studentMemory'

export async function getCelebrationPrefix(
  studentId: string,
  isCorrect?: boolean
): Promise<string | null> {
  try {
    const memory = await loadStudentMemory(studentId)
    const streak = memory.studyStreak || 0
    const total = memory.totalQuestionsAttempted || 0

    if (total === 1) {
      return "Welcome to ScholarHAAB! First question — let's go! 🚀"
    }
    if (total === 10) {
      return "10 questions done! You're getting into it now! 🔥"
    }
    if (total === 50) {
      return '50 questions! Serious student energy! 💪'
    }
    if (total === 100) {
      return '100 questions! Cambridge better watch out! 🏆'
    }

    if (streak === 3) {
      return '3 day streak! Making it a habit! 🔥'
    }
    if (streak === 7) {
      return "One week streak! You're unstoppable! 🌟"
    }
    if (streak >= 14) {
      return `${streak} days straight! Cambridge examiner energy! 🏆`
    }

    if (isCorrect === true) {
      const wins = [
        'Got it! See — you knew it! ✅',
        'Nailed it! 🎯',
        'Exactly right! Cambridge would be proud!',
        "Perfect! That's exam-ready! ✨",
        'Yes! That is the mark scheme answer! 🌟',
      ]
      return wins[Math.floor(Math.random() * wins.length)]
    }

    return null
  } catch {
    return null
  }
}

export function getEncouragementForWeakTopic(topic: string): string {
  const messages = [
    `${topic} used to be tricky for you — let's change that today!`,
    `Time to tackle ${topic} properly. You've got this!`,
    `${topic} is your next victory — let's go!`,
    `A lot of students struggle with ${topic}. Let's make you different.`,
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}
