
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import type { User, Bank, Category, MonthlySnapshot, Contact, LedgerTransaction, Loan, LoanPayment, StockItem, CashTransaction, BankTransaction, ActivityLog, StockTransaction as AppStockTransaction } from '@/lib/types';
import { toast } from 'sonner';
import { useRouter, usePathname } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, bulkPut, clearAllData } from '@/lib/db';
import { WifiOff, RefreshCw } from 'lucide-react';
import { AppLoading } from '@/components/app-loading';
import { useSessionManager } from './useSessionManager';
import { useDataSyncer } from './useDataSyncer';
import * as server from '@/lib/actions';
import { getSession as getSessionFromCookie, login as serverLogin } from '@/app/auth/actions';
import { AppOverlay } from '@/components/app-overlay';

type BlockingOperation = {
    isActive: boolean;
    message: string;
};

type FontSize = 'sm' | 'base' | 'lg';

interface AppData {
  // Global State
  isLoading: boolean;
  isOnline: boolean;
  user: User | null;
  // From useSessionManager
  isLoggingOut: boolean;
  isAuthenticating: boolean;
  // From useDataSyncer
  isSyncing: boolean;
  syncQueueCount: number;
  // Local State
  isInitialBalanceDialogOpen: boolean;
  fontSize: FontSize;
  currency: string;
  showStockValue: boolean;
  banks: Bank[];
  cashCategories: Category[];
  bankCategories: Category[];
  contacts: Contact[];
  blockingOperation: BlockingOperation;
  loans: Loan[];
  loanPayments: LoanPayment[];
  stockItems: StockItem[];
  cashTransactions: CashTransaction[];
  bankTransactions: BankTransaction[];
  stockTransactions: AppStockTransaction[];
  activityLog: ActivityLog[];
  // Calculated state
  currentStockWeight: number;
  currentStockValue: number;
  currentStockItems: any[];
}

interface AppContextType extends AppData {
  login: (credentials: Parameters<typeof serverLogin>[0]) => Promise<any>;
  logout: () => Promise<void>;
  reloadData: (options?: { force?: boolean; needsInitialBalance?: boolean }) => Promise<void>;
  handleApiError: (error: unknown) => void;
  processSyncQueue: (specificItemId?: number) => Promise<void>;
  openInitialBalanceDialog: () => void;
  closeInitialBalanceDialog: () => void;
  setUser: (user: User | null) => void;
  setBlockingOperation: (op: BlockingOperation) => void;
  queueOrSync: (item: Omit<import('@/lib/db').SyncQueueItem, 'id' | 'timestamp'>) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const essentialCategories: Omit<Category, 'id'>[] = [
    { name: 'Cash In', type: 'cash', direction: 'credit', is_deletable: false },
    { name: 'Cash Out', type: 'cash', direction: 'debit', is_deletable: false },
    { name: 'Deposit', type: 'bank', direction: 'credit', is_deletable: false },
    { name: 'Withdrawal', type: 'bank', direction: 'debit', is_deletable: false },
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
    { name: 'Advance Payment', type: 'cash', direction: 'debit', is_deletable: false },
    { name: 'Advance Received', type: 'cash', direction: 'credit', is_deletable: false },
    { name: 'Advance Payment', type: 'bank', direction: 'debit', is_deletable: false },
    { name: 'Advance Received', type: 'bank', direction: 'credit', is_deletable: false },
    { name: 'Loan In', type: 'cash', direction: 'credit', is_deletable: false },
    { name: 'Loan Out', type: 'cash', direction: 'debit', is_deletable: false },
    { name: 'Loan In', type: 'bank', direction: 'credit', is_deletable: false },
    { name: 'Loan Out', type: 'bank', direction: 'debit', is_deletable: false },
    { name: 'Loan Payment', type: 'cash', direction: null, is_deletable: false },
    { name: 'Loan Payment', type: 'bank', direction: null, is_deletable: false },
];

function isCategory(obj: any): obj is Category {
    return (
        obj &&
        typeof obj === 'object' &&
        'id' in obj &&
        'name' in obj &&
        'type' in obj &&
        'direction' in obj &&
        'is_deletable' in obj
    );
}

export function AppProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [blockingOperation, setBlockingOperation] = useState<BlockingOperation>({ isActive: false, message: '' });
    const [isLoading, setIsLoading] = useState(true);

    const {
        user, setUser, isAuthenticating, isLoggingOut, isOnline,
        login, logout, handleApiError, setIsOnline
    } = useSessionManager();

    const { isSyncing, syncQueueCount, processSyncQueue, queueOrSync } = useDataSyncer();
    
    const [isInitialBalanceDialogOpen, setIsInitialBalanceDialogOpen] = useState(false);
    
    const appState = useLiveQuery(() => db.app_state.get(1), []);
    const banks = useLiveQuery(() => db.banks.toArray(), []);
    const allCategories = useLiveQuery(() => db.categories.toArray(), []);
    const contacts = useLiveQuery(() => db.contacts.toArray(), []);
    const loans = useLiveQuery(() => db.loans.toArray(), []);
    const loanPayments = useLiveQuery(() => db.loan_payments.toArray(), []);
    const stockItems = useLiveQuery(() => db.initial_stock.toArray(), []);
    const cashTransactions = useLiveQuery(() => db.cash_transactions.toArray(), []);
    const bankTransactions = useLiveQuery(() => db.bank_transactions.toArray(), []);
    const stockTransactions = useLiveQuery(() => db.stock_transactions.toArray(), []);
    const activityLog = useLiveQuery(() => db.activity_log.toArray(), []);

    const { cashCategories, bankCategories } = useMemo(() => {
        const dbCash: Category[] = [];
        const dbBank: Category[] = [];
        (allCategories || []).forEach(c => {
            if (c.type === 'cash') dbCash.push(c);
            else if (c.type === 'bank') dbBank.push(c);
        });
        return { cashCategories: dbCash, bankCategories: dbBank };
    }, [allCategories]);

    const { currentStockWeight, currentStockValue, currentStockItems } = useMemo(() => {
        if (!stockItems || !stockTransactions) return { currentStockWeight: 0, currentStockValue: 0, currentStockItems: [] };
        
        const portfolio: Record<string, { weight: number, totalValue: number, purchaseCount: number }> = {};
        
        stockItems.forEach(item => {
            if (!portfolio[item.name]) {
                portfolio[item.name] = { weight: 0, totalValue: 0, purchaseCount: 0 };
            }
            portfolio[item.name].weight += item.weight;
            portfolio[item.name].totalValue += item.weight * item.purchasePricePerKg;
            if (item.weight > 0) portfolio[item.name].purchaseCount++;
        });
  
        const allTransactions = [...stockTransactions].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
        allTransactions.forEach(tx => {
            if (!portfolio[tx.stockItemName]) {
                portfolio[tx.stockItemName] = { weight: 0, totalValue: 0, purchaseCount: 0 };
            }
            
            const item = portfolio[tx.stockItemName];
            const currentAvgPrice = (item.totalValue > 0 && item.weight > 0) ? item.totalValue / item.weight : 0;
  
            if (tx.type === 'purchase') {
                item.weight += tx.weight;
                item.totalValue += tx.weight * tx.pricePerKg;
                item.purchaseCount++;
            } else { // Sale
                item.weight -= tx.weight;
                item.totalValue -= tx.weight * currentAvgPrice;
            }
        });
        
        let totalWeight = 0;
        let totalValue = 0;
        const portfolioArray = Object.entries(portfolio).map(([name, data]) => {
            totalWeight += data.weight;
            totalValue += data.totalValue;
            return {
                name,
                weight: data.weight,
                totalValue: data.totalValue,
                avgPrice: data.weight > 0 ? data.totalValue / data.weight : 0,
            };
        });
        
        return {
          currentStockWeight: totalWeight,
          currentStockValue: totalValue,
          currentStockItems: portfolioArray.filter(item => item.weight > 0)
        };
      }, [stockItems, stockTransactions]);

    const seedEssentialCategories = useCallback(async (existingCategories: Category[]): Promise<Category[]> => {
        let finalCategories = [...existingCategories];
        const categoriesToCreate = essentialCategories.filter(essentialCat => 
            !existingCategories.some(existingCat => 
                existingCat.name === essentialCat.name && existingCat.type === essentialCat.type
            )
        );

        if (categoriesToCreate.length > 0) {
            console.log(`Seeding ${categoriesToCreate.length} essential categories...`);
            try {
                const creationPromises = categoriesToCreate.map(cat => 
                    server.appendData({ tableName: 'categories', data: cat, select: '*' })
                );
                const newCategories = await Promise.all(creationPromises);
                newCategories.forEach(newCat => {
                    if (isCategory(newCat)) {
                         finalCategories.push(newCat);
                    }
                });
            } catch(e) {
                console.error("Failed to seed essential categories", e);
                handleApiError(e);
            }
        }
        return finalCategories;
    }, [handleApiError]);

    const reloadData = useCallback(async (options?: { force?: boolean, needsInitialBalance?: boolean }) => {
        if (isSyncing && !options?.force) {
            toast.info("Sync in progress. Data will load shortly.");
            return;
        }
        
        try {
            const session = await getSessionFromCookie();
            if (!session) {
                setUser(null);
                return;
            }
            
            if(!user || user.id !== session.id) {
                setUser(session);
            }
            
            setBlockingOperation({ isActive: true, message: 'Fetching latest data...' });
            const serverData = await server.batchReadData({
                tables: [
                    { tableName: 'categories' }, { tableName: 'contacts' },
                    { tableName: 'banks' }, { tableName: 'cash_transactions' },
                    { tableName: 'bank_transactions' }, { tableName: 'stock_transactions' },
                    { tableName: 'ap_ar_transactions' }, { tableName: 'ledger_payments' },
                    { tableName: 'monthly_snapshots' }, { tableName: 'initial_stock' },
                    { tableName: 'loans' }, { tableName: 'loan_payments' },
                    { tableName: 'activity_log' },
                ]
            });

            const categoriesData = await seedEssentialCategories(serverData.categories as Category[]);
            
            setBlockingOperation({ isActive: true, message: 'Organizing your data...' });
            await db.transaction('rw', db.tables, async () => {
                await clearAllData(false);
                await db.app_state.put({ id: 1, user: session, fontSize: appState?.fontSize ?? 'base', currency: appState?.currency ?? 'BDT', showStockValue: appState?.showStockValue ?? false, lastSync: null });
                await bulkPut('categories', categoriesData); await bulkPut('contacts', serverData.contacts);
                await bulkPut('banks', serverData.banks);
                await bulkPut('cash_transactions', serverData.cash_transactions); await bulkPut('bank_transactions', serverData.bank_transactions);
                await bulkPut('stock_transactions', serverData.stock_transactions); await bulkPut('ap_ar_transactions', serverData.ap_ar_transactions);
                await bulkPut('ledger_payments', serverData.ledger_payments);
                await bulkPut('monthly_snapshots', serverData.monthly_snapshots); await bulkPut('initial_stock', serverData.initial_stock);
                await bulkPut('loans', serverData.loans); await bulkPut('loan_payments', serverData.loan_payments);
                await bulkPut('activity_log', serverData.activity_log);
                await db.app_state.update(1, { lastSync: new Date().toISOString() });
            });

            if (options?.needsInitialBalance) {
                setIsInitialBalanceDialogOpen(true);
            }
            
            processSyncQueue();
        } catch (error: any) {
            handleApiError(error);
        } finally {
            setBlockingOperation({ isActive: false, message: '' });
        }
    }, [isSyncing, user, setUser, seedEssentialCategories, appState, processSyncQueue, handleApiError]);


    const checkSessionAndLoad = useCallback(async () => {
        setBlockingOperation({ isActive: true, message: 'Verifying your session...' });
        try {
            const session = await getSessionFromCookie();
            if (session) {
                if(!user || user.id !== session.id) {
                    setUser(session);
                }
                await reloadData();
            } else {
                setUser(null);
            }
        } catch (error) {
            console.error("Error during initial session check:", error);
            setUser(null);
            handleApiError(error);
        } finally {
            setIsLoading(false);
            setBlockingOperation({ isActive: false, message: '' });
        }
    }, [user, setUser, reloadData, handleApiError]);


    useEffect(() => {
        if (isLoading) {
          checkSessionAndLoad();
        }
    }, [isLoading, checkSessionAndLoad]);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            toast.success("You are back online!");
            processSyncQueue();
        };
        const handleOffline = () => setIsOnline(false);
        
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        
        handleOffline();
        if (navigator.onLine) handleOnline();

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [processSyncQueue, setIsOnline]);
    
    useEffect(() => {
        if (isLoading) return;
        const onLoginPage = pathname === '/login';
        if (user && onLoginPage) {
            router.replace('/');
        } else if (!user && !onLoginPage) {
            router.replace('/login');
        }
    }, [user, isLoading, pathname, router]);


    const openInitialBalanceDialog = useCallback(() => setIsInitialBalanceDialogOpen(true), []);
    const closeInitialBalanceDialog = useCallback(() => setIsInitialBalanceDialogOpen(false), []);

    const OnlineStatusIndicator = () => (
      <>
        {!isOnline && (
            <div className="fixed bottom-4 right-4 z-50 animate-fade-in">
                <div className="flex items-center gap-2 rounded-full bg-background px-3 py-2 text-foreground shadow-lg border">
                    {isSyncing ? (
                        <><RefreshCw className="h-5 w-5 animate-spin" /><span className="font-semibold text-sm">Syncing...</span></>
                    ) : (
                        <><WifiOff className="h-5 w-5 text-destructive" /><span className="font-semibold text-sm">Offline</span></>
                    )}
                </div>
            </div>
        )}
      </>
    );
    
    const contextValue = useMemo(() => ({
        isLoading, isOnline, user, isAuthenticating, isLoggingOut,
        isSyncing, syncQueueCount, isInitialBalanceDialogOpen, blockingOperation,
        fontSize: appState?.fontSize ?? 'base',
        currency: appState?.currency ?? 'BDT',
        showStockValue: appState?.showStockValue ?? false,
        banks: banks || [],
        cashCategories: cashCategories || [],
        bankCategories: bankCategories || [],
        contacts: contacts || [],
        loans: loans || [],
        loanPayments: loanPayments || [],
        stockItems: stockItems || [],
        cashTransactions: cashTransactions || [],
        bankTransactions: bankTransactions || [],
        stockTransactions: stockTransactions || [],
        activityLog: activityLog || [],
        currentStockWeight,
        currentStockValue,
        currentStockItems,
        login: async (credentials) => {
            const result = await login(credentials);
            if (result.success) {
                setIsLoading(true); // Trigger reload
            }
            return result;
        },
        logout, reloadData, handleApiError,
        processSyncQueue, openInitialBalanceDialog, closeInitialBalanceDialog,
        setUser, setBlockingOperation, queueOrSync,
    }), [
        isLoading, isOnline, user, isAuthenticating, isLoggingOut,
        isSyncing, syncQueueCount, isInitialBalanceDialogOpen, blockingOperation,
        appState, banks, cashCategories, bankCategories, contacts, loans, loanPayments, stockItems, cashTransactions, bankTransactions, stockTransactions, activityLog,
        currentStockWeight, currentStockValue, currentStockItems,
        login, logout, reloadData, handleApiError,
        processSyncQueue, openInitialBalanceDialog, closeInitialBalanceDialog, setUser, setBlockingOperation, queueOrSync
    ]);
    
    if (isLoading) {
        return <AppLoading message={blockingOperation.message || undefined} />;
    }
    
    if (isLoggingOut || (blockingOperation.isActive && !isLoading)) {
        return <AppOverlay message={blockingOperation.message || "Logging out..."} />;
    }

    return (
        <AppContext.Provider value={contextValue}>
            <OnlineStatusIndicator />
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
