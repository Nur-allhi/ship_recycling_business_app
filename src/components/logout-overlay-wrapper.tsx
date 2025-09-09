
'use client';

import { useAppContext } from '@/app/context/app-context';
import { AppOverlay } from '@/components/app-overlay'; 
import React from 'react';

export default function LogoutOverlayWrapper() {
  const { isLoggingOut, blockingOperation } = useAppContext();
  
  if (isLoggingOut) {
    return <AppOverlay message="Logging out..." />;
  }
  
  // This wrapper only handles blocking operations that occur *after* the initial load.
  if (blockingOperation.isActive) {
    return <AppOverlay message={blockingOperation.message} />;
  }

  return null;
}
