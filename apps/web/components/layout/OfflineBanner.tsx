'use client';

import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';

export function OfflineBanner() {
  const online = useOnlineStatus();

  if (online) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white text-center py-2 text-sm font-medium">
      <span className="inline-flex items-center gap-2">
        <WifiOff className="w-4 h-4" />
        Kamu sedang offline. Perubahan tersimpan lokal.
      </span>
    </div>
  );
}
