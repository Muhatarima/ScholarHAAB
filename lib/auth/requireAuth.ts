import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@/lib/supabase/route';

function shouldBypassAuthCheck() {
  return (
    process.env.ALLOW_ANONYMOUS_PRODUCT_TESTS === 'true' ||
    (process.env.NODE_ENV !== 'production' &&
      (process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || process.env.DEMO_MODE === 'true'))
  );
}

async function getBearerUser(req?: Request): Promise<User | null> {
  const authorization = req?.headers.get('authorization')?.trim();
  const match = authorization ? /^Bearer\s+(.+)$/i.exec(authorization) : null;
  const accessToken = match?.[1]?.trim();
  if (!accessToken) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(accessToken);
  return error ? null : data.user;
}

async function resolveAuthenticatedUser(req?: Request) {
  const bearerUser = await getBearerUser(req);
  if (bearerUser) return bearerUser;

  try {
    const supabase = await createRouteHandlerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    return error ? null : user;
  } catch {
    return null;
  }
}

export async function requireAuth(req?: Request): Promise<{
  user: User | null;
  error: NextResponse | null;
}> {
  if (shouldBypassAuthCheck()) {
    return {
      user: { id: 'test-anonymous-user' } as User,
      error: null,
    };
  }

  const user = await resolveAuthenticatedUser(req);

  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  return { user, error: null };
}

export async function requireRealAuth(req?: Request): Promise<{
  user: User | null;
  error: NextResponse | null;
}> {
  const user = await resolveAuthenticatedUser(req);

  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  return { user, error: null };
}
