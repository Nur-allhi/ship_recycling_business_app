import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { db } from '@/lib/db';
import { syncService } from './sync.service';

export interface SyncManagerState {
  isSyncing: boolean;
  isOnline: boolean;
  isOnlineStatusReady: boolean;
  syncQueueCount: number;
}

export interface SyncManagerActions {
  processSyncQueue: (specificItemId?: number) => Promise<void>;
  handleApiError: (error: unknown) => void;
}

export interface SyncManagerReturn extends SyncManagerState, SyncManagerActions {}

export function useSyncManager(
  logout: () => Promise<void>
): SyncManagerReturn {
  const [state, setState] = useState({
    isSyncing: false,
    isOnline: true, // Always start with true to avoid hydration mismatch
    isOnlineStatusReady: false, // Track when online status is properly initialized
    syncQueueCount: 0
  });

  const handleApiError = useCallback((error: any) => {
    const isAuthError = error.message.includes('JWT') || 
                       error.message.includes('Unauthorized') || 
                       error.message.includes("SESSION_EXPIRED");
    
    if (isAuthError) {
      toast.error('Session Expired', { 
        description: 'Your session has expired. Please log in again.' 
      });
      logout();
    } else {
      console.error("API Error:", error);
      toast.error('An Error Occurred', { 
        description: error.message || 'An unknown error occurred. Please try again.' 
      });
    }
  }, [logout]);

  const processSyncQueue = useCallback(async (specificItemId?: number) => {
    if (state.isSyncing && !specificItemId) return;
    
    setState(prev => ({ ...prev, isSyncing: true }));

    try {
      const queueStatus = await syncService.getQueueStatus();
      
      if (queueStatus.count === 0) {
        setState(prev => ({ ...prev, isSyncing: false }));
        return;
      }

      if (!specificItemId) {
        toast.info(`Syncing ${queueStatus.count} items...`);
      }

      const result = await syncService.flushQueue(specificItemId);
      
      if (!specificItemId) {
        if (result.failed > 0) {
          toast.error(`${result.failed} sync operations failed. Check console for details.`);
        } else {
          toast.success("All items synced successfully!");
        }
      }
    } catch (error) {
      handleApiError(error);
    } finally {
      setState(prev => ({ ...prev, isSyncing: false }));
    }
  }, [state.isSyncing, handleApiError]);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      toast.success("You are back online!");
      setState(prev => ({ ...prev, isOnline: true }));
      processSyncQueue();
    };
    
    const handleOffline = () => {
      toast.info("You are offline", { 
        description: "Changes will be saved locally and synced when you're back." 
      });
      setState(prev => ({ ...prev, isOnline: false }));
    };
    
    // Initialize online status after component mounts to avoid hydration mismatch
    setState(prev => ({ 
      ...prev, 
      isOnline: navigator.onLine,
      isOnlineStatusReady: true 
    }));
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [processSyncQueue]);

  // Update sync queue count
  useEffect(() => {
    const updateSyncQueueCount = async () => {
      const count = await db.sync_queue.count();
      setState(prev => ({ ...prev, syncQueueCount: count }));
    };

    updateSyncQueueCount();
    
    // Set up interval to periodically update count
    const interval = setInterval(updateSyncQueueCount, 5000);
    return () => clearInterval(interval);
  }, []);

  return {
    ...state,
    processSyncQueue,
    handleApiError
  };
}