
"use client";

import React, { createContext, useContext, useMemo, useCallback } from 'react';
import type { User, CashTransaction, BankTransaction, StockItem, StockTransaction, Vendor, Client, LedgerTransaction, Bank, Category, MonthlySnapshot } from '@/lib/types';
import { useSessionManager } from '@/features/auth/useSessionManager';
import { useSyncManager } from '@/features/sync/useSyncManager';
import { useDataManager } from '@/features/shared/hooks/useDataManager';
import { OnlineStatusIndicator } from '@/features/shared/components/OnlineStatusIndicator';

type FontSize = 'sm' | 'base' | 'lg';

interface AppData {
  cashBalance: number;
  bankBalance: number;
  stockItems: StockItem[] | undefined;
  totalPayables: number;
  totalReceivables: number;
  isLoading: boolean;
  isInitialBalanceDialogOpen: boolean;
  isSyncing: boolean;
  isOnline: boolean;
  isOnlineStatusReady: boolean;
  user: User | null;
  fontSize: FontSize;
  currency: string;
  wastagePercentage: number;
  showStockValue: boolean;
  cashTransactions: CashTransaction[];
  bankTransactions: BankTransaction[];
  stockTransactions: StockTransaction[];
  ledgerTransactions: LedgerTransaction[];
  deletedCashTransactions: CashTransaction[];
  deletedBankTransactions: BankTransaction[];
  deletedStockTransactions: StockTransaction[];
  deletedLedgerTransactions: LedgerTransaction[];
  cashCategories: Category[];
  bankCategories: Category[];
  vendors: Vendor[];
  clients: Client[];
  banks: Bank[];
  syncQueueCount: number;
  loadedMonths: Record<string, boolean>;
}

interface AppContextType extends AppData {
  login: (credentials: Parameters<typeof import('@/app/auth/actions').login>[0]) => Promise<any>;
  logout: () => Promise<void>;
  reloadData: (options?: { force?: boolean; needsInitialBalance?: boolean }) => Promise<void>;
  updateBalances: () => Promise<void>;
  handleApiError: (error: unknown) => void;
  processSyncQueue: (specificItemId?: number) => Promise<void>;
  openInitialBalanceDialog: () => void;
  closeInitialBalanceDialog: () => void;
  loadRecycleBinData: () => Promise<void>;
  setLoadedMonths: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setDeletedItems: React.Dispatch<React.SetStateAction<{ cash: any[]; bank: any[]; stock: any[]; ap_ar: any[]; }>>;
  setUser: (user: User | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
    // Create a stable reloadData callback that will be defined later
    const reloadDataRef = React.useRef<((options?: { force?: boolean; needsInitialBalance?: boolean }) => Promise<void>) | null>(null);
    
    // Stable callback for session manager
    const stableReloadData = useCallback(async (options?: { force?: boolean; needsInitialBalance?: boolean }) => {
        if (reloadDataRef.current) {
            await reloadDataRef.current(options);
        }
    }, []);
    
    // Initialize the session manager with stable callback
    const sessionManager = useSessionManager(stableReloadData);
    
    // Initialize the sync manager
    const syncManager = useSyncManager(sessionManager.logout);
    
    // Initialize the data manager
    const dataManager = useDataManager(
        sessionManager.user, 
        syncManager.handleApiError, 
        syncManager.isOnline
    );
    
    // Update the ref with the actual reloadData function
    React.useEffect(() => {
        reloadDataRef.current = dataManager.reloadData;
    }, [dataManager.reloadData]);
    
    const contextValue = useMemo(() => ({
        // Session data
        ...sessionManager,
        
        // Sync data
        ...syncManager,
        
        // Data manager data
        ...dataManager,
    }), [sessionManager, syncManager, dataManager]);

    return (
        <AppContext.Provider value={contextValue}>
            <OnlineStatusIndicator 
                isOnline={syncManager.isOnline}
                isSyncing={syncManager.isSyncing}
                isOnlineStatusReady={syncManager.isOnlineStatusReady}
            />
            {children}
        </AppContext.Provider>
    );
}

export function useAppContext() {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
}
