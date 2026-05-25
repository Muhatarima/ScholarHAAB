'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { AuthChangeEvent, SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;
let authListenerAttached = false;

export function createSupabaseClient() {
  if (client) return client;

  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ) as SupabaseClient;

  if (!authListenerAttached && typeof window !== 'undefined') {
    authListenerAttached = true;
    client.auth.onAuthStateChange((event: AuthChangeEvent) => {
      if (event === 'SIGNED_OUT') {
        window.location.href = '/login';
      }
    });
  }

  return client;
}
