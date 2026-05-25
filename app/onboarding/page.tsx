import type { Metadata } from 'next'
import Stars from '@/components/Stars'
import Blackhole from '@/components/Blackhole'
import OnboardingFlow from '@/components/OnboardingFlow'
import { buildMetadata } from '@/lib/seo'
import { createEmptyStudentProfile } from '@/lib/user-profile'

export const metadata: Metadata = buildMetadata({
  title: 'Set Up Your ScholarHAAB Profile',
  description: 'Choose your board, level, subjects, and study goals so ScholarHAAB answers correctly from message one.',
  path: '/onboarding',
})

export default function OnboardingPage() {
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
      <div style={{ position: 'relative', zIndex: 10, maxWidth: '860px', margin: '0 auto' }}>
        <div
          style={{
            borderRadius: '28px',
            border: '1px solid rgba(170,85,255,0.16)',
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(16px)',
            padding: '24px',
          }}
        >
          <OnboardingFlow initialProfile={createEmptyStudentProfile()} />
        </div>
      </div>
    </main>
  )
}
