import { getSupabaseAdmin } from '@/lib/server/supabase-admin'
import { getPlanByTier, type PlanTier } from '@/lib/server/payment-plans'

export async function activatePaidSubscription({
  userId,
  tier,
  provider,
  providerSubscriptionId,
}: {
  userId: string
  tier: PlanTier
  provider: 'sslcommerz' | 'bkash'
  providerSubscriptionId: string
}) {
  const supabaseAdmin = getSupabaseAdmin()
  const plan = getPlanByTier(tier)

  await supabaseAdmin
    .from('subscriptions')
    .update({ status: 'canceled', updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .in('status', ['active', 'trialing', 'past_due'])

  const startDate = new Date()
  const endDate = new Date()
  endDate.setDate(endDate.getDate() + plan.durationDays)

  return supabaseAdmin.from('subscriptions').insert({
    user_id: userId,
    tier,
    status: 'active',
    provider,
    provider_subscription_id: providerSubscriptionId,
    current_period_start: startDate.toISOString(),
    current_period_end: endDate.toISOString(),
  })
}
