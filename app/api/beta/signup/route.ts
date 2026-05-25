import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { handleApiError } from '@/lib/errors/AppError';
import { validateEmail } from '@/lib/validation/inputValidator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  try {
    return createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      email?: unknown;
      name?: unknown;
      level?: unknown;
      subjects?: unknown;
    };
    const email = validateEmail(body.email);

    const supabase = getSupabase();
    if (supabase) {
      const { error } = await supabase.from('beta_signups').upsert({
        email,
        name: typeof body.name === 'string' ? body.name : null,
        level: typeof body.level === 'string' ? body.level : null,
        subjects: Array.isArray(body.subjects) ? body.subjects : [],
        source: 'demo_page',
      });

      if (error && error.code !== '23505') {
        console.error('Beta signup database error:', error);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Welcome to ScholarHAAB beta!',
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AppError') {
      return handleApiError(error);
    }
    console.error('Beta signup failed:', error);
    return NextResponse.json({ error: 'Signup failed' }, { status: 500 });
  }
}
