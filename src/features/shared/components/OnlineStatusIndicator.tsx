import React from 'react';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';

interface OnlineStatusIndicatorProps {
  isOnline: boolean;
  isSyncing: boolean;
  isOnlineStatusReady: boolean;
}

export function OnlineStatusIndicator({ isOnline, isSyncing, isOnlineStatusReady }: OnlineStatusIndicatorProps) {
  // Don't render until online status is properly initialized to avoid hydration mismatch
  if (!isOnlineStatusReady) return null;
  
  return (
    <div className="fixed bottom-4 right-4 z-[9999] animate-fade-in">
      <div className="flex items-center gap-2 rounded-full bg-background px-3 py-2 text-foreground shadow-xl border-2 border-border">
        {isOnline ? (
          isSyncing ? (
            <>
              <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
              <span className="font-semibold text-sm text-blue-600 dark:text-blue-400">Syncing...</span>
            </>
          ) : (
            <>
              <Wifi className="h-5 w-5 text-green-500" />
              <span className="font-semibold text-sm text-green-600 dark:text-green-400">Online</span>
            </>
          )
        ) : (
          <>
            <WifiOff className="h-5 w-5 text-red-500" />
            <span className="font-semibold text-sm text-red-600 dark:text-red-400">Offline</span>
          </>
        )}
      </div>
    </div>
  );
}