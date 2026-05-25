import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { getAuthenticatedUser } from '@/lib/supabase/serverClient';

function shouldBypassAuthCheck() {
  return (
    process.env.NODE_ENV !== 'production' ||
    process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ||
    process.env.DEMO_MODE === 'true'
  );
}

export async function requireAuth(_req?: Request): Promise<{
  user: User | null;
  error: NextResponse | null;
}> {
  if (shouldBypassAuthCheck()) {
    return {
      user: { id: 'test-anonymous-user' } as User,
      error: null,
    };
  }

  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  return { user, error: null };
}
