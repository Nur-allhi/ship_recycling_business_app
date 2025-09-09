"use client";

import React from 'react';
import { Loader2 } from 'lucide-react';

interface AppOverlayProps {
  message: string;
}

export function AppOverlay({ message }: AppOverlayProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
        <p className="mt-4 text-lg font-semibold">{message}</p>
      </div>
    </div>
  );
}
