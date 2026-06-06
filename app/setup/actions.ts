'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { saveSetupProfile, type SetupInput } from '@/lib/profile/save-setup'

function safeRedirectPath(value: string) {
  if (!value.startsWith('/') || value.startsWith('//')) {
    return '/solver'
  }
  return value
}

export async function completeSetup(input: SetupInput, redirectTo = '/solver') {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login?next=/setup')
  }

  await saveSetupProfile(supabase, user, input)

  revalidatePath('/', 'layout')
  redirect(safeRedirectPath(redirectTo))
}
