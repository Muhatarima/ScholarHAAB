'use client';

import { useEffect, useState } from 'react';

export default function OfflineBanner() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setShowBanner(false);
    };
    const handleOffline = () => {
      setShowBanner(true);
    };

    setShowBanner(!window.navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!showBanner) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-black text-center py-2 px-4 text-sm font-medium">
      Offline mode - showing cached Cambridge answers. Core features still work.
    </div>
  );
}
