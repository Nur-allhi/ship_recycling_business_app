"use client";

import React from 'react';
import { useAppContext } from '@/app/context/app-context';
import { Loader2 } from 'lucide-react'; // Import Loader2 directly

export function LogoutOverlay() {
  const { isLoggingOut } = useAppContext();

  if (!isLoggingOut) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
        <p className="mt-4 text-lg font-semibold">Logging out...</p>
      </div>
    </div>
  );
}