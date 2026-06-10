import { redirect } from 'next/navigation'
import StarBackground from '@/components/StarBackground'
import StudyProfileForm from '@/components/StudyProfileForm'
import { getSetupCompleted } from '@/lib/auth/setup-status'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function SetupPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/setup')
  }

  if (await getSetupCompleted(supabase, user.id)) {
    redirect('/solver')
  }

  return (
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
      <div style={{ position: 'relative', zIndex: 2, width: '100%', display: 'grid', placeItems: 'center' }}>
        <StudyProfileForm />
      </div>
    </main>
  )
}
