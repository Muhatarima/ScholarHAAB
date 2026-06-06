import { redirect } from 'next/navigation'
import ProductChatShell from '@/components/ProductChatShell'
import { getSetupCompleted } from '@/lib/auth/setup-status'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function SolverPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/solver')
  }

  if (!(await getSetupCompleted(supabase, user.id))) {
    redirect('/setup')
  }

  return <ProductChatShell product="qbank" />
}
