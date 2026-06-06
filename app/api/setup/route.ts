export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { saveSetupProfile, type SetupInput } from '@/lib/profile/save-setup'

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const setup = await saveSetupProfile(
      supabase,
      user,
      (await req.json()) as SetupInput
    )

    return NextResponse.json({
      redirectTo: '/solver',
      setup,
      success: true,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Could not save setup.',
        success: false,
      },
      { status: 400 }
    )
  }
}
