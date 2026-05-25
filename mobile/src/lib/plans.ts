export function getTierLabel(tier: string | null | undefined) {
  if (tier === 'pro') {
    return 'Pro'
  }

  if (tier === 'premium') {
    return 'Premium Plus'
  }

  return 'No active plan'
}

export const MOBILE_PLAN_PRICES = {
  pro: 'BDT 399 / month',
  premium: 'BDT 699 / month',
} as const
