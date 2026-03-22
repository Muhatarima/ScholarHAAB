import { randomUUID } from 'node:crypto'
import type { Product, PromptMode } from '@/lib/products'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'

export type StoredChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  sequenceNo: number
  createdAt: string
  sources?: Array<{
    title: string
    url?: string | null
    tier?: string | null
    lastChecked?: string | null
  }>
}

export type StoredChatSessionSummary = {
  id: string
  product: Product
  mode: PromptMode
  title: string
  lastMessagePreview: string
  lastMessageAt: string
  updatedAt: string
}

type ChatSessionRow = {
  id: string
  product: Product
  mode: PromptMode
  title: string
  last_message_preview: string | null
  last_message_at: string
  updated_at: string
}

type ChatMessageRow = {
  id: string
  role: 'user' | 'assistant'
  content: string
  sequence_no: number
  created_at: string
  sources?: Array<{
    title: string
    url?: string | null
    tier?: string | null
    lastChecked?: string | null
  }> | null
}

type PersistChatTurnParams = {
  viewerKey: string
  product: Product
  mode: PromptMode
  sessionId?: string
  userMessage: string
  assistantMessage: string
  assistantSources?: Array<{
    title: string
    url?: string | null
    tier?: string | null
    lastChecked?: string | null
  }>
}

function isMissingChatTableError(error: unknown): boolean {
  const code = (error as { code?: string })?.code
  const message = String((error as { message?: string })?.message ?? '')
  return code === '42P01' || code === 'PGRST205' || /chat_sessions|chat_messages/i.test(message)
}

function isMissingSourcesColumnError(error: unknown) {
  const code = (error as { code?: string })?.code
  const message = String((error as { message?: string })?.message ?? '')
  return code === '42703' || code === 'PGRST204' || /column .*sources|sources does not exist/i.test(message)
}

function buildSessionTitle(message: string): string {
  const compact = message.replace(/\s+/g, ' ').trim()
  if (!compact) {
    return 'New chat'
  }

  return compact.length > 72 ? `${compact.slice(0, 69).trim()}...` : compact
}

function buildPreview(message: string): string {
  const compact = message.replace(/\s+/g, ' ').trim()
  return compact.length > 120 ? `${compact.slice(0, 117).trim()}...` : compact
}

function mapSessionRow(row: ChatSessionRow): StoredChatSessionSummary {
  return {
    id: row.id,
    product: row.product,
    mode: row.mode,
    title: row.title,
    lastMessagePreview: row.last_message_preview ?? '',
    lastMessageAt: row.last_message_at,
    updatedAt: row.updated_at,
  }
}

function mapMessageRow(row: ChatMessageRow): StoredChatMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    sequenceNo: row.sequence_no,
    createdAt: row.created_at,
    sources: Array.isArray(row.sources) ? row.sources : undefined,
  }
}

async function getSessionRow(viewerKey: string, sessionId: string) {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('chat_sessions')
    .select('id, product, mode, title, last_message_preview, last_message_at, updated_at')
    .eq('viewer_key', viewerKey)
    .eq('id', sessionId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data as ChatSessionRow | null
}

async function getLastSequenceNumber(sessionId: string) {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('chat_messages')
    .select('sequence_no')
    .eq('session_id', sessionId)
    .order('sequence_no', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data?.sequence_no as number | undefined) ?? 0
}

async function createSession(params: {
  sessionId: string
  viewerKey: string
  product: Product
  mode: PromptMode
  title: string
  preview: string
}) {
  const supabaseAdmin = getSupabaseAdmin()
  const timestamp = new Date().toISOString()
  const { error } = await supabaseAdmin.from('chat_sessions').insert({
    id: params.sessionId,
    viewer_key: params.viewerKey,
    product: params.product,
    mode: params.mode,
    title: params.title,
    last_message_preview: params.preview,
    last_message_at: timestamp,
    updated_at: timestamp,
  })

  if (error) {
    throw error
  }
}

export async function listChatSessions(params: {
  viewerKey: string
  product: Product
  limit?: number
}) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { data, error } = await supabaseAdmin
      .from('chat_sessions')
      .select('id, product, mode, title, last_message_preview, last_message_at, updated_at')
      .eq('viewer_key', params.viewerKey)
      .eq('product', params.product)
      .order('updated_at', { ascending: false })
      .limit(params.limit ?? 12)

    if (error) {
      throw error
    }

    return {
      enabled: true,
      sessions: ((data as ChatSessionRow[] | null) ?? []).map(mapSessionRow),
    }
  } catch (error) {
    if (isMissingChatTableError(error)) {
      return {
        enabled: false,
        sessions: [] as StoredChatSessionSummary[],
      }
    }

    throw error
  }
}

export async function getChatSessionMessages(params: {
  viewerKey: string
  sessionId: string
  limit?: number
}) {
  try {
    const session = await getSessionRow(params.viewerKey, params.sessionId)
    if (!session) {
      return {
        enabled: true,
        session: null,
        messages: [] as StoredChatMessage[],
      }
    }

    const supabaseAdmin = getSupabaseAdmin()
    let query = supabaseAdmin
      .from('chat_messages')
      .select('id, role, content, sequence_no, created_at, sources')
      .eq('viewer_key', params.viewerKey)
      .eq('session_id', params.sessionId)
      .order('sequence_no', { ascending: true })

    if (params.limit) {
      query = query.limit(params.limit)
    }

    const { data, error: initialError } = await query
    let error = initialError
    let messageRows = (data as ChatMessageRow[] | null) ?? null

    if (error && isMissingSourcesColumnError(error)) {
      let fallbackQuery = supabaseAdmin
        .from('chat_messages')
        .select('id, role, content, sequence_no, created_at')
        .eq('viewer_key', params.viewerKey)
        .eq('session_id', params.sessionId)
        .order('sequence_no', { ascending: true })

      if (params.limit) {
        fallbackQuery = fallbackQuery.limit(params.limit)
      }

      const fallback = await fallbackQuery
      messageRows = (fallback.data as ChatMessageRow[] | null) ?? null
      error = fallback.error
    } else {
      messageRows = (data as ChatMessageRow[] | null) ?? null
    }

    if (error) {
      throw error
    }

    return {
      enabled: true,
      session: mapSessionRow(session),
      messages: (messageRows ?? []).map(mapMessageRow),
    }
  } catch (error) {
    if (isMissingChatTableError(error)) {
      return {
        enabled: false,
        session: null,
        messages: [] as StoredChatMessage[],
      }
    }

    throw error
  }
}

export async function persistChatTurn(params: PersistChatTurnParams) {
  const sessionId = params.sessionId?.trim() || randomUUID()
  const title = buildSessionTitle(params.userMessage)
  const preview = buildPreview(params.assistantMessage)

  try {
    const existing = await getSessionRow(params.viewerKey, sessionId)

    if (!existing) {
      await createSession({
        sessionId,
        viewerKey: params.viewerKey,
        product: params.product,
        mode: params.mode,
        title,
        preview,
      })
    }

    const nextSequence = (await getLastSequenceNumber(sessionId)) + 1
    const now = new Date().toISOString()
    const supabaseAdmin = getSupabaseAdmin()

    const rowsWithSources = [
      {
        id: randomUUID(),
        session_id: sessionId,
        viewer_key: params.viewerKey,
        product: params.product,
        role: 'user',
        content: params.userMessage,
        sequence_no: nextSequence,
        created_at: now,
        sources: null,
      },
      {
        id: randomUUID(),
        session_id: sessionId,
        viewer_key: params.viewerKey,
        product: params.product,
        role: 'assistant',
        content: params.assistantMessage,
        sequence_no: nextSequence + 1,
        created_at: now,
        sources: params.assistantSources ?? null,
      },
    ]

    let { error: insertError } = await supabaseAdmin.from('chat_messages').insert(rowsWithSources)

    if (insertError && isMissingSourcesColumnError(insertError)) {
      const { error: fallbackInsertError } = await supabaseAdmin.from('chat_messages').insert([
        {
          id: rowsWithSources[0].id,
          session_id: sessionId,
          viewer_key: params.viewerKey,
          product: params.product,
          role: 'user',
          content: params.userMessage,
          sequence_no: nextSequence,
          created_at: now,
        },
        {
          id: rowsWithSources[1].id,
          session_id: sessionId,
          viewer_key: params.viewerKey,
          product: params.product,
          role: 'assistant',
          content: params.assistantMessage,
          sequence_no: nextSequence + 1,
          created_at: now,
        },
      ])

      insertError = fallbackInsertError ?? null
    }

    if (insertError) {
      throw insertError
    }

    const { error: sessionUpdateError } = await supabaseAdmin
      .from('chat_sessions')
      .update({
        mode: params.mode,
        title: existing?.title || title,
        last_message_preview: preview,
        last_message_at: now,
        updated_at: now,
      })
      .eq('viewer_key', params.viewerKey)
      .eq('id', sessionId)

    if (sessionUpdateError) {
      throw sessionUpdateError
    }

    return {
      enabled: true,
      sessionId,
    }
  } catch (error) {
    if (isMissingChatTableError(error)) {
      return {
        enabled: false,
        sessionId,
      }
    }

    throw error
  }
}
