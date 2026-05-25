const GEMINI_FLASH_INPUT_COST = 0.000001;
const GEMINI_FLASH_OUTPUT_COST = 0.000002;
const MAX_DAILY_COST_USD = 5.0;
const MAX_INPUT_TOKENS = 2000;
const MAX_OUTPUT_TOKENS = 600;

let dailyUsage = {
  cost: 0,
  resetAt: Date.now() + 24 * 60 * 60 * 1000,
};

export function canAffordRequest(): boolean {
  if (Date.now() > dailyUsage.resetAt) {
    dailyUsage = {
      cost: 0,
      resetAt: Date.now() + 24 * 60 * 60 * 1000,
    };
  }

  return dailyUsage.cost < MAX_DAILY_COST_USD;
}

export function recordUsage(inputTokens: number, outputTokens: number): void {
  const cost = inputTokens * GEMINI_FLASH_INPUT_COST + outputTokens * GEMINI_FLASH_OUTPUT_COST;
  dailyUsage.cost += cost;
}

export function truncatePrompt(prompt: string): string {
  const maxChars = MAX_INPUT_TOKENS * 4;
  if (prompt.length <= maxChars) return prompt;
  return `${prompt.slice(0, maxChars)}\n[Context truncated for cost control]`;
}

export const OUTPUT_CONFIG = {
  maxOutputTokens: MAX_OUTPUT_TOKENS,
  temperature: 0.05,
  topP: 0.8,
  topK: 20,
};

export const GENERATION_CONFIG = OUTPUT_CONFIG;
