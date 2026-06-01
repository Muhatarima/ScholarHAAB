import Link from 'next/link'
import AuthGuard from '@/components/auth/AuthGuard'
import Logo from '@/components/Logo'
import StarBackground from '@/components/StarBackground'
import StudyProfileForm from '@/components/StudyProfileForm'

export default function SettingsProfilePage() {
  return (
    <AuthGuard>
      <main
        style={{
          background: '#02030D',
          color: '#E8E8FF',
          minHeight: '100vh',
          overflow: 'hidden',
          padding: 24,
          position: 'relative',
        }}
      >
        <StarBackground variant="chat" />
        <nav
          style={{
            alignItems: 'center',
            display: 'flex',
            justifyContent: 'space-between',
            margin: '0 auto 28px',
            maxWidth: 980,
            position: 'relative',
            zIndex: 2,
          }}
        >
          <Logo compact />
          <Link href="/solver" style={{ color: '#C084FC', fontSize: 13, fontWeight: 800, textDecoration: 'none' }}>
            Back to Solver
          </Link>
        </nav>
        <section style={{ display: 'grid', justifyItems: 'center', position: 'relative', zIndex: 2 }}>
          <StudyProfileForm
            title="Study profile"
            subtitle="Edit stable fields only. Weak topics, skipped topics, and exam dates are tracked automatically."
            redirectTo="/dashboard"
          />
        </section>
      </main>
    </AuthGuard>
  )
}
