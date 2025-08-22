
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import type { User, CashTransaction, BankTransaction, StockItem, StockTransaction, Vendor, Client, LedgerTransaction, Bank, Category, MonthlySnapshot } from '@/lib/types';
import { toast } from 'sonner';
import * as server from '@/lib/actions';
import { getSession } from '@/lib/auth';
import { useRouter, usePathname } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, bulkPut, clearAllData as clearLocalDb, type SyncQueueItem } from '@/lib/db';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';

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
    user: null, // Initialize user here to avoid dependency issues
  });
  const [loadedMonths, setLoadedMonths] = useState<Record<string, boolean>>({});
  const [deletedItems, setDeletedItems] = useState<{ cash: any[], bank: any[], stock: any[], ap_ar: any[] }>({ cash: [], bank: [], stock: [], ap_ar: [] });
  
  const router = useRouter();
  const pathname = usePathname();
  
  const liveData = useLiveDBData();

  const setUser = useCallback((user: User | null) => {
    setState(prev => ({...prev, user}));
  }, []);

  const logout = useCallback(async () => {
    await server.logout();
    await clearLocalDb();
    setUser(null);
    window.location.href = '/login';
  }, [setUser]);

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
    // This is now a local-only operation for speed
    const [
      allCash, allBank, allLedger, allStock, allInitialStock
    ] = await Promise.all([
      db.cashTransactions.toArray(),
      db.bankTransactions.toArray(),
      db.ledgerTransactions.toArray(),
      db.stockTransactions.toArray(),
      db.initialStock.toArray(),
    ]);

    const cashBalance = allCash.reduce((acc, tx) => acc + (tx.type === 'income' ? tx.actual_amount : -tx.actual_amount), 0);
    const bankBalance = allBank.reduce((acc, tx) => acc + (tx.type === 'deposit' ? tx.actual_amount : -tx.actual_amount), 0);
    const totalPayables = allLedger.filter(tx => tx.type === 'payable').reduce((acc, tx) => acc + (tx.amount - tx.paid_amount), 0);
    const totalReceivables = allLedger.filter(tx => tx.type === 'receivable').reduce((acc, tx) => acc + (tx.amount - tx.paid_amount), 0);
    
    // Recalculate stock from initial items and transactions
    const stockPortfolio: Record<string, { weight: number; totalValue: number }> = {};
    (allInitialStock || []).forEach(item => {
        if (!stockPortfolio[item.name]) stockPortfolio[item.name] = { weight: 0, totalValue: 0 };
        stockPortfolio[item.name].weight += item.weight;
        stockPortfolio[item.name].totalValue += item.weight * item.purchasePricePerKg;
    });

    const sortedStockTxs = [...allStock].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    sortedStockTxs.forEach(tx => {
        if (!stockPortfolio[tx.stockItemName]) stockPortfolio[tx.stockItemName] = { weight: 0, totalValue: 0 };
        const item = stockPortfolio[tx.stockItemName];
        const currentAvgPrice = item.weight > 0 ? item.totalValue / item.weight : 0;
        if (tx.type === 'purchase') {
            item.weight += tx.weight;
            item.totalValue += tx.weight * tx.pricePerKg;
        } else {
            item.weight -= tx.weight;
            item.totalValue -= tx.weight * currentAvgPrice;
        }
    });

    const stockItems = Object.entries(stockPortfolio).map(([name, data], index) => ({
      id: `stock-item-${index}`,
      name,
      weight: data.weight,
      purchasePricePerKg: data.weight > 0 ? data.totalValue / data.weight : 0,
    }));

    setState(prev => ({
        ...prev, cashBalance, bankBalance, totalPayables, totalReceivables, stockItems,
    }));
  }, []);

  const processSyncQueue = useCallback(async () => {
    if (state.isSyncing) return;
    setState(prev => ({ ...prev, isSyncing: true }));
    
    const queue = await db.syncQueue.orderBy('timestamp').toArray();
    if (queue.length === 0) {
        setState(prev => ({ ...prev, isSyncing: false }));
        return;
    }
    
    toast.info(`Syncing ${queue.length} items...`);

    let failedItems = 0;
    for (const item of queue) {
        try {
            let result;
            const { localId, ...payloadWithoutId } = item.payload; // Exclude localId from server payload

            switch(item.action) {
                case 'appendData':
                    result = await server.appendData(payloadWithoutId);
                    if (result && localId) {
                         const tableName = payloadWithoutId.tableName;
                         let localTableName: keyof AppDatabase;

                         if (tableName === 'ap_ar_transactions') localTableName = 'ledgerTransactions';
                         else if (tableName === 'cash_transactions') localTableName = 'cashTransactions';
                         else if (tableName === 'bank_transactions') localTableName = 'bankTransactions';
                         else if (tableName === 'stock_transactions') localTableName = 'stockTransactions';
                         else localTableName = tableName.slice(0, -1) + 's' as any; // e.g. 'vendors'
                        
                        await db.table(localTableName).where({ id: localId }).modify({ id: result.id });
                    }
                    break;
                case 'updateData': result = await server.updateData(item.payload); break;
                case 'deleteData': result = await server.deleteData(item.payload); break;
                case 'restoreData': result = await server.restoreData(item.payload); break;
                case 'recordPaymentAgainstTotal': result = await server.recordPaymentAgainstTotal(item.payload); break;
                case 'recordDirectPayment': result = await server.recordDirectPayment(item.payload); break;
                case 'transferFunds': result = await server.transferFunds(item.payload); break;
                case 'setInitialBalances': result = await server.setInitialBalances(item.payload); break;
                case 'deleteCategory': result = await server.deleteCategory(item.payload); break;
                case 'addStockTransaction': result = await server.addStockTransaction(payloadWithoutId); 
                    if (result && localId) {
                         await db.stockTransactions.where({ id: localId }).modify({ id: result.stockTx.id });
                         if(result.financialTx) {
                            const finTable = result.financialTx.bank_id ? 'bankTransactions' : 'cashTransactions';
                            await db.table(finTable).where({ linkedStockTxId: localId }).modify({ id: result.financialTx.id, linkedStockTxId: result.stockTx.id });
                         }
                    }
                    break;
                case 'addInitialStockItem': result = await server.addInitialStockItem(item.payload); break;
                case 'batchImportData': result = await server.batchImportData(item.payload.data); break;
                case 'deleteAllData': result = await server.deleteAllData(); break;
                default:
                  console.warn(`Unknown sync action: ${item.action}`);
            }

            // If action succeeded, remove it from the queue
            if (item.id) await db.syncQueue.delete(item.id);
            
        } catch (error) {
            failedItems++;
            handleApiError(error);
            console.error(`Sync failed for item ${item.id} (${item.action}):`, error);
        }
    }
    
    if(failedItems > 0) {
        toast.error(`${failedItems} sync operations failed. Check console for details.`);
    } else {
        toast.success("All items synced successfully!");
        // We can do a gentle reload here if needed, but optimistic UI should be sufficient
        // await reloadData(); // Optional: uncomment for a full refresh post-sync
    }

    setState(prev => ({ ...prev, isSyncing: false }));
  }, [state.isSyncing, handleApiError]);

  const reloadData = useCallback(async (options?: { force?: boolean, needsInitialBalance?: boolean }) => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
        const session = await getSession();
        if (!session) {
            setState(prev => ({...prev, isLoading: false, user: null }));
            await db.appState.update(1, { user: null });
            return;
        }

        setUser(session); // Set user immediately

        const localUser = await db.appState.get(1);
        if (!localUser || !localUser.user || localUser.user.id !== session.id || options?.force) {
            await db.appState.put({
                id: 1, user: session, fontSize: 'base', currency: 'BDT',
                wastagePercentage: 0, showStockValue: false, lastSync: null
            });
             const [
                categoriesData, vendorsData, clientsData, banksData,
                cashTxs, bankTxs, stockTxs, ledgerData, installmentsData, snapshotsData, initialStockData
            ] = await Promise.all([
                server.readData({ tableName: 'categories' }), server.readData({ tableName: 'vendors' }),
                server.readData({ tableName: 'clients' }), server.readData({ tableName: 'banks' }),
                server.readData({ tableName: 'cash_transactions' }), server.readData({ tableName: 'bank_transactions' }),
                server.readData({ tableName: 'stock_transactions' }), server.readData({ tableName: 'ap_ar_transactions' }),
                server.readData({ tableName: 'payment_installments' }),
                server.readData({ tableName: 'monthly_snapshots' }),
                server.readData({ tableName: 'initial_stock' }),
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
                { name: 'Funds Transfer', type: 'cash', direction: null, is_deletable: false },
                { name: 'Funds Transfer', type: 'bank', direction: null, is_deletable: false },
            ];

            for (const cat of essentialCategories) {
                const exists = (categoriesData || []).some((c: Category) => c.name === cat.name && c.type === cat.type);
                if (!exists) {
                    const newCat = await server.appendData({ tableName: 'categories', data: cat, select: '*' });
                    if(newCat) (categoriesData || []).push(newCat);
                }
            }

            await db.transaction('rw', db.tables, async () => {
                await clearLocalDb(); // Clear everything before a full reload
                await db.appState.put({
                    id: 1, user: session, fontSize: 'base', currency: 'BDT',
                    wastagePercentage: 0, showStockValue: false, lastSync: null
                });
                await bulkPut('categories', categoriesData); await bulkPut('vendors', vendorsData);
                await bulkPut('clients', clientsData); await bulkPut('banks', banksData);
                await bulkPut('cashTransactions', cashTxs); await bulkPut('bankTransactions', bankTxs);
                await bulkPut('stockTransactions', stockTxs); await bulkPut('ledgerTransactions', ledgerTxsWithInstallments);
                await bulkPut('monthlySnapshots', snapshotsData); await bulkPut('initialStock', initialStockData);
                await db.appState.update(1, { lastSync: new Date().toISOString() });
            });
            setLoadedMonths({});
        }
        
        await updateBalances(); // Update balances from local DB after reload
        processSyncQueue();
       
        if(options?.needsInitialBalance && session.role === 'admin') {
             setState(prev => ({...prev, isInitialBalanceDialogOpen: true }));
        }

    } catch (error: any) {
        handleApiError(error);
    } finally {
        setState(prev => ({...prev, isLoading: false}));
    }
  }, [handleApiError, updateBalances, processSyncQueue, setUser]);

  useEffect(() => {
    const checkSessionAndLoad = async () => {
        const session = await getSession();
        setUser(session);
        if (session) {
            if (liveData.user && liveData.user.id === session.id) {
                 setState(prev => ({ ...prev, isLoading: false }));
                 updateBalances();
            } else {
                reloadData();
            }
        } else {
            setState(prev => ({ ...prev, isLoading: false }));
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
        toast.info("You are offline", { description: "Changes will be saved locally and synced when you're back." });
        setState(prev => ({ ...prev, isOnline: false }));
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Set initial status
    setState(prev => ({...prev, isOnline: navigator.onLine }));


    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [processSyncQueue]);


  useEffect(() => {
    if (state.isLoading) return;
    if (pathname === '/login') {
        if(state.user) router.replace('/');
    } else {
        if(!state.user) router.replace('/login');
    }
  }, [pathname, state.user, state.isLoading, router]);
  
  const loadRecycleBinData = useCallback(async () => {
    if (state.isOnline) {
      try {
        const [cash, bank, stock, ap_ar] = await Promise.all([
            server.readDeletedData({ tableName: 'cash_transactions'}),
            server.readDeletedData({ tableName: 'bank_transactions'}),
            server.readDeletedData({ tableName: 'stock_transactions'}),
            server.readDeletedData({ tableName: 'ap_ar_transactions'}),
        ]);
        setDeletedItems({ cash: cash || [], bank: bank || [], stock: stock || [], ap_ar: ap_ar || [] });
      } catch (error) {
          handleApiError(error);
      }
    } else {
      toast.error("Cannot load recycle bin data while offline.");
    }
  }, [handleApiError, state.isOnline]);


  const openInitialBalanceDialog = () => setState(prev => ({...prev, isInitialBalanceDialogOpen: true}));
  const closeInitialBalanceDialog = () => setState(prev => ({...prev, isInitialBalanceDialogOpen: false}));

  const OnlineStatusIndicator = () => (
    <div className="fixed bottom-4 right-4 z-50 animate-fade-in">
        <div className="flex items-center gap-2 rounded-full bg-background px-3 py-2 text-foreground shadow-lg border">
            {state.isOnline ? (
                state.isSyncing ? (
                    <>
                        <RefreshCw className="h-5 w-5 animate-spin" />
                        <span className="font-semibold text-sm">Syncing...</span>
                    </>
                ) : (
                    <>
                        <Wifi className="h-5 w-5 text-accent" />
                        <span className="font-semibold text-sm">Online</span>
                    </>
                )
            ) : (
                <>
                    <WifiOff className="h-5 w-5 text-destructive" />
                    <span className="font-semibold text-sm">Offline</span>
                </>
            )}
        </div>
    </div>
  );

  return (
    <AppContext.Provider value={{ 
        ...state,
        ...liveData,
        user: state.user, // Use the state's user object
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
        closeInitialBalanceDialog,
        loadRecycleBinData, // Expose this to be used by the recycle bin tab
    }}>
      <OnlineStatusIndicator />
      {children}
    </AppContext.Provider>
  );
}

function useLiveDBData() {
    // Note: appState.user is used for initial load, but the context's own state.user is the primary one after that.
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
        user: appState?.user ?? null, // This is mainly for the initial check
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
