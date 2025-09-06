"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import type { User, Bank, Category, MonthlySnapshot, Contact, LedgerTransaction, Loan, LoanPayment, StockItem, CashTransaction, BankTransaction } from '@/lib/types';
import { toast } from 'sonner';
import { useRouter, usePathname } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, bulkPut } from '@/lib/db';
import { WifiOff, RefreshCw } from 'lucide-react';
import { AppLoading } from '@/components/app-loading';
import { useSessionManager } from './useSessionManager';
import { useDataSyncer } from './useDataSyncer';
import * as server from '@/lib/actions';
import { getSession as getSessionFromCookie } from '@/app/auth/actions';

type BlockingOperation = {
    isActive: boolean;
    message: string;
};

type FontSize = 'sm' | 'base' | 'lg';

interface AppData {
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
  showStockValue: boolean;
  banks: Bank[];
  cashCategories: Category[];
  bankCategories: Category[];
  contacts: Contact[];
  ledgerTransactions: LedgerTransaction[];
  loans: Loan[];
  loanPayments: LoanPayment[];
  stockItems: StockItem[];
  cashTransactions: CashTransaction[];
  bankTransactions: BankTransaction[];
  blockingOperation: BlockingOperation;
}

interface AppContextType extends AppData {
  login: (credentials: Parameters<typeof server.login>[0]) => Promise<any>;
  logout: () => Promise<void>;
  reloadData: (options?: { force?: boolean; needsInitialBalance?: boolean }) => Promise<void>;
  handleApiError: (error: unknown) => void;
  processSyncQueue: (specificItemId?: number) => Promise<void>;
  openInitialBalanceDialog: () => void;
  closeInitialBalanceDialog: () => void;
  setUser: (user: User | null) => void;
  setBlockingOperation: (op: BlockingOperation) => void;
  queueOrSync: (item: import('@/lib/db').SyncQueueItem) => Promise<void>;
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


export function AppProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [hasMounted, setHasMounted] = useState(false);
    const [blockingOperation, setBlockingOperation] = useState<BlockingOperation>({ isActive: false, message: '' });

    const {
        user, setUser, isAuthenticating, isLoading, setIsLoading, isLoggingOut, isOnline,
        isInitialLoadComplete, setIsInitialLoadComplete, login, logout, handleApiError,
        setIsOnline
    } = useSessionManager();

    const { isSyncing, syncQueueCount, processSyncQueue, queueOrSync } = useDataSyncer();
    
    const [isInitialBalanceDialogOpen, setIsInitialBalanceDialogOpen] = useState(false);
    
    // Global data that is small and safe to query live
    const appState = useLiveQuery(() => db.app_state.get(1), []);
    const banks = useLiveQuery(() => db.banks.toArray(), []);
    const allCategories = useLiveQuery(() => db.categories.toArray(), []);
    const contacts = useLiveQuery(() => db.contacts.toArray(), []);
    const ledgerTransactions = useLiveQuery(() => db.ap_ar_transactions.toArray(), []);
    const loans = useLiveQuery(() => db.loans.toArray(), []);
    const loanPayments = useLiveQuery(() => db.loan_payments.toArray(), []);
    const stockItems = useLiveQuery(() => db.initial_stock.toArray(), []);
    const cashTransactions = useLiveQuery(() => db.cash_transactions.toArray(), []);
    const bankTransactions = useLiveQuery(() => db.bank_transactions.toArray(), []);


    const { cashCategories, bankCategories } = useMemo(() => {
        const dbCash: Category[] = [];
        const dbBank: Category[] = [];
        (allCategories || []).forEach(c => {
            if (c.type === 'cash') dbCash.push(c);
            else if (c.type === 'bank') dbBank.push(c);
        });
        return { cashCategories: dbCash, bankCategories: dbBank };
    }, [allCategories]);

    const seedEssentialCategories = useCallback(async (existingCategories: Category[]): Promise<Category[]> => {
        let finalCategories = [...existingCategories];
        const categoriesToCreate = essentialCategories.filter(essentialCat => 
            !existingCategories.some(existingCat => 
                existingCat.name === essentialCat.name && existingCat.type === essentialCat.type
            )
        );

        if (categoriesToCreate.length > 0) {
            console.log(`Seeding ${categoriesToCreate.length} essential categories...`);
            // This is the key fix: use Promise.all to await the resolution of all creation promises.
            const creationPromises = categoriesToCreate.map(cat => 
                server.appendData({ tableName: 'categories', data: cat, select: '*' })
            );
            const newCategories = await Promise.all(creationPromises);
            newCategories.forEach(newCat => {
                if (newCat) finalCategories.push(newCat as Category);
            });
        }
        return finalCategories;
    }, []);

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
                    showStockValue: false, lastSync: null
                });
                
                let [categoriesData, ...otherData] = await Promise.all([
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
                
                categoriesData = await seedEssentialCategories(categoriesData || []);

                const [contactsData, banksData, cashTxs, bankTxs, stockTxs, ledgerData, ledgerPaymentsData, snapshotsData, initialStockData, loansData, loanPaymentsData] = otherData;

                const ledgerTxsWithPayments = (ledgerData || []).map((tx: any) => ({
                    ...tx,
                    installments: (ledgerPaymentsData || []).filter((ins: any) => ins.ap_ar_transaction_id === tx.id)
                }));
                 const loansWithPayments = (loansData || []).map((loan: any) => ({
                    ...loan,
                    payments: (loanPaymentsData || []).filter((p: any) => p.loan_id === loan.id)
                }));
                
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
            processSyncQueue();
        } catch (error: any) {
            handleApiError(error);
        } finally {
            setIsLoading(false);
        }
    }, [handleApiError, setIsLoading, setUser, processSyncQueue, seedEssentialCategories]);

    useEffect(() => {
        const checkSessionAndLoad = async () => {
            setIsLoading(true);
            const session = await getSessionFromCookie();
            if (session) {
                setUser(session);
                const localUser = await db.app_state.get(1);
                if (localUser?.user?.id === session.id && !localUser.lastSync) {
                     await reloadData({ force: true });
                } else if(localUser?.user?.id !== session.id) {
                    await reloadData({ force: true });
                }
            } else {
                setUser(null);
            }
            setIsInitialLoadComplete(true);
            setIsLoading(false);
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
        isLoading, isOnline, user, isInitialLoadComplete, isLoggingOut, isAuthenticating,
        isSyncing, syncQueueCount, isInitialBalanceDialogOpen, blockingOperation,
        // Live Data
        fontSize: appState?.fontSize ?? 'base',
        currency: appState?.currency ?? 'BDT',
        showStockValue: appState?.showStockValue ?? false,
        banks: banks || [],
        cashCategories: cashCategories || [],
        bankCategories: bankCategories || [],
        contacts: contacts || [],
        ledgerTransactions: ledgerTransactions || [],
        loans: loans || [],
        loanPayments: loanPayments || [],
        stockItems: stockItems || [],
        cashTransactions: cashTransactions || [],
        bankTransactions: bankTransactions || [],
        // Functions
        login, logout, reloadData, handleApiError,
        processSyncQueue, openInitialBalanceDialog, closeInitialBalanceDialog,
        setUser, setBlockingOperation, queueOrSync,
    }), [
        isLoading, isOnline, user, isInitialLoadComplete, isLoggingOut, isAuthenticating,
        isSyncing, syncQueueCount, isInitialBalanceDialogOpen, blockingOperation,
        appState, banks, cashCategories, bankCategories,
        login, logout, reloadData, handleApiError,
        processSyncQueue, setUser, queueOrSync,
        contacts, ledgerTransactions, loans, loanPayments, stockItems, cashTransactions, bankTransactions
    ]);

    return (
        <AppContext.Provider value={contextValue}>
            <OnlineStatusIndicator />
            {isLoading && !isInitialLoadComplete ? <AppLoading /> : children}
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
