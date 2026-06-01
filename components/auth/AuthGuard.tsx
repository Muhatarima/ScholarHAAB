'use client';

import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createSupabaseClient } from '@/lib/supabase/clientClient';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const bypassAuth = process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
  const [checking, setChecking] = useState(!bypassAuth);
  const [authed, setAuthed] = useState(bypassAuth);

  useEffect(() => {
    if (bypassAuth) {
      return;
    }

    const supabase = createSupabaseClient();
    supabase.auth.getUser().then(async (result) => {
      const user = result.data.user;
      if (!user) {
        router.replace('/login');
      } else {
        try {
          const res = await fetch('/api/profile', { cache: 'no-store' });
          const data = await res.json();
          const completed = Boolean(data?.profile?.onboardingCompleted);
          if (!completed && pathname !== '/setup') {
            router.replace('/setup');
            return;
          }
          if (completed && pathname === '/setup') {
            router.replace('/solver');
            return;
          }
        } catch {
          if (pathname !== '/setup') {
            router.replace('/setup');
            return;
          }
        }
        setAuthed(true);
      }
      setChecking(false);
    });
  }, [bypassAuth, pathname, router]);

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
