'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { DocSection, DocSettings } from '@/types/docs'
import { revalidatePath } from 'next/cache'

async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

export async function getDocSettings(): Promise<DocSettings | null> {
  const supabase = await getSupabase()
  const { data, error } = await supabase
    .from('docs_settings')
    .select('is_public, start_time, end_time')
    .single()

  if (error) {
    console.error('Error fetching doc settings:', error)
    return null
  }
  return data
}

export async function getDocSections(): Promise<DocSection[]> {
  const supabase = await getSupabase()
  const { data, error } = await supabase
    .from('docs_sections')
    .select('*')
    .eq('is_active', true)
    .order('section_order', { ascending: true })

  if (error) {
    console.error('Error fetching doc sections:', error)
    return []
  }
  return data
}

export async function updateDocSettings(settings: Partial<DocSettings>) {
  const supabase = await getSupabase()
  const { error } = await supabase
    .from('docs_settings')
    .update(settings)
    .eq('id', (await supabase.from('docs_settings').select('id').single()).data?.id)

  if (error) throw error
  revalidatePath('/docs')
  revalidatePath('/admin/docs')
}

export async function updateDocSection(id: string, section: Partial<DocSection>) {
  const supabase = await getSupabase()
  const { error } = await supabase
    .from('docs_sections')
    .update(section)
    .eq('id', id)

  if (error) throw error
  revalidatePath('/docs')
}

export async function createDocSection(section: Omit<DocSection, 'id' | 'updated_at'>) {
  const supabase = await getSupabase()
  const { error } = await supabase
    .from('docs_sections')
    .insert(section)

  if (error) throw error
  revalidatePath('/docs')
  revalidatePath('/admin/docs')
}

export async function deleteDocSection(id: string) {
  const supabase = await getSupabase()
  const { error } = await supabase
    .from('docs_sections')
    .delete()
    .eq('id', id)

  if (error) throw error
  revalidatePath('/docs')
  revalidatePath('/admin/docs')
}

export async function getLiveSystemStats() {
  const supabase = await getSupabase()
  
  // Total user count from profiles
  const { count: userCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })

  // Total call count from usage logs
  const { data: usageData } = await supabase
    .from('llm_usage')
    .select('call_count')

  const totalQueries = usageData?.reduce((acc, curr) => acc + (curr.call_count || 0), 0) || 0

  return {
    activeUsers: userCount || 0,
    totalQueries: totalQueries,
    uptime: '99.9%',
    accuracy: '94.8%'
  }
}
