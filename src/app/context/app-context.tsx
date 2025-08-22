"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import type { User, CashTransaction, BankTransaction, StockItem, StockTransaction, Vendor, Client, LedgerTransaction, Bank, Category, MonthlySnapshot } from '@/lib/types';
import { toast } from 'sonner';
import { readData, appendData, getBalances, logout as serverLogout } from '@/lib/actions';
import { getSession } from '@/lib/auth';
import { useRouter, usePathname } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, bulkPut, clearAllData as clearLocalDb, type SyncQueueItem } from '@/lib/db';
import { WifiOff } from 'lucide-react';
import { useAppActions } from './app-actions';

type FontSize = 'sm' | 'base' | 'lg';

interface AppData {
  cashBalance: number;
  bankBalance: number;
  stockItems: StockItem[];
  totalPayables: number;
  totalReceivables: number;
  isLoading: boolean;
  isInitialBalanceDialogOpen: boolean;
  isSyncing: boolean;
  isOnline: boolean;
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
  logout: () => Promise<void>;
  reloadData: (options?: { force?: boolean; needsInitialBalance?: boolean }) => Promise<void>;
  updateBalances: () => Promise<void>;
  handleApiError: (error: any) => void;
  processSyncQueue: () => Promise<void>;
  openInitialBalanceDialog: () => void;
  closeInitialBalanceDialog: () => void;
  setLoadedMonths: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setDeletedItems: React.Dispatch<React.SetStateAction<{ cash: any[]; bank: any[]; stock: any[]; ap_ar: any[]; }>>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Omit<AppData, keyof ReturnType<typeof useLiveDBData>>>({
    cashBalance: 0, bankBalance: 0, stockItems: [], totalPayables: 0, totalReceivables: 0,
    isLoading: true, isInitialBalanceDialogOpen: false, isSyncing: false, 
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  });
  const [loadedMonths, setLoadedMonths] = useState<Record<string, boolean>>({});
  const [deletedItems, setDeletedItems] = useState({ cash: [], bank: [], stock: [], ap_ar: [] });
  
  const router = useRouter();
  const pathname = usePathname();
  
  const liveData = useLiveDBData();

  const logout = useCallback(async () => {
    await serverLogout();
    await clearLocalDb();
    window.location.href = '/login';
  }, []);

  const handleApiError = useCallback((error: any) => {
    const isAuthError = error.message.includes('JWT') || error.message.includes('Unauthorized') || error.message.includes("SESSION_EXPIRED");
    if (isAuthError) {
        toast.error('Session Expired', { description: 'Your session has expired. Please log in again.' });
        logout();
    } else {
        console.error("API Error:", error);
        toast.error('An Error Occurred', { description: error.message || 'An unknown error occurred. Please try again.' });
    }
  }, [logout]);
  
  const updateBalances = useCallback(async () => {
    try {
      const balances = await getBalances();
      setState(prev => ({
        ...prev,
        cashBalance: balances.cashBalance,
        bankBalance: balances.bankBalance,
        stockItems: balances.stockItems,
        totalPayables: balances.totalPayables,
        totalReceivables: balances.totalReceivables,
      }));
    } catch(e) {
      handleApiError(e);
    }
  }, [handleApiError]);

  const processSyncQueue = useCallback(async () => {
    // This function will be implemented in app-actions.tsx
  }, []);

  const reloadData = useCallback(async (options?: { force?: boolean, needsInitialBalance?: boolean }) => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
        const session = await getSession();
        if (!session) {
            setState(prev => ({...prev, isLoading: false }));
            await db.appState.update(1, { user: null });
            return;
        }

        const localUser = await db.appState.get(1);
        if (!localUser || !localUser.user || localUser.user.id !== session.id || options?.force) {
            await db.appState.put({
                id: 1, user: session, fontSize: 'base', currency: 'BDT',
                wastagePercentage: 0, showStockValue: false, lastSync: null
            });
             const [
                categoriesData, vendorsData, clientsData, banksData, balances,
                cashTxs, bankTxs, stockTxs, ledgerData, installmentsData, snapshotsData
            ] = await Promise.all([
                readData({ tableName: 'categories' }), readData({ tableName: 'vendors' }),
                readData({ tableName: 'clients' }), readData({ tableName: 'banks' }),
                getBalances(),
                readData({ tableName: 'cash_transactions' }), readData({ tableName: 'bank_transactions' }),
                readData({ tableName: 'stock_transactions' }), readData({ tableName: 'ap_ar_transactions' }),
                readData({ tableName: 'payment_installments' }),
                readData({ tableName: 'monthly_snapshots' }),
            ]);
             const ledgerTxsWithInstallments = (ledgerData || []).map((tx: any) => ({
                ...tx,
                installments: (installmentsData || []).filter((ins: any) => ins.ap_ar_transaction_id === tx.id)
            }));
            
            const essentialCategories = [
                { name: 'A/R Settlement', type: 'cash', direction: 'credit', is_deletable: false },
                { name: 'A/P Settlement', type: 'cash', direction: 'debit', is_deletable: false },
                { name: 'A/R Settlement', type: 'bank', direction: 'credit', is_deletable: false },
                { name: 'A/P Settlement', type: 'bank', direction: 'debit', is_deletable: false },
                { name: 'Stock Purchase', type: 'cash', direction: 'debit', is_deletable: false },
                { name: 'Stock Sale', type: 'cash', direction: 'credit', is_deletable: false },
                { name: 'Stock Purchase', type: 'bank', direction: 'debit', is_deletable: false },
                { name: 'Stock Sale', type: 'bank', direction: 'credit', is_deletable: false },
                { name: 'Initial Balance', type: 'cash', direction: 'credit', is_deletable: false },
                { name: 'Initial Balance', type: 'bank', direction: 'credit', is_deletable: false },
            ];

            for (const cat of essentialCategories) {
                const exists = (categoriesData || []).some((c: Category) => c.name === cat.name && c.type === cat.type);
                if (!exists) {
                    const newCat = await appendData({ tableName: 'categories', data: cat, select: '*' });
                    if(newCat) (categoriesData || []).push(newCat);
                }
            }

            await db.transaction('rw', db.tables, async () => {
                await bulkPut('categories', categoriesData); await bulkPut('vendors', vendorsData);
                await bulkPut('clients', clientsData); await bulkPut('banks', banksData);
                await bulkPut('cashTransactions', cashTxs); await bulkPut('bankTransactions', bankTxs);
                await bulkPut('stockTransactions', stockTxs); await bulkPut('ledgerTransactions', ledgerTxsWithInstallments);
                await bulkPut('monthlySnapshots', snapshotsData);
                await db.appState.update(1, { lastSync: new Date().toISOString() });
            });
            setLoadedMonths({});

             setState(prev => ({
                ...prev, cashBalance: balances.cashBalance, bankBalance: balances.bankBalance,
                stockItems: balances.stockItems, totalPayables: balances.totalPayables, totalReceivables: balances.totalReceivables,
            }));
        } else {
             await db.appState.update(1, { user: session });
             await updateBalances();
             processSyncQueue();
        }
       
        if(options?.needsInitialBalance && session.role === 'admin') {
             setState(prev => ({...prev, isInitialBalanceDialogOpen: true }));
        }

    } catch (error: any) {
        handleApiError(error);
    } finally {
        setState(prev => ({...prev, isLoading: false}));
    }
  }, [handleApiError, updateBalances, processSyncQueue]);

  useEffect(() => {
    const checkSessionAndLoad = async () => {
        const session = await getSession();
        if (session) {
            if (liveData.user && liveData.user.id === session.id) {
                 setState(prev => ({ ...prev, isLoading: false }));
                 updateBalances();
            } else {
                reloadData();
            }
        } else {
            setState(prev => ({ ...prev, isLoading: false }));
            db.appState.update(1, { user: null });
        }
    };
    checkSessionAndLoad();
  }, []);

  useEffect(() => {
    const handleOnline = () => {
        toast.success("You are back online!");
        setState(prev => ({ ...prev, isOnline: true }));
        processSyncQueue();
    };

    const handleOffline = () => {
        setState(prev => ({ ...prev, isOnline: false }));
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [processSyncQueue]);


  useEffect(() => {
    if (state.isLoading) return;
    if (pathname === '/login') {
        if(liveData.user) router.replace('/');
    } else {
        if(!liveData.user) router.replace('/login');
    }
  }, [pathname, liveData.user, state.isLoading, router]);
  

  const openInitialBalanceDialog = () => setState(prev => ({...prev, isInitialBalanceDialogOpen: true}));
  const closeInitialBalanceDialog = () => setState(prev => ({...prev, isInitialBalanceDialogOpen: false}));

  return (
    <AppContext.Provider value={{ 
        ...state,
        ...liveData,
        deletedCashTransactions: deletedItems.cash,
        deletedBankTransactions: deletedItems.bank,
        deletedStockTransactions: deletedItems.stock,
        deletedLedgerTransactions: deletedItems.ap_ar,
        loadedMonths,
        setLoadedMonths,
        setDeletedItems,
        reloadData,
        updateBalances,
        handleApiError,
        processSyncQueue,
        logout,
        openInitialBalanceDialog,
        closeInitialBalanceDialog
    }}>
      {!state.isOnline && (
          <div className="fixed bottom-4 right-4 z-50 animate-fade-in">
              <div className="flex items-center gap-2 rounded-full bg-destructive px-4 py-2 text-destructive-foreground shadow-lg">
                  <WifiOff className="h-5 w-5" />
                  <span className="font-semibold">You are offline</span>
              </div>
          </div>
      )}
      {children}
    </AppContext.Provider>
  );
}

function useLiveDBData() {
    const appState = useLiveQuery(() => db.appState.get(1), []);
    const cashTransactions = useLiveQuery(() => db.cashTransactions.toArray(), []);
    const bankTransactions = useLiveQuery(() => db.bankTransactions.toArray(), []);
    const stockTransactions = useLiveQuery(() => db.stockTransactions.toArray(), []);
    const ledgerTransactions = useLiveQuery(() => db.ledgerTransactions.orderBy('date').reverse().toArray(), []);
    const banks = useLiveQuery(() => db.banks.toArray(), []);
    const categories = useLiveQuery(() => db.categories.toArray(), []);
    const vendors = useLiveQuery(() => db.vendors.toArray(), []);
    const clients = useLiveQuery(() => db.clients.toArray(), []);
    const syncQueueCount = useLiveQuery(() => db.syncQueue.count(), 0) ?? 0;

    const { cashCategories, bankCategories } = useMemo(() => {
        const dbCash: Category[] = [];
        const dbBank: Category[] = [];
        (categories || []).forEach(c => {
            if (c.type === 'cash') dbCash.push(c);
            else if (c.type === 'bank') dbBank.push(c);
        });
        return { cashCategories: dbCash, bankCategories: dbBank };
    }, [categories]);

    return {
        user: appState?.user ?? null,
        fontSize: appState?.fontSize ?? 'base',
        currency: appState?.currency ?? 'BDT',
        wastagePercentage: appState?.wastagePercentage ?? 0,
        showStockValue: appState?.showStockValue ?? false,
        cashTransactions: cashTransactions || [],
        bankTransactions: bankTransactions || [],
        stockTransactions: stockTransactions || [],
        ledgerTransactions: ledgerTransactions || [],
        cashCategories,
        bankCategories,
        vendors: vendors || [],
        clients: clients || [],
        banks: banks || [],
        syncQueueCount,
    }
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
