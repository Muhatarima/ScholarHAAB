import { createClient } from '@supabase/supabase-js';

let serverClient: ReturnType<typeof createClient> | null = null;

export function getServerSupabase() {
  if (!serverClient) {
    serverClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: { persistSession: false },
      }
    );
  }

  return serverClient;
}
