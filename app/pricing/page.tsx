'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Blackhole from '@/components/Blackhole'
import Stars from '@/components/Stars'
import { getTierLabel } from '@/lib/usage'

const BKASH_ENABLED = process.env.NEXT_PUBLIC_ENABLE_BKASH !== 'false'
const SSLCOMMERZ_ENABLED = process.env.NEXT_PUBLIC_ENABLE_SSLCOMMERZ !== 'false'
const PAYMENT_UI_HIDDEN = process.env.HIDE_PAYMENT === 'true' || process.env.NEXT_PUBLIC_HIDE_PAYMENT === 'true'

const PLANS = [
  {
    id: 'pro',
    name: 'Pro',
    price: 'BDT 399 / month',
    blurb: 'Paid-only access for focused daily study with cost-controlled credits and grounded answers.',
    points: ['20 daily credits', 'Best for regular past-paper prep', 'Optimized for lower token burn per answer'],
  },
  {
    id: 'premium',
    name: 'Premium Plus',
    price: 'BDT 699 / month',
    blurb: 'Higher headroom for heavy prep weeks, repeated uploads, and more tutor-style sessions.',
    points: ['50 daily credits', 'Best for intense exam-season prep', 'More room for file-heavy and tutor-mode questions'],
  },
]

type MeState = {
  tier: string
  authenticated: boolean
}

type PaymentGateway = 'sslcommerz' | 'bkash'

function PricingPageContent() {
  const searchParams = useSearchParams()
  const [me, setMe] = useState<MeState | null>(null)
  const [pendingCheckout, setPendingCheckout] = useState<{
    plan: string
    gateway: PaymentGateway
  } | null>(null)
  const paymentState = useMemo(() => searchParams.get('payment'), [searchParams])
  const paymentGateway = useMemo(() => searchParams.get('gateway'), [searchParams])

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/me', { cache: 'no-store' })
        const data = await res.json()
        setMe({
          tier: typeof data.tier === 'string' ? data.tier : 'expired',
          authenticated: Boolean(data.authenticated),
        })
      } catch {
        setMe({ tier: 'expired', authenticated: false })
      }
    })()
  }, [])

  const startCheckout = async (plan: string, gateway: PaymentGateway) => {
    setPendingCheckout({ plan, gateway })
    try {
      const res = await fetch('/api/payment/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: plan, gateway }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Could not start payment.')
      }
      window.location.href = data.url
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Could not start payment right now.')
    } finally {
      setPendingCheckout(null)
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
        background: '#00000d',
        color: '#E8E8FF',
        padding: '120px 24px 48px',
      }}
    >
      <Stars />
      <Blackhole />
      <div style={{ position: 'relative', zIndex: 10, maxWidth: '1040px', margin: '0 auto' }}>
        <div style={{ marginBottom: '24px' }}>
          <p style={{ fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase', color: '#9A6CFF' }}>
            Plans and credits
          </p>
          <h1 style={{ fontSize: 'clamp(32px, 5vw, 54px)', margin: '10px 0 12px' }}>Upgrade without guesswork</h1>
          <p style={{ maxWidth: '700px', color: '#8F8FB5', lineHeight: 1.8 }}>
            Choose the plan that matches your exam workload, keep answers grounded, and keep QBank responsive during heavy study weeks.
          </p>
          {me?.authenticated ? (
            <p style={{ maxWidth: '700px', color: '#B9B9DE', lineHeight: 1.8, marginTop: '12px' }}>
              Current access: {getTierLabel(me.tier)}
            </p>
          ) : null}
        </div>

        {paymentState ? (
          <div
            style={{
              marginBottom: '18px',
              borderRadius: '18px',
              padding: '14px 16px',
              background: paymentState === 'success' ? 'rgba(34,197,94,0.12)' : 'rgba(251,113,133,0.14)',
              border:
                paymentState === 'success'
                  ? '1px solid rgba(34,197,94,0.25)'
                  : '1px solid rgba(251,113,133,0.25)',
              color: paymentState === 'success' ? '#bbf7d0' : '#fecdd3',
            }}
          >
            {paymentState === 'success'
              ? `Payment received${paymentGateway === 'bkash' ? ' via bKash' : ''}. Your plan should refresh shortly.`
              : paymentState === 'failed'
                ? `Payment failed${paymentGateway === 'bkash' ? ' on bKash' : ''}. No worries, you can try again.`
                : paymentState === 'cancelled'
                  ? `Payment was cancelled${paymentGateway === 'bkash' ? ' on bKash' : ''} before completion.`
                  : 'Something interrupted the payment flow. Please try again.'}
          </div>
        ) : null}

        <div
          style={{
            display: 'grid',
            gap: '18px',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          }}
        >
          {PLANS.map((plan) => {
            const active = me?.tier === plan.id
            return (
              <article
                key={plan.id}
                style={{
                  borderRadius: '24px',
                  border: active
                    ? '1px solid rgba(107,228,255,0.3)'
                    : '1px solid rgba(170,85,255,0.16)',
                  background: active ? 'rgba(107,228,255,0.06)' : 'rgba(255,255,255,0.04)',
                  padding: '24px',
                  display: 'grid',
                  gap: '14px',
                }}
              >
                <div>
                  <p style={{ margin: 0, fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase', color: '#9A6CFF' }}>
                    {plan.name}
                  </p>
                  <h2 style={{ margin: '10px 0 6px', fontSize: '30px' }}>{plan.price}</h2>
                  <p style={{ margin: 0, color: '#9a9abe', lineHeight: 1.7 }}>{plan.blurb}</p>
                </div>

                <div style={{ display: 'grid', gap: '8px', color: '#e3defa', fontSize: '14px' }}>
                  {plan.points.map((point) => (
                    <div key={point}>- {point}</div>
                  ))}
                </div>

                {BKASH_ENABLED ? (
                  <button
                    onClick={() => void startCheckout(plan.id, 'bkash')}
                    disabled={
                      !me?.authenticated ||
                      active ||
                      (pendingCheckout?.plan === plan.id && pendingCheckout?.gateway === 'bkash')
                    }
                    style={{
                      borderRadius: '16px',
                      border: active ? 'none' : '1px solid rgba(255,105,180,0.24)',
                      background: active ? 'rgba(255,255,255,0.08)' : 'linear-gradient(130deg,#f3167b,#ff6f3c)',
                      color: '#fff',
                      padding: '14px 16px',
                      cursor: !me?.authenticated || active ? 'default' : 'pointer',
                      fontSize: '14px',
                      fontWeight: 600,
                    }}
                  >
                    {!me?.authenticated
                      ? 'Sign in to upgrade'
                      : active
                        ? 'Current plan'
                        : pendingCheckout?.plan === plan.id && pendingCheckout?.gateway === 'bkash'
                          ? 'Redirecting to bKash...'
                          : `Pay with bKash`}
                  </button>
                ) : null}

                {SSLCOMMERZ_ENABLED ? (
                  <button
                    onClick={() => void startCheckout(plan.id, 'sslcommerz')}
                    disabled={
                      !me?.authenticated ||
                      active ||
                      (pendingCheckout?.plan === plan.id && pendingCheckout?.gateway === 'sslcommerz')
                    }
                    style={{
                      borderRadius: '16px',
                      border: 'none',
                      background: active ? 'rgba(255,255,255,0.08)' : 'linear-gradient(130deg,#7733cc,#aa55ff)',
                      color: '#fff',
                      padding: '14px 16px',
                      cursor: !me?.authenticated || active ? 'default' : 'pointer',
                      fontSize: '14px',
                      fontWeight: 600,
                    }}
                  >
                    {!me?.authenticated
                      ? 'Sign in to upgrade'
                      : active
                        ? 'Current plan'
                        : pendingCheckout?.plan === plan.id && pendingCheckout?.gateway === 'sslcommerz'
                          ? 'Redirecting to SSLCommerz...'
                          : 'Card / mobile banking'}
                  </button>
                ) : null}
              </article>
            )
          })}
        </div>
      </div>
    </main>
  )
}

export default function PricingPage() {
  if (PAYMENT_UI_HIDDEN) {
    return null
  }

  return (
    <Suspense fallback={null}>
      <PricingPageContent />
    </Suspense>
  )
}
