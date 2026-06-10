import { redirect } from 'next/navigation'
import StarBackground from '@/components/StarBackground'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/profile')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, setup_completed')
    .eq('id', user.id)
    .maybeSingle()

  return (
    <main style={styles.page}>
      <StarBackground variant="chat" />
      <section style={styles.shell}>
        <header>
          <span style={styles.eyebrow}>Profile</span>
          <h1 style={styles.title}>Your ScholarHaab account</h1>
        </header>

        <div style={styles.grid}>
          <article style={styles.card}>
            <span style={styles.label}>Name</span>
            <strong style={styles.value}>{profile?.full_name || user.user_metadata?.full_name || 'Not set'}</strong>
          </article>
          <article style={styles.card}>
            <span style={styles.label}>Email</span>
            <strong style={styles.value}>{user.email || 'No email'}</strong>
          </article>
          <article style={styles.card}>
            <span style={styles.label}>Setup</span>
            <strong style={styles.value}>{profile?.setup_completed ? 'Complete' : 'Not complete'}</strong>
          </article>
        </div>
      </section>
    </main>
  )
}

const styles = {
  card: {
    background: 'rgba(255,255,255,.032)',
    border: '1px solid rgba(176,128,255,.14)',
    borderRadius: 8,
    display: 'grid',
    gap: 8,
    padding: 18,
  },
  eyebrow: {
    color: '#b983ff',
    fontSize: 12,
    fontWeight: 850,
    textTransform: 'uppercase' as const,
  },
  grid: {
    display: 'grid',
    gap: 14,
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  },
  label: {
    color: '#aaa7c8',
    fontSize: 13,
  },
  page: {
    background: '#02020c',
    color: '#ecebff',
    minHeight: 'calc(100vh - 74px)',
    position: 'relative' as const,
  },
  shell: {
    display: 'grid',
    gap: 22,
    margin: '0 auto',
    padding: '42px 16px 72px',
    position: 'relative' as const,
    width: 'min(980px,100%)',
    zIndex: 1,
  },
  title: {
    fontSize: 'clamp(34px,6vw,58px)',
    fontWeight: 520,
    lineHeight: 1,
    margin: '8px 0 0',
  },
  value: {
    color: '#fff',
    fontSize: 22,
    overflowWrap: 'anywhere' as const,
  },
}
