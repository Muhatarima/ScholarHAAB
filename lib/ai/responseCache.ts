import { createSupabaseServerClient } from '@/lib/supabase/serverClient';

const memoryCache = new Map<
  string,
  {
    response: string;
    timestamp: number;
  }
>();

const CACHE_TTL = 24 * 60 * 60 * 1000;

function buildCacheKey(question: string, subject: string): string {
  const normalized = question.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 100);
  return `${subject}:${normalized}`;
}

export async function getCachedResponse(
  question: string,
  subject: string
): Promise<string | null> {
  const key = buildCacheKey(question, subject);
  const mem = memoryCache.get(key);

  if (mem && Date.now() - mem.timestamp < CACHE_TTL) {
    return mem.response;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from('response_cache')
      .select('response')
      .eq('cache_key', key)
      .gt('expires_at', new Date().toISOString())
      .single();

    const response = typeof data?.response === 'string' ? data.response : null;
    if (response) {
      memoryCache.set(key, {
        response,
        timestamp: Date.now(),
      });
      return response;
    }
  } catch {
    // Cache misses and unavailable cache tables should never block the answer.
  }

  return null;
}

export const getCached = getCachedResponse;

export async function setCachedResponse(
  question: string,
  subject: string,
  response: string
): Promise<void> {
  const key = buildCacheKey(question, subject);

  memoryCache.set(key, { response, timestamp: Date.now() });

  try {
    const supabase = await createSupabaseServerClient();
    await supabase.from('response_cache').upsert({
      cache_key: key,
      response,
      expires_at: new Date(Date.now() + CACHE_TTL).toISOString(),
    });
  } catch {
    // Memory cache still works when persistent cache is unavailable.
  }
}

export const setCache = setCachedResponse;
