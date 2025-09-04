'use client';

import { useAppContext } from '@/app/context/app-context';
import { LogoutOverlay } from '@/components/logout-overlay';
import React from 'react';

export default function LogoutOverlayWrapper() {
  const { isLoggingOut } = useAppContext();
  return isLoggingOut ? <LogoutOverlay /> : null;
}
