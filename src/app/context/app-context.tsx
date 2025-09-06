
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import type { User, CashTransaction, BankTransaction, StockItem, StockTransaction, Contact, LedgerTransaction, Bank, Category, MonthlySnapshot, Loan, LoanPayment } from '@/lib/types';
import { toast } from 'sonner';
import { useRouter, usePathname } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, bulkPut } from '@/lib/db';
import { WifiOff, RefreshCw } from 'lucide-react';
import { AppLoading } from '@/components/app-loading';
import { useSessionManager } from './useSessionManager';
import { useDataSyncer } from './useDataSyncer';
import { useBalanceCalculator } from './useBalanceCalculator';
import * as server from '@/lib/actions';
import { getSession as getSessionFromCookie } from '@/app/auth/actions';


type FontSize = 'sm' | 'base' | 'lg';

interface AppData {
  // From useBalanceCalculator
  cashBalance: number;
  bankBalance: number;
  stockItems: StockItem[] | undefined;
  totalPayables: number;
  totalReceivables: number;
  // From useSessionManager
  isLoading: boolean;
  isOnline: boolean;
  user: User | null;
  isInitialLoadComplete: boolean;
  isLoggingOut: boolean;
  isAuthenticating: boolean;
  // From useDataSyncer
  isSyncing: boolean;
  syncQueueCount: number;
  // Local State
  isInitialBalanceDialogOpen: boolean;
  fontSize: FontSize;
  currency: string;
  wastagePercentage: number;
  showStockValue: boolean;
  cashTransactions: CashTransaction[];
  bankTransactions: BankTransaction[];
  stockTransactions: StockTransaction[];
  ledgerTransactions: LedgerTransaction[];
  loans: Loan[];
  loanPayments: LoanPayment[];
  cashCategories: Category[];
  bankCategories: Category[];
  contacts: Contact[];
  banks: Bank[];
  loadedMonths: Record<string, boolean>;
}

interface AppContextType extends AppData {
  login: (credentials: Parameters<typeof server.login>[0]) => Promise<any>;
  logout: () => Promise<void>;
  reloadData: (options?: { force?: boolean; needsInitialBalance?: boolean }) => Promise<void>;
  updateBalances: () => Promise<void>;
  handleApiError: (error: unknown) => void;
  processSyncQueue: (specificItemId?: number) => Promise<void>;
  openInitialBalanceDialog: () => void;
  closeInitialBalanceDialog: () => void;
  setLoadedMonths: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setUser: (user: User | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [hasMounted, setHasMounted] = useState(false);

    const {
        user, setUser, isAuthenticating, isLoading, setIsLoading, isLoggingOut, isOnline,
        isInitialLoadComplete, setIsInitialLoadComplete, login, logout, handleApiError,
        setIsOnline
    } = useSessionManager();

    const { isSyncing, syncQueueCount, processSyncQueue } = useDataSyncer();
    const { cashBalance, bankBalance, stockItems: calculatedStockItems, totalPayables, totalReceivables, updateBalances } = useBalanceCalculator();
    
    const [loadedMonths, setLoadedMonths] = useState<Record<string, boolean>>({});
    const [isInitialBalanceDialogOpen, setIsInitialBalanceDialogOpen] = useState(false);
    
    // Live Queries for UI data
    const liveData = useLiveDBData();

    const reloadData = useCallback(async (options?: { force?: boolean, needsInitialBalance?: boolean }) => {
        setIsLoading(true);
        try {
            const session = await getSessionFromCookie();
            if (!session) {
                setIsLoading(false);
                setUser(null);
                await db.app_state.update(1, { user: null });
                return;
            }

            setUser(session);

            const localUser = await db.app_state.get(1);
            if (!localUser || !localUser.user || localUser.user.id !== session.id || options?.force) {
                await db.app_state.put({
                    id: 1, user: session, fontSize: 'base', currency: 'BDT',
                    wastagePercentage: 0, showStockValue: false, lastSync: null
                });
                
                const [categoriesRes, contactsData, banksData, cashTxs, bankTxs, stockTxs, ledgerData, ledgerPaymentsData, snapshotsData, initialStockData, loansData, loanPaymentsData] = await Promise.all([
                    server.readData({ tableName: 'categories', select: '*' }),
                    server.readData({ tableName: 'contacts', select: '*' }),
                    server.readData({ tableName: 'banks', select: '*' }),
                    server.readData({ tableName: 'cash_transactions', select: '*' }),
                    server.readData({ tableName: 'bank_transactions', select: '*' }),
                    server.readData({ tableName: 'stock_transactions', select: '*' }),
                    server.readData({ tableName: 'ap_ar_transactions', select: '*' }),
                    server.readData({ tableName: 'ledger_payments', select: '*' }),
                    server.readData({ tableName: 'monthly_snapshots', select: '*' }),
                    server.readData({ tableName: 'initial_stock', select: '*' }),
                    server.readData({ tableName: 'loans', select: '*' }),
                    server.readData({ tableName: 'loan_payments', select: '*' }),
                ]);

                const categoriesData: Category[] = (Array.isArray(categoriesRes) ? categoriesRes : []) as Category[];
                
                const ledgerTxsWithPayments = (ledgerData || []).map((tx: any) => ({
                    ...tx,
                    installments: (ledgerPaymentsData || []).filter((ins: any) => ins.ap_ar_transaction_id === tx.id)
                }));
                
                 const loansWithPayments = (loansData || []).map((loan: any) => ({
                    ...loan,
                    payments: (loanPaymentsData || []).filter((p: any) => p.loan_id === loan.id)
                }));
                
                const essentialCategories = [
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

                for (const cat of essentialCategories) {
                    const exists = categoriesData.some((c) => c.name === cat.name && c.type === cat.type);
                    if (!exists) {
                        const newCat = await server.appendData({ tableName: 'categories', data: cat, select: '*' });
                        if (newCat) {
                            categoriesData.push(newCat as Category);
                        }
                    }
                }

                await db.transaction('rw', db.tables, async () => {
                    await bulkPut('categories', categoriesData); await bulkPut('contacts', contactsData);
                    await bulkPut('banks', banksData);
                    await bulkPut('cash_transactions', cashTxs); await bulkPut('bank_transactions', bankTxs);
                    await bulkPut('stock_transactions', stockTxs); await bulkPut('ap_ar_transactions', ledgerTxsWithPayments);
                    await bulkPut('ledger_payments', ledgerPaymentsData);
                    await bulkPut('monthly_snapshots', snapshotsData); await bulkPut('initial_stock', initialStockData);
                    await bulkPut('loans', loansWithPayments); await bulkPut('loan_payments', loanPaymentsData);
                    await db.app_state.update(1, { lastSync: new Date().toISOString() });
                });
            }

            await updateBalances();
            processSyncQueue();

        } catch (error: any) {
            handleApiError(error);
        } finally {
            setIsLoading(false);
        }
    }, [handleApiError, setIsLoading, setUser, updateBalances, processSyncQueue]);

    useEffect(() => {
        const checkSessionAndLoad = async () => {
            setIsLoading(true);
            const session = await getSessionFromCookie();
            if (session) {
                setUser(session);
                const localUser = await db.app_state.get(1);
                if (localUser?.user?.id === session.id) {
                    // User is the same, no full reload needed, just ensure balances are good.
                    await updateBalances();
                    setIsLoading(false);
                } else {
                    // New user or forced reload, trigger full data load.
                    await reloadData();
                }
            } else {
                setUser(null);
                setIsLoading(false);
            }
            setIsInitialLoadComplete(true);
        };
        checkSessionAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only run once on mount

    useEffect(() => { setHasMounted(true); }, []);

    useEffect(() => {
        if (!hasMounted) return;
    
        const handleOnline = () => {
            setIsOnline(true);
            toast.success("You are back online!");
            processSyncQueue();
        };
    
        const handleOffline = () => setIsOnline(false);
    
        setIsOnline(navigator.onLine);
    
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
    
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [hasMounted, processSyncQueue, setIsOnline]);
    
    useEffect(() => {
        if (isLoading || !isInitialLoadComplete) return;
        const onLoginPage = pathname === '/login';
        if (user && onLoginPage) {
            router.replace('/');
        } else if (!user && !onLoginPage) {
            router.replace('/login');
        }
    }, [user, isLoading, pathname, router, isInitialLoadComplete]);


    const openInitialBalanceDialog = () => setIsInitialBalanceDialogOpen(true);
    const closeInitialBalanceDialog = () => setIsInitialBalanceDialogOpen(false);

    const OnlineStatusIndicator = () => {
        if (!hasMounted || isOnline) return null;
    
        return (
            <div className="fixed bottom-4 right-4 z-50 animate-fade-in">
                <div className="flex items-center gap-2 rounded-full bg-background px-3 py-2 text-foreground shadow-lg border">
                    {isSyncing ? (
                        <><RefreshCw className="h-5 w-5 animate-spin" /><span className="font-semibold text-sm">Syncing...</span></>
                    ) : (
                        <><WifiOff className="h-5 w-5 text-destructive" /><span className="font-semibold text-sm">Offline</span></>
                    )}
                </div>
            </div>
        );
    };
    
    const contextValue = useMemo(() => ({
        // State
        cashBalance, bankBalance, stockItems: calculatedStockItems, totalPayables, totalReceivables,
        isLoading, isOnline, user, isInitialLoadComplete, isLoggingOut, isAuthenticating,
        isSyncing, syncQueueCount, isInitialBalanceDialogOpen,
        // Live Data
        ...liveData,
        // Misc
        loadedMonths,
        // Setters & Functions
        setLoadedMonths,
        login, logout, reloadData, updateBalances, handleApiError,
        processSyncQueue, openInitialBalanceDialog, closeInitialBalanceDialog,
        setUser,
    }), [
        cashBalance, bankBalance, calculatedStockItems, totalPayables, totalReceivables,
        isLoading, isOnline, user, isInitialLoadComplete, isLoggingOut, isAuthenticating,
        isSyncing, syncQueueCount, isInitialBalanceDialogOpen, liveData,
        loadedMonths, login, logout, reloadData, updateBalances, handleApiError,
        processSyncQueue, setUser
    ]);

    return (
        <AppContext.Provider value={contextValue}>
            <OnlineStatusIndicator />
            {isLoading && !isInitialLoadComplete ? <AppLoading /> : children}
        </AppContext.Provider>
    );
}

function useLiveDBData() {
    const appState = useLiveQuery(() => db.app_state.get(1), []);
    const cashTransactions = useLiveQuery(() => db.cash_transactions.toArray(), []);
    const bankTransactions = useLiveQuery(() => db.bank_transactions.toArray(), []);
    const stockTransactions = useLiveQuery(() => db.stock_transactions.toArray(), []);
    const ledgerTransactions = useLiveQuery(() => db.ap_ar_transactions.orderBy('date').reverse().toArray(), []);
    const loans = useLiveQuery(() => db.loans.toArray(), []);
    const loanPayments = useLiveQuery(() => db.loan_payments.toArray(), []);
    const banks = useLiveQuery(() => db.banks.toArray(), []);
    const categories = useLiveQuery(() => db.categories.toArray(), []);
    const contacts = useLiveQuery(() => db.contacts.toArray(), []);
    const initialStock = useLiveQuery(() => db.initial_stock.toArray(), []);


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
        fontSize: appState?.fontSize ?? 'base',
        currency: appState?.currency ?? 'BDT',
        wastagePercentage: appState?.wastagePercentage ?? 0,
        showStockValue: appState?.showStockValue ?? false,
        cashTransactions: cashTransactions || [],
        bankTransactions: bankTransactions || [],
        stockTransactions: stockTransactions || [],
        ledgerTransactions: ledgerTransactions || [],
        loans: loans || [],
        loanPayments: loanPayments || [],
        initialStock: initialStock || [],
        cashCategories,
        bankCategories,
        contacts: contacts || [],
        banks: banks || [],
    };
}

export function useAppContext() {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
}

    
