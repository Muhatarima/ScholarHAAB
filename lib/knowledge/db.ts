import { getSupabaseAdmin } from '@/lib/server/supabase-admin'
import type { KnowledgeFilter } from '@/lib/knowledge/types'

export function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean)
  return String(value ?? '').split(/[;,]/).map((item) => item.trim()).filter(Boolean)
}

export function text(value: unknown, fallback = '') {
  return String(value ?? fallback).trim()
}

export async function safeSelect(table: string, columns: string, filter: KnowledgeFilter, limit = 6) {
  try {
    const supabase = getSupabaseAdmin()
    let query = supabase.from(table).select(columns).limit(limit)
    if (filter.board) query = query.ilike('board', `%${filter.board}%`)
    if (filter.level) query = query.ilike('level', `%${filter.level}%`)
    if (filter.subject) query = query.ilike('subject', `%${filter.subject}%`)
    if (filter.topic) query = query.or(`topic.ilike.%${filter.topic}%,chapter.ilike.%${filter.topic}%,subtopic.ilike.%${filter.topic}%`)
    const { data, error } = await query
    if (error || !data) return []
    return data as unknown as Record<string, unknown>[]
  } catch {
    return []
  }
}
