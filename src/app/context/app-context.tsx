
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import type { User, CashTransaction, BankTransaction, StockItem, StockTransaction, Contact, LedgerTransaction, Bank, Category, MonthlySnapshot, Loan, LoanPayment } from '@/lib/types';
import { toast } from 'sonner';
import { useRouter, usePathname } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';
import { AppLoading } from '@/components/app-loading';
import { useSessionManager } from './useSessionManager';
import { useDataSyncer } from './useDataSyncer';
import { useBalanceCalculator } from './useBalanceCalculator';
import * as server from '@/lib/actions';

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
  deletedCashTransactions: CashTransaction[];
  deletedBankTransactions: BankTransaction[];
  deletedStockTransactions: StockTransaction[];
  deletedLedgerTransactions: LedgerTransaction[];
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
  loadRecycleBinData: () => Promise<void>;
  setLoadedMonths: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setDeletedItems: React.Dispatch<React.SetStateAction<{ cash: any[]; bank: any[]; stock: any[]; ap_ar: any[]; }>>;
  setUser: (user: User | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [hasMounted, setHasMounted] = useState(false);

    const {
        user, setUser, isAuthenticating, isLoading, isLoggingOut, isOnline,
        isInitialLoadComplete, login, logout, reloadData, handleApiError,
        setIsOnline
    } = useSessionManager();

    const { isSyncing, syncQueueCount, processSyncQueue } = useDataSyncer();
    const { cashBalance, bankBalance, stockItems: calculatedStockItems, totalPayables, totalReceivables, updateBalances } = useBalanceCalculator();
    
    const [deletedItems, setDeletedItems] = useState<{ cash: any[], bank: any[], stock: any[], ap_ar: any[] }>({ cash: [], bank: [], stock: [], ap_ar: [] });
    const [loadedMonths, setLoadedMonths] = useState<Record<string, boolean>>({});
    const [isInitialBalanceDialogOpen, setIsInitialBalanceDialogOpen] = useState(false);
    
    // Live Queries for UI data
    const liveData = useLiveDBData();

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


    const loadRecycleBinData = useCallback(async () => {
        if (isOnline) {
            try {
                const [cash, bank, stock, ap_ar] = await Promise.all([
                    server.readDeletedData({ tableName: 'cash_transactions', select: '*' }),
                    server.readDeletedData({ tableName: 'bank_transactions', select: '*' }),
                    server.readDeletedData({ tableName: 'stock_transactions', select: '*' }),
                    server.readDeletedData({ tableName: 'ap_ar_transactions', select: '*' }),
                ]);
                setDeletedItems({ cash: cash || [], bank: bank || [], stock: stock || [], ap_ar: ap_ar || [] });
            } catch (error) {
                handleApiError(error);
            }
        } else {
            toast.error("Cannot load recycle bin data while offline.");
        }
    }, [handleApiError, isOnline]);

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
        // Deleted Items
        deletedCashTransactions: deletedItems.cash,
        deletedBankTransactions: deletedItems.bank,
        deletedStockTransactions: deletedItems.stock,
        deletedLedgerTransactions: deletedItems.ap_ar,
        // Misc
        loadedMonths,
        // Setters & Functions
        setLoadedMonths,
        setDeletedItems,
        login, logout, reloadData, updateBalances, handleApiError,
        processSyncQueue, openInitialBalanceDialog, closeInitialBalanceDialog,
        loadRecycleBinData, setUser,
    }), [
        cashBalance, bankBalance, calculatedStockItems, totalPayables, totalReceivables,
        isLoading, isOnline, user, isInitialLoadComplete, isLoggingOut, isAuthenticating,
        isSyncing, syncQueueCount, isInitialBalanceDialogOpen, liveData, deletedItems,
        loadedMonths, login, logout, reloadData, updateBalances, handleApiError,
        processSyncQueue, loadRecycleBinData, setUser
    ]);

    return (
        <AppContext.Provider value={contextValue}>
            <OnlineStatusIndicator />
            {children}
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

    