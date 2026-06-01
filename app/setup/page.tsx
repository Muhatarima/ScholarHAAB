import AuthGuard from '@/components/auth/AuthGuard'
import Logo from '@/components/Logo'
import StarBackground from '@/components/StarBackground'
import StudyProfileForm from '@/components/StudyProfileForm'

export default function SetupPage() {
  return (
    <AuthGuard>
      <main
        style={{
          alignItems: 'center',
          background: '#02030D',
          color: '#E8E8FF',
          display: 'grid',
          justifyItems: 'center',
          minHeight: '100vh',
          overflow: 'hidden',
          padding: 24,
          position: 'relative',
        }}
      >
        <StarBackground variant="chat" />
        <div style={{ position: 'absolute', top: 24, left: 24, zIndex: 2 }}>
          <Logo compact />
        </div>
        <div style={{ position: 'relative', zIndex: 2, width: '100%', display: 'grid', placeItems: 'center' }}>
          <StudyProfileForm />
        </div>
      </main>
    </AuthGuard>
  )
}
