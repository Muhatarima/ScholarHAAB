'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { trackEvent } from '@/lib/analytics/usageTracker';

export default function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    trackEvent('page_view', { page: pathname });
  }, [pathname]);

  return null;
}
