
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import type { User, CashTransaction, BankTransaction, StockItem, StockTransaction, Vendor, Client, LedgerTransaction, Bank, Category, MonthlySnapshot } from '@/lib/types';
import { toast } from 'sonner';
import * as server from '@/lib/actions';
import { getSession, login as serverLogin, logout as serverLogout } from '@/app/auth/actions';
import { useRouter, usePathname } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, bulkPut, clearAllData as clearLocalDb, type SyncQueueItem } from '@/lib/db';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';

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
  login: (credentials: Parameters<typeof serverLogin>[0]) => Promise<any>;
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
    const liveData = useLiveDBData();

    const [state, setState] = useState({
        cashBalance: 0, bankBalance: 0, totalPayables: 0, totalReceivables: 0,
        isLoading: true, isInitialBalanceDialogOpen: false, isSyncing: false,
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    });
    
    const [user, setUser] = useState<User | null>(null);
    const [deletedItems, setDeletedItems] = useState<{ cash: any[], bank: any[], stock: any[], ap_ar: any[] }>({ cash: [], bank: [], stock: [], ap_ar: [] });
    const [loadedMonths, setLoadedMonths] = useState<Record<string, boolean>>({});

    const logout = useCallback(async () => {
        await serverLogout();
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
        const [allCash, allBank, allLedger, allStock, allInitialStock] = await Promise.all([
            db.cash_transactions.toArray(),
            db.bank_transactions.toArray(),
            db.ap_ar_transactions.toArray(),
            db.stock_transactions.toArray(),
            db.initial_stock.toArray(),
        ]);

        const cashBalance = allCash.reduce((acc, tx) => acc + (tx.type === 'income' ? tx.actual_amount : -tx.actual_amount), 0);
        const bankBalance = allBank.reduce((acc, tx) => acc + (tx.type === 'deposit' ? tx.actual_amount : -tx.actual_amount), 0);
        const totalPayables = allLedger.filter(tx => tx.type === 'payable').reduce((acc, tx) => acc + (tx.amount - tx.paid_amount), 0);
        const totalReceivables = allLedger.filter(tx => tx.type === 'receivable').reduce((acc, tx) => acc + (tx.amount - tx.paid_amount), 0);
        
        setState(prev => ({ ...prev, cashBalance, bankBalance, totalPayables, totalReceivables }));
    }, []);

    const processSyncQueue = useCallback(async (specificItemId?: number) => {
        if (state.isSyncing && !specificItemId) return;
        setState(prev => ({ ...prev, isSyncing: true }));

        let queue: SyncQueueItem[] = [];
        if (specificItemId) {
            const item = await db.sync_queue.get(specificItemId);
            if (item) queue.push(item);
        } else {
            queue = await db.sync_queue.orderBy('timestamp').toArray();
        }

        if (queue.length === 0) {
            setState(prev => ({ ...prev, isSyncing: false }));
            return;
        }

        if (!specificItemId) toast.info(`Syncing ${queue.length} items...`);

        let failedItems = 0;
        for (const item of queue) {
            try {
                let result: any;
                const { localId, localFinancialId, localLedgerId, localCashId, localBankId, ...payloadWithoutId } = item.payload || {};

                switch (item.action) {
                    case 'appendData':
                        result = await server.appendData(payloadWithoutId);
                        if (result && result.id && localId) {
                            await db.table(payloadWithoutId.tableName).where({ id: localId }).modify({ id: result.id });
                        }
                        break;
                    case 'updateData': result = await server.updateData(item.payload); break;
                    case 'deleteData': result = await server.deleteData(item.payload); break;
                    case 'restoreData': result = await server.restoreData(item.payload); break;
                    case 'recordPaymentAgainstTotal':
                        result = await server.recordPaymentAgainstTotal(payloadWithoutId);
                        if (result && result.financialTxId && localFinancialId) {
                            if (payloadWithoutId.payment_method === 'cash') {
                                await db.cash_transactions.where({ id: localFinancialId }).modify({ id: result.financialTxId });
                            } else {
                                await db.bank_transactions.where({ id: localFinancialId }).modify({ id: result.financialTxId });
                            }
                        }
                        break;
                    case 'recordDirectPayment': result = await server.recordDirectPayment(item.payload); break;
                    case 'recordAdvancePayment':
                        result = await server.recordAdvancePayment(payloadWithoutId);
                        if (result && result.ledgerEntry && result.financialTx) {
                            await db.transaction('rw', db.ap_ar_transactions, db.cash_transactions, db.bank_transactions, async () => {
                                if (localLedgerId) await db.ap_ar_transactions.where({ id: localLedgerId }).modify({ id: result.ledgerEntry.id });
                                if (result.financialTx.bank_id) {
                                    if (localFinancialId) await db.bank_transactions.where({ id: localFinancialId }).modify({ id: result.financialTx.id, advance_id: result.ledgerEntry.id });
                                } else {
                                    if (localFinancialId) await db.cash_transactions.where({ id: localFinancialId }).modify({ id: result.financialTx.id, advance_id: result.ledgerEntry.id });
                                }
                            });
                        }
                        break;
                    case 'transferFunds':
                        result = await server.transferFunds(payloadWithoutId);
                        if (result && localCashId && localBankId) {
                            await db.cash_transactions.where({ id: localCashId }).modify({ id: result.cashTxId });
                            await db.bank_transactions.where({ id: localBankId }).modify({ id: result.bankTxId });
                        }
                        break;
                    case 'setInitialBalances': result = await server.setInitialBalances(item.payload); break;
                    case 'deleteCategory': result = await server.deleteCategory(item.payload); break;
                    case 'addStockTransaction':
                        result = await server.addStockTransaction(payloadWithoutId);
                        if (result && localId) {
                            await db.stock_transactions.where({ id: localId }).modify({ id: result.stockTx.id });
                            if (result.financialTx) {
                                const finTable = result.financialTx.bank_id ? 'bank_transactions' : 'cash_transactions';
                                await db.table(finTable).where({ linkedStockTxId: localId }).modify({ id: result.financialTx.id, linkedStockTxId: result.stockTx.id });
                            }
                        }
                        break;
                    case 'updateStockTransaction': result = await server.updateStockTransaction(item.payload); break;
                    case 'deleteVendor': result = await server.deleteVendor(item.payload.id); break;
                    case 'deleteClient': result = await server.deleteClient(item.payload.id); break;
                    case 'addInitialStockItem': result = await server.addInitialStockItem(item.payload); break;
                    case 'batchImportData': result = await server.batchImportData(item.payload.data); break;
                    case 'deleteAllData': result = await server.deleteAllData(); break;
                    case 'emptyRecycleBin': result = await server.emptyRecycleBin(); break;
                    default:
                        console.warn(`Unknown sync action: ${item.action}`);
                }

                if (item.id) await db.sync_queue.delete(item.id);

            } catch (error) {
                failedItems++;
                handleApiError(error);
                console.error(`Sync failed for item ${item.id} (${item.action}):`, error);
            }
        }

        if (!specificItemId) {
            if (failedItems > 0) {
                toast.error(`${failedItems} sync operations failed. Check console for details.`);
            } else {
                toast.success("All items synced successfully!");
            }
        }

        setState(prev => ({ ...prev, isSyncing: false }));
    }, [state.isSyncing, handleApiError]);

    const reloadData = useCallback(async (options?: { force?: boolean, needsInitialBalance?: boolean }) => {
        setState(prev => ({ ...prev, isLoading: true }));
        try {
            const session = await getSession();
            if (!session) {
                setState(prev => ({ ...prev, isLoading: false }));
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
                
                const [categoriesData, vendorsData, clientsData, banksData, cashTxs, bankTxs, stockTxs, ledgerData, installmentsData, snapshotsData, initialStockData] = await Promise.all([
                    server.readData({ tableName: 'categories', select: '*' }),
                    server.readData({ tableName: 'vendors', select: '*' }),
                    server.readData({ tableName: 'clients', select: '*' }),
                    server.readData({ tableName: 'banks', select: '*' }),
                    server.readData({ tableName: 'cash_transactions', select: '*' }),
                    server.readData({ tableName: 'bank_transactions', select: '*' }),
                    server.readData({ tableName: 'stock_transactions', select: '*' }),
                    server.readData({ tableName: 'ap_ar_transactions', select: '*' }),
                    server.readData({ tableName: 'payment_installments', select: '*' }),
                    server.readData({ tableName: 'monthly_snapshots', select: '*' }),
                    server.readData({ tableName: 'initial_stock', select: '*' }),
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
                    { name: 'Advance Payment', type: 'cash', direction: 'debit', is_deletable: false },
                    { name: 'Advance Received', type: 'cash', direction: 'credit', is_deletable: false },
                    { name: 'Advance Payment', type: 'bank', direction: 'debit', is_deletable: false },
                    { name: 'Advance Received', type: 'bank', direction: 'credit', is_deletable: false },
                ];

                for (const cat of essentialCategories) {
                    const categories = Array.isArray(categoriesData) ? (categoriesData as unknown as Category[]) : [];
                    const exists = categories.some((c) => c.name === cat.name && c.type === cat.type);
                    if (!exists) {
                        const newCat = await server.appendData({ tableName: 'categories', data: cat, select: '*' });
                        if (newCat && Array.isArray(categoriesData)) {
                            ((categoriesData as unknown) as Category[]).push((newCat as unknown) as Category);
                        }
                    }
                }

                await db.transaction('rw', db.tables, async () => {
                    await clearLocalDb();
                    await db.app_state.put({
                        id: 1, user: session, fontSize: 'base', currency: 'BDT',
                        wastagePercentage: 0, showStockValue: false, lastSync: null
                    });
                    await bulkPut('categories', categoriesData); await bulkPut('vendors', vendorsData);
                    await bulkPut('clients', clientsData); await bulkPut('banks', banksData);
                    await bulkPut('cash_transactions', cashTxs); await bulkPut('bank_transactions', bankTxs);
                    await bulkPut('stock_transactions', stockTxs); await bulkPut('ap_ar_transactions', ledgerTxsWithInstallments);
                    await bulkPut('payment_installments', installmentsData);
                    await bulkPut('monthly_snapshots', snapshotsData); await bulkPut('initial_stock', initialStockData);
                    await db.app_state.update(1, { lastSync: new Date().toISOString() });
                });
                setLoadedMonths({});
            }

            await updateBalances();
            processSyncQueue();

            if (options?.needsInitialBalance && session.role === 'admin') {
                setState(prev => ({ ...prev, isInitialBalanceDialogOpen: true }));
            }

        } catch (error: any) {
            handleApiError(error);
        } finally {
            setState(prev => ({ ...prev, isLoading: false }));
        }
    }, [handleApiError, updateBalances, processSyncQueue, setUser]);
    
    const login = useCallback(async (credentials: Parameters<typeof serverLogin>[0]) => {
        try {
            const result = await serverLogin(credentials);
            if (result.success && result.session) {
                await db.app_state.update(1, { user: result.session });
                setUser(result.session);
                await reloadData({ force: true, needsInitialBalance: result.needsInitialBalance });
            }
            return result;
        } catch (error: any) {
            toast.error('Login Failed', { description: error.message });
            throw error;
        }
    }, [setUser, reloadData]);

    useEffect(() => {
        const checkSessionAndLoad = async () => {
            const session = await getSession();
            setUser(session);
            if (session) {
                if (liveData.user?.id === session.id) {
                    setState(prev => ({ ...prev, isLoading: false }));
                    await updateBalances();
                } else {
                    await reloadData({ force: true });
                }
            } else {
                setState(prev => ({ ...prev, isLoading: false }));
            }
        };
        checkSessionAndLoad();
    }, []);

    useEffect(() => {
        if (state.isLoading) return;
        const onLoginPage = pathname === '/login';
        if (user && onLoginPage) {
            router.replace('/');
        } else if (!user && !onLoginPage) {
            router.replace('/login');
        }
    }, [user, state.isLoading, pathname, router]);

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
        setState(prev => ({ ...prev, isOnline: navigator.onLine }));
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [processSyncQueue]);

    const loadRecycleBinData = useCallback(async () => {
        if (state.isOnline) {
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
    }, [handleApiError, state.isOnline]);

    const openInitialBalanceDialog = () => setState(prev => ({ ...prev, isInitialBalanceDialogOpen: true }));
    const closeInitialBalanceDialog = () => setState(prev => ({ ...prev, isInitialBalanceDialogOpen: false }));

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
    
    const contextValue = useMemo(() => ({
        ...state,
        ...liveData,
        user,
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
        login,
        logout,
        openInitialBalanceDialog,
        closeInitialBalanceDialog,
        loadRecycleBinData,
        setUser
    }), [state, liveData, user, deletedItems, loadedMonths, reloadData, updateBalances, handleApiError, processSyncQueue, login, logout]);

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
    const stockItems = useLiveQuery(() => db.initial_stock.toArray(), []);
    const ledgerTransactions = useLiveQuery(() => db.ap_ar_transactions.orderBy('date').reverse().toArray(), []);
    const banks = useLiveQuery(() => db.banks.toArray(), []);
    const categories = useLiveQuery(() => db.categories.toArray(), []);
    const vendors = useLiveQuery(() => db.vendors.toArray(), []);
    const clients = useLiveQuery(() => db.clients.toArray(), []);
    const syncQueueCount = useLiveQuery(() => db.sync_queue.count(), []) ?? 0;

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
        stockItems
    }
}

export function useAppContext() {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
}
