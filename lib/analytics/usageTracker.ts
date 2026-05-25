import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type TrackEventData = {
  subject?: string;
  topic?: string;
  question?: string;
  page?: string;
  userId?: string | null;
};

export type TractionStats = {
  totalQuestions: number;
  uniqueSessions: number;
  questionsToday: number;
  popularSubjects: { subject: string; count: number }[];
  dailyActivity: { date: string; count: number }[];
};

type UsageEventRow = {
  session_id: string | null;
  subject?: string | null;
  created_at?: string | null;
};

let browserSessionId: string | null = null;
let supabaseClient: SupabaseClient | null = null;

function getEnv(name: string): string | undefined {
  return process.env[name] || undefined;
}

function getSupabase(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;

  const url = getEnv('NEXT_PUBLIC_SUPABASE_URL');
  const key =
    getEnv('SUPABASE_SERVICE_ROLE_KEY') ||
    getEnv('SUPABASE_SERVICE_KEY') ||
    getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  if (!url || !key) return null;

  try {
    supabaseClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    return supabaseClient;
  } catch (error) {
    console.error('Analytics client unavailable:', error);
    return null;
  }
}

function generateSessionId(): string {
  if (typeof window === 'undefined') return 'server';

  if (browserSessionId) return browserSessionId;

  const existing = window.sessionStorage.getItem('scholarhaaab_session');
  if (existing) {
    browserSessionId = existing;
    return existing;
  }

  browserSessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  window.sessionStorage.setItem('scholarhaaab_session', browserSessionId);
  return browserSessionId;
}

function todayIsoDate(): string {
  return new Date().toISOString().split('T')[0] ?? new Date().toISOString();
}

export async function trackEvent(eventType: string, data?: TrackEventData): Promise<void> {
  try {
    const supabase = getSupabase();
    if (!supabase) return;

    await supabase.from('usage_events').insert({
      event_type: eventType,
      subject: data?.subject || null,
      topic: data?.topic || null,
      question_preview: data?.question?.slice(0, 100) || null,
      page: data?.page || (typeof window !== 'undefined' ? window.location.pathname : null),
      session_id: generateSessionId(),
      user_id: data?.userId || null,
    });
  } catch (error) {
    // Analytics must never block a student answer or demo flow.
    console.error('Analytics error (silent):', error);
  }
}

export async function getTractionStats(): Promise<TractionStats> {
  const emptyStats: TractionStats = {
    totalQuestions: 0,
    uniqueSessions: 0,
    questionsToday: 0,
    popularSubjects: [],
    dailyActivity: [],
  };

  try {
    const supabase = getSupabase();
    if (!supabase) return emptyStats;

    const today = todayIsoDate();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [totalResult, todayResult, sessionsResult, subjectsResult, dailyResult] =
      await Promise.all([
        supabase
          .from('usage_events')
          .select('*', { count: 'exact', head: true })
          .eq('event_type', 'question_asked'),
        supabase
          .from('usage_events')
          .select('*', { count: 'exact', head: true })
          .eq('event_type', 'question_asked')
          .gte('created_at', today),
        supabase.from('usage_events').select('session_id').gte('created_at', sevenDaysAgo),
        supabase
          .from('usage_events')
          .select('subject')
          .not('subject', 'is', null)
          .eq('event_type', 'question_asked'),
        supabase
          .from('usage_events')
          .select('created_at')
          .eq('event_type', 'question_asked')
          .gte('created_at', sevenDaysAgo),
      ]);

    const uniqueSessions = new Set(
      ((sessionsResult.data || []) as UsageEventRow[])
        .map((event) => event.session_id)
        .filter(Boolean)
    ).size;

    const subjectCounts: Record<string, number> = {};
    for (const event of (subjectsResult.data || []) as UsageEventRow[]) {
      if (event.subject) {
        subjectCounts[event.subject] = (subjectCounts[event.subject] || 0) + 1;
      }
    }

    const dailyCounts: Record<string, number> = {};
    for (const event of (dailyResult.data || []) as UsageEventRow[]) {
      const date = event.created_at?.split('T')[0];
      if (date) {
        dailyCounts[date] = (dailyCounts[date] || 0) + 1;
      }
    }

    return {
      totalQuestions: totalResult.count || 0,
      uniqueSessions,
      questionsToday: todayResult.count || 0,
      popularSubjects: Object.entries(subjectCounts)
        .map(([subject, count]) => ({ subject, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      dailyActivity: Object.entries(dailyCounts)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
  } catch {
    return emptyStats;
  }
}
