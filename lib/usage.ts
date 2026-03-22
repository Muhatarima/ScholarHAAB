import type { Product, PromptMode } from '@/lib/products'

export type Tier = 'trial' | 'pro' | 'premium'

export type UsageAction =
  | 'abroad_chat'
  | 'scholarship_match'
  | 'abroad_document_review'
  | 'qbank_direct'
  | 'qbank_tutor'
  | 'qbank_topic_analysis'

export const TIER_LIMITS: Record<Tier, { dailyCredits: number }> = {
  trial: { dailyCredits: 12 },
  pro: { dailyCredits: 30 },
  premium: { dailyCredits: 50 },
}

export const ACTION_CREDITS: Record<UsageAction, number> = {
  abroad_chat: 1,
  scholarship_match: 2,
  abroad_document_review: 3,
  qbank_direct: 1,
  qbank_tutor: 2,
  qbank_topic_analysis: 2,
}

const ABROAD_DOCUMENT_PATTERN =
  /\b(sop|lor|cv|resume|transcript|essay|personal statement|recommendation letter|document review)\b/i

const SCHOLARSHIP_MATCH_PATTERN =
  /\b(match|eligible|eligibility|fit|chance|profile|which scholarship|scholarships for me|funding options)\b/i

const QBANK_TOPIC_PATTERN =
  /\b(important topic|important topics|repeat question|repeat questions|came in|which question|which questions|topic|chapter|paper 20\d{2}|mark scheme|examiner report)\b/i

export function isTier(value: unknown): value is Tier {
  return value === 'trial' || value === 'pro' || value === 'premium'
}

export function getDailyCreditLimit(tier: Tier): number {
  return TIER_LIMITS[tier].dailyCredits
}

export function resolveUsageAction(product: Product, mode: PromptMode, message: string): UsageAction {
  if (product === 'abroad') {
    if (ABROAD_DOCUMENT_PATTERN.test(message)) {
      return 'abroad_document_review'
    }

    if (SCHOLARSHIP_MATCH_PATTERN.test(message)) {
      return 'scholarship_match'
    }

    return 'abroad_chat'
  }

  if (QBANK_TOPIC_PATTERN.test(message)) {
    return 'qbank_topic_analysis'
  }

  return mode === 'tutor' ? 'qbank_tutor' : 'qbank_direct'
}

export function getActionCreditCost(action: UsageAction): number {
  return ACTION_CREDITS[action]
}

export function getUsageSummary(tier: Tier, usedCredits: number, action: UsageAction) {
  const dailyLimitCredits = getDailyCreditLimit(tier)
  const actionCost = getActionCreditCost(action)
  const remainingCredits = Math.max(0, dailyLimitCredits - usedCredits)
  const remainingAfterAction = Math.max(0, dailyLimitCredits - usedCredits - actionCost)

  return {
    tier,
    dailyLimitCredits,
    usedCredits,
    remainingCredits,
    remainingAfterAction,
    action,
    actionCost,
  }
}
