
'use client';

import { useAppContext } from '@/app/context/app-context';
import { AppOverlay } from '@/components/logout-overlay'; // Renamed to AppOverlay
import React from 'react';

export default function LogoutOverlayWrapper() {
  const { isLoggingOut, blockingOperation } = useAppContext();
  
  if (isLoggingOut) {
    return <AppOverlay message="Logging out..." />;
  }
  
  if (blockingOperation.isActive) {
    return <AppOverlay message={blockingOperation.message} />;
  }

  return null;
}
