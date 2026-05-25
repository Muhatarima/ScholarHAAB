'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createSupabaseClient } from '@/lib/supabase/clientClient';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
      setAuthed(true);
      setChecking(false);
      return;
    }

    const supabase = createSupabaseClient();
    supabase.auth.getUser().then((result) => {
      const user = result.data.user;
      if (!user) {
        router.replace('/login');
      } else {
        setAuthed(true);
      }
      setChecking(false);
    });
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="flex gap-1">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
              style={{ animationDelay: `${index * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (!authed) return null;
  return <>{children}</>;
}
