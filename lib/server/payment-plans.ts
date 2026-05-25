export const PLANS = {
  pro: {
    amount: 399,
    currency: 'BDT',
    tier: 'pro',
    durationDays: 30,
  },
  premium: {
    amount: 699,
    currency: 'BDT',
    tier: 'premium',
    durationDays: 30,
  },
} as const

export type PlanTier = keyof typeof PLANS

export function isPlanTier(value: unknown): value is PlanTier {
  return value === 'pro' || value === 'premium'
}

export function getPlanByTier(tier: PlanTier) {
  return PLANS[tier]
}

export function inferPlanTierFromAmount(amount: number | string | null | undefined): PlanTier | null {
  const normalizedAmount =
    typeof amount === 'string'
      ? Number(amount)
      : typeof amount === 'number'
        ? amount
        : Number.NaN

  if (!Number.isFinite(normalizedAmount)) {
    return null
  }

  for (const [tier, plan] of Object.entries(PLANS) as [PlanTier, (typeof PLANS)[PlanTier]][]) {
    if (plan.amount === normalizedAmount) {
      return tier
    }
  }

  return null
}
