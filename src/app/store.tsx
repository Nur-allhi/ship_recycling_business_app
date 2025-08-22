
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import type { CashTransaction, BankTransaction, StockItem, StockTransaction, User, Vendor, Client, LedgerTransaction, PaymentInstallment, Bank, Category, MonthlySnapshot } from '@/lib/types';
import { toast } from 'sonner';
import { readData, appendData, updateData, deleteData, readDeletedData, restoreData, exportAllData, batchImportData, deleteAllData, logout as serverLogout, recordPaymentAgainstTotal, getBalances, login as serverLogin, hasUsers, emptyRecycleBin as serverEmptyRecycleBin, recordDirectPayment, setInitialBalances as serverSetInitialBalances, updateStockTransaction } from '@/app/actions';
import { format, subDays, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { getSession } from '@/lib/auth';
import { useRouter, usePathname } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, bulkPut, clearAllData as clearLocalDb, type SyncQueueItem } from '@/lib/db';
import { WifiOff } from 'lucide-react';

type FontSize = 'sm' | 'base' | 'lg';

interface AppState {
  cashBalance: number;
  bankBalance: number;
  stockItems: StockItem[];
  totalPayables: number;
  totalReceivables: number;
  isLoading: boolean;
  isInitialBalanceDialogOpen: boolean;
  isSyncing: boolean;
  isOnline: boolean;
}

interface AppContextType extends AppState {
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
  
  reloadData: (options?: { force?: boolean; needsInitialBalance?: boolean }) => Promise<void>;
  loadRecycleBinData: () => Promise<void>;
  loadDataForMonth: (month: Date) => Promise<void>;
  addCashTransaction: (tx: Omit<CashTransaction, 'id' | 'createdAt' | 'deletedAt'>) => Promise<void>;
  addBankTransaction: (tx: Omit<BankTransaction, 'id' | 'createdAt' | 'deletedAt'>) => Promise<void>;
  addStockTransaction: (tx: Omit<StockTransaction, 'id' | 'createdAt' | 'deletedAt'> & { contact_id?: string, contact_name?: string }, bank_id?: string) => Promise<void>;
  editCashTransaction: (originalTx: CashTransaction, updatedTxData: Partial<Omit<CashTransaction, 'id' | 'date' | 'createdAt'>>) => Promise<void>;
  editBankTransaction: (originalTx: BankTransaction, updatedTxData: Partial<Omit<BankTransaction, 'id' | 'date' | 'createdAt'>>) => Promise<void>;
  editStockTransaction: (originalTx: StockTransaction, updatedTxData: Partial<Omit<StockTransaction, 'id' | 'date' | 'createdAt'>>) => Promise<void>;
  deleteCashTransaction: (tx: CashTransaction) => void;
  deleteBankTransaction: (tx: BankTransaction) => void;
  deleteStockTransaction: (tx: StockTransaction) => void;
  deleteMultipleCashTransactions: (txs: CashTransaction[]) => void;
  deleteMultipleBankTransactions: (txs: BankTransaction[]) => void;
  deleteMultipleStockTransactions: (txs: StockTransaction[]) => void;
  deleteLedgerTransaction: (tx: LedgerTransaction) => void;
  restoreTransaction: (txType: 'cash' | 'bank' | 'stock' | 'ap_ar', id: string) => void;
  emptyRecycleBin: () => void;
  transferFunds: (from: 'cash' | 'bank', amount: number, date?: string, bankId?: string, description?: string) => Promise<void>;
  addCategory: (type: 'cash' | 'bank', category: string, direction: 'credit' | 'debit') => void;
  deleteCategory: (id: string) => void;
  setFontSize: (size: FontSize) => void;
  setWastagePercentage: (percentage: number) => void;
  setCurrency: (currency: string) => void;
  setShowStockValue: (show: boolean) => void;
  setInitialBalances: (cash: number, bankTotals: Record<string, number>, date: Date) => Promise<void>;
  openInitialBalanceDialog: () => void;
  closeInitialBalanceDialog: () => void;
  addInitialStockItem: (item: { name: string; weight: number; pricePerKg: number }) => void;
  handleExport: () => void;
  handleImport: (file: File) => void;
  handleDeleteAllData: () => void;
  logout: () => void;
  login: (credentials: Parameters<typeof serverLogin>[0]) => Promise<any>;
  addVendor: (name: string) => Promise<Vendor | null>;
  addClient: (name: string) => Promise<Client | null>;
  addLedgerTransaction: (tx: Omit<LedgerTransaction, 'id' | 'createdAt' | 'deletedAt' | 'status' | 'paid_amount' | 'installments'>) => Promise<void>;
  recordPayment: (contactId: string, contactName: string, paymentAmount: number, paymentMethod: 'cash' | 'bank', paymentDate: Date, ledgerType: 'payable' | 'receivable', bankId?: string) => Promise<void>;
  addBank: (name: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({
    cashBalance: 0,
    bankBalance: 0,
    stockItems: [],
    totalPayables: 0,
    totalReceivables: 0,
    isLoading: true,
    isInitialBalanceDialogOpen: false,
    isSyncing: false,
    isOnline: true,
  });
  
  const [loadedMonths, setLoadedMonths] = useState<Record<string, boolean>>({});

  const router = useRouter();
  const pathname = usePathname();
  
  // --- Live Queries from IndexedDB ---
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
  
  const user = appState?.user ?? null;
  const fontSize = appState?.fontSize ?? 'base';
  const currency = appState?.currency ?? 'BDT';
  const wastagePercentage = appState?.wastagePercentage ?? 0;
  const showStockValue = appState?.showStockValue ?? false;

  const { cashCategories, bankCategories } = useMemo(() => {
    const dbCash: Category[] = [];
    const dbBank: Category[] = [];
    (categories || []).forEach(c => {
        if (c.type === 'cash') dbCash.push(c);
        else dbBank.push(c);
    });
    return { cashCategories: dbCash, bankCategories: dbBank };
  }, [categories]);


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
    if (state.isSyncing || !state.isOnline) return;
    const queue = await db.syncQueue.orderBy('timestamp').toArray();
    if (queue.length === 0) return;

    setState(prev => ({ ...prev, isSyncing: true }));
    toast.info(`Syncing ${queue.length} offline changes...`);

    let successCount = 0;
    for (const item of queue) {
        try {
            switch(item.action) {
                case 'appendData': await appendData(item.payload); break;
                case 'updateData': await updateData(item.payload); break;
                case 'deleteData': await deleteData(item.payload); break;
                case 'recordDirectPayment': await recordDirectPayment(item.payload); break;
                case 'updateStockTransaction': await updateStockTransaction(item.payload); break;
                case 'setInitialBalances': await serverSetInitialBalances(item.payload); break;
                case 'recordPaymentAgainstTotal': await recordPaymentAgainstTotal(item.payload); break;
            }
            await db.syncQueue.delete(item.id!);
            successCount++;
        } catch (error) {
            console.error('Failed to process sync queue item:', item, error);
            toast.error('Sync Error', { description: `Failed to sync an offline change. Please check console.` });
            // Stop processing on first error to maintain order
            setState(prev => ({ ...prev, isSyncing: false }));
            return;
        }
    }

    if (successCount > 0) {
        await updateBalances();
        toast.success(`Successfully synced ${successCount} items.`);
    }

    setState(prev => ({ ...prev, isSyncing: false }));
  }, [state.isSyncing, state.isOnline, updateBalances]);

  const queueOrSync = useCallback(async (item: Omit<SyncQueueItem, 'timestamp' | 'id'>) => {
    if (state.isOnline) {
        try {
             switch(item.action) {
                case 'appendData': return await appendData(item.payload);
                case 'updateData': return await updateData(item.payload);
                case 'deleteData': return await deleteData(item.payload);
                case 'recordDirectPayment': return await recordDirectPayment(item.payload);
                case 'updateStockTransaction': return await updateStockTransaction(item.payload);
                case 'setInitialBalances': return await serverSetInitialBalances(item.payload);
                case 'recordPaymentAgainstTotal': return await recordPaymentAgainstTotal(item.payload);
            }
        } catch (error) {
            handleApiError(error);
            // If API fails even when online, queue it
            await db.syncQueue.add({ ...item, timestamp: Date.now() });
            throw error; // Re-throw to inform the caller
        }
    } else {
        await db.syncQueue.add({ ...item, timestamp: Date.now() });
        toast.info("You are offline. Change saved locally and will sync later.");
        return null;
    }
  }, [state.isOnline, handleApiError]);


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
                id: 1,
                user: session,
                fontSize: 'base',
                currency: 'BDT',
                wastagePercentage: 0,
                showStockValue: false,
                lastSync: null
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

            // Auto-create essential categories if they don't exist
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
                const exists = (categoriesData || []).some(c => c.name === cat.name && c.type === cat.type);
                if (!exists) {
                    const newCat = await appendData({ tableName: 'categories', data: cat, select: '*' });
                    if(newCat) categoriesData.push(newCat);
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
            setLoadedMonths({}); // Reset loaded months on full reload

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
  
  const loadDataForMonth = useCallback(async (month: Date) => {
    const monthKey = format(month, 'yyyy-MM');
    if (loadedMonths[monthKey]) return;

    try {
        const startDate = startOfMonth(month).toISOString();
        const endDate = endOfMonth(month).toISOString();

        const [cashTxs, bankTxs, stockTxs] = await Promise.all([
            readData({ tableName: 'cash_transactions', startDate, endDate }),
            readData({ tableName: 'bank_transactions', startDate, endDate }),
            readData({ tableName: 'stock_transactions', startDate, endDate }),
        ]);

        await db.transaction('rw', db.cashTransactions, db.bankTransactions, db.stockTransactions, async () => {
            if (cashTxs) await bulkPut('cashTransactions', cashTxs);
            if (bankTxs) await bulkPut('bankTransactions', bankTxs);
            if (stockTxs) await bulkPut('stockTransactions', stockTxs);
        });

        setLoadedMonths(prev => ({ ...prev, [monthKey]: true }));
    } catch (error) {
        handleApiError(error);
    }
  }, [loadedMonths, handleApiError]);
  
  useEffect(() => {
    const checkSessionAndLoad = async () => {
        const session = await getSession();
        if (session) {
            if (user && user.id === session.id) {
                 setState(prev => ({ ...prev, isLoading: false }));
                 updateBalances();
            } else {
                reloadData();
            }
        } else {
            setState(prev => ({ ...prev, isLoading: false, user: null }));
            db.appState.update(1, { user: null });
        }
    };
    checkSessionAndLoad();
  }, []);

  // Effect for handling online/offline status changes
  useEffect(() => {
    const checkOnlineStatus = async () => {
        if (!navigator.onLine) {
            setState(prev => ({ ...prev, isOnline: false }));
            return;
        }
        try {
            // Perform a network check to a reliable host.
            // Using a no-cors request to avoid CORS issues.
            await fetch('https://1.1.1.1', { method: 'HEAD', mode: 'no-cors', cache: 'no-store' });
            setState(prev => ({ ...prev, isOnline: true }));
        } catch (error) {
            setState(prev => ({ ...prev, isOnline: false }));
        }
    }

    checkOnlineStatus();

    const handleOnline = () => {
        toast.success("You are back online!");
        setState(prev => ({ ...prev, isOnline: true }));
        processSyncQueue();
    };
    const handleOffline = () => {
        setState(prev => ({ ...prev, isOnline: false }));
    }

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
        if(user) router.replace('/');
    } else {
        if(!user) router.replace('/login');
    }
  }, [pathname, user, state.isLoading, router]);
  

  const login = useCallback(async (credentials: Parameters<typeof serverLogin>[0]) => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
        const result = await serverLogin(credentials);
        if(result.success) {
            await reloadData({ needsInitialBalance: result.needsInitialBalance, force: true });
        }
        return result;
    } finally {
        setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [reloadData]);

  const addCashTransaction = async (tx: Omit<CashTransaction, 'id' | 'createdAt' | 'deletedAt'>) => {
      const tempId = `temp_${Date.now()}`;
      const newTxData = { ...tx, id: tempId, createdAt: new Date().toISOString() };
      await db.cashTransactions.add(newTxData);
      
      const payload = {
        payment_method: 'cash' as const,
        date: tx.date,
        amount: tx.actual_amount,
        category: tx.category,
        description: tx.description,
        contact_id: tx.contact_id!,
        contact_name: (tx.type === 'income' ? clients : vendors).find(c => c.id === tx.contact_id)?.name || 'Unknown',
      };
      
      try {
        if (tx.category === 'A/R Settlement' || tx.category === 'A/P Settlement') {
             await queueOrSync({ action: 'recordDirectPayment', payload });
        } else {
            const savedTx = await queueOrSync({ action: 'appendData', payload: { tableName: 'cash_transactions', data: tx, logDescription: `Added cash transaction: ${tx.description}`, select: '*' } });
            if (savedTx) {
                await db.cashTransactions.where({ id: tempId }).modify(savedTx);
            }
        }
        await updateBalances();
      } catch (e) { /* error is handled in queueOrSync */ }
  };

  const addBankTransaction = async (tx: Omit<BankTransaction, 'id' | 'createdAt' | 'deletedAt'>) => {
      const tempId = `temp_${Date.now()}`;
      const newTxData = { ...tx, id: tempId, createdAt: new Date().toISOString() };
      await db.bankTransactions.add(newTxData);

      const payload = {
        payment_method: 'bank' as const,
        bank_id: tx.bank_id,
        date: tx.date,
        amount: tx.actual_amount,
        category: tx.category,
        description: tx.description,
        contact_id: tx.contact_id!,
        contact_name: (tx.type === 'deposit' ? clients : vendors).find(c => c.id === tx.contact_id)?.name || 'Unknown',
      };

      try {
          if (tx.category === 'A/R Settlement' || tx.category === 'A/P Settlement') {
              await queueOrSync({ action: 'recordDirectPayment', payload });
          } else {
             const savedTx = await queueOrSync({ action: 'appendData', payload: { tableName: 'bank_transactions', data: tx, logDescription: `Added bank transaction: ${tx.description}`, select: '*' } });
              if (savedTx) {
                await db.bankTransactions.where({ id: tempId }).modify(savedTx);
              }
          }
          await updateBalances();
      } catch(e) {}
  };

  const addLedgerTransaction = async (tx: Omit<LedgerTransaction, 'id' | 'createdAt' | 'deletedAt' | 'status' | 'paid_amount' | 'installments'>) => {
      const tempId = `temp_${Date.now()}`;
      const dataToSave = { ...tx, status: 'unpaid', paid_amount: 0, installments: [] };
      const newTxData = { ...dataToSave, id: tempId, createdAt: new Date().toISOString() };
      await db.ledgerTransactions.add(newTxData);
      await updateBalances();
      try {
          const newTx = await queueOrSync({ action: 'appendData', payload: { tableName: 'ap_ar_transactions', data: dataToSave, logDescription: `Added A/P or A/R: ${tx.description}`, select: '*' } });
           if (newTx) {
              await db.ledgerTransactions.where({ id: tempId }).modify({ ...newTx, installments: []});
          }
      } catch (error) { handleApiError(error); }
  }

  const addStockTransaction = async (tx: Omit<StockTransaction, 'id' | 'createdAt' | 'deletedAt'> & { contact_id?: string; contact_name?: string }, bank_id?: string) => {
    const stockTempId = `temp_stock_${Date.now()}`;
    const stockTxToSave = { ...tx };
    
    // 1. Optimistically update local DB
    await db.stockTransactions.add({ ...stockTxToSave, id: stockTempId, createdAt: new Date().toISOString() });
    
    const savedStockTxPromise = queueOrSync({ action: 'appendData', payload: { tableName: 'stock_transactions', data: stockTxToSave, select: '*' }});

    if (tx.paymentMethod === 'cash' || tx.paymentMethod === 'bank') {
        const financialTxData = {
            date: tx.date,
            expected_amount: tx.expected_amount,
            actual_amount: tx.actual_amount,
            difference: tx.difference,
            difference_reason: tx.difference_reason,
            description: tx.description || `${tx.type} of ${tx.weight}kg of ${tx.stockItemName}`,
            category: tx.type === 'purchase' ? 'Stock Purchase' : 'Stock Sale',
            linkedStockTxId: stockTempId,
        };

        if (tx.paymentMethod === 'cash') {
            const cashTempId = `temp_cash_${Date.now()}`;
            await db.cashTransactions.add({ ...financialTxData, type: tx.type === 'purchase' ? 'expense' : 'income', id: cashTempId, createdAt: new Date().toISOString() });
            
            savedStockTxPromise.then(async (savedStockTx) => {
                if (savedStockTx) {
                    await db.stockTransactions.where({ id: stockTempId }).modify(savedStockTx); // Update with real ID
                    const finalFinancialData = { ...financialTxData, type: tx.type === 'purchase' ? 'expense' : 'income', linkedStockTxId: savedStockTx.id };
                    const savedFinancialTx = await queueOrSync({ action: 'appendData', payload: { tableName: 'cash_transactions', data: finalFinancialData, select: '*' } });
                    if(savedFinancialTx) await db.cashTransactions.where({ id: cashTempId }).modify(savedFinancialTx);
                }
            });

        } else { // bank
            const bankTempId = `temp_bank_${Date.now()}`;
            await db.bankTransactions.add({ ...financialTxData, type: tx.type === 'purchase' ? 'withdrawal' : 'deposit', bank_id: bank_id!, id: bankTempId, createdAt: new Date().toISOString() });
           
            savedStockTxPromise.then(async (savedStockTx) => {
                if (savedStockTx) {
                    await db.stockTransactions.where({ id: stockTempId }).modify(savedStockTx);
                    const finalFinancialData = { ...financialTxData, type: tx.type === 'purchase' ? 'withdrawal' : 'deposit', bank_id: bank_id!, linkedStockTxId: savedStockTx.id };
                    const savedFinancialTx = await queueOrSync({ action: 'appendData', payload: { tableName: 'bank_transactions', data: finalFinancialData, select: '*' } });
                    if(savedFinancialTx) await db.bankTransactions.where({ id: bankTempId }).modify(savedFinancialTx);
                }
            });
        }
    } else if (tx.paymentMethod === 'credit') {
        const ledgerTempId = `temp_ledger_${Date.now()}`;
        const ledgerData = {
            type: tx.type === 'purchase' ? 'payable' : 'receivable',
            description: tx.description || `${tx.stockItemName} (${tx.weight}kg)`,
            amount: tx.actual_amount,
            date: tx.date,
            contact_id: tx.contact_id!,
            contact_name: tx.contact_name!,
        };
        const ledgerToSave = { ...ledgerData, status: 'unpaid', paid_amount: 0, installments: [] };
        await db.ledgerTransactions.add({ ...ledgerToSave, id: ledgerTempId, createdAt: new Date().toISOString() });
        
        savedStockTxPromise.then(async (savedStockTx) => {
            if (savedStockTx) await db.stockTransactions.where({ id: stockTempId }).modify(savedStockTx);
        });

        const { installments, ...dataToSync } = ledgerToSave;
        const savedLedgerTx = await queueOrSync({ action: 'appendData', payload: { tableName: 'ap_ar_transactions', data: dataToSync, select: '*' } });
        if (savedLedgerTx) {
            await db.ledgerTransactions.where({ id: ledgerTempId }).modify({ ...savedLedgerTx, installments: [] });
        }
    }
    
    await updateBalances();
};

  const editCashTransaction = async (originalTx: CashTransaction, updatedTxData: Partial<Omit<CashTransaction, 'id' | 'date' | 'createdAt'>>) => {
    await db.cashTransactions.update(originalTx.id, updatedTxData);
    await updateBalances();
    try {
      await queueOrSync({ action: 'updateData', payload: { tableName: 'cash_transactions', id: originalTx.id, data: updatedTxData, logDescription: `Edited cash tx: ${originalTx.id}` }});
      toast.success("Success", { description: "Cash transaction updated." });
    } catch (error) { handleApiError(error); }
  };
  const editBankTransaction = async (originalTx: BankTransaction, updatedTxData: Partial<Omit<BankTransaction, 'id'| 'date' | 'createdAt'>>) => {
    await db.bankTransactions.update(originalTx.id, updatedTxData);
    await updateBalances();
    try {
      await queueOrSync({ action: 'updateData', payload: { tableName: 'bank_transactions', id: originalTx.id, data: updatedTxData, logDescription: `Edited bank tx: ${originalTx.id}` }});
      toast.success("Success", { description: "Bank transaction updated."});
    } catch(error) { handleApiError(error); }
  };

  const editStockTransaction = async (originalTx: StockTransaction, updatedTxData: Partial<Omit<StockTransaction, 'id' | 'date' | 'createdAt'>>) => {
    await db.stockTransactions.update(originalTx.id, updatedTxData);
    await updateBalances();
    try {
        await queueOrSync({
            action: 'updateStockTransaction',
            payload: { stockTxId: originalTx.id, updates: updatedTxData }
        });
        toast.success("Stock transaction updated.");
    } catch (error) {
        handleApiError(error);
    }
  };

  const deleteTransaction = async (tableName: 'cash_transactions' | 'bank_transactions' | 'stock_transactions' | 'ap_ar_transactions', localTable: 'cashTransactions' | 'bankTransactions' | 'stockTransactions' | 'ledgerTransactions', txToDelete: any) => {
    await db.table(localTable).delete(txToDelete.id);
    await updateBalances();
    try {
        await queueOrSync({ action: 'deleteData', payload: { tableName, id: txToDelete.id, logDescription: `Deleted item from ${tableName}` }});
        if (tableName === 'stock_transactions') {
            const linkedCash = await db.cashTransactions.where({ linkedStockTxId: txToDelete.id }).first();
            if (linkedCash) {
                 await queueOrSync({ action: 'deleteData', payload: { tableName: 'cash_transactions', id: linkedCash.id }});
                 await db.cashTransactions.delete(linkedCash.id);
            }
            const linkedBank = await db.bankTransactions.where({ linkedStockTxId: txToDelete.id }).first();
            if (linkedBank) {
                 await queueOrSync({ action: 'deleteData', payload: { tableName: 'bank_transactions', id: linkedBank.id }});
                 await db.bankTransactions.delete(linkedBank.id);
            }
        }
        toast.success("Moved to recycle bin.");
    } catch (error) {
        handleApiError(error);
    }
  };


  const setFontSize = (size: FontSize) => db.appState.update(1, { fontSize: size });
  const setWastagePercentage = (percentage: number) => db.appState.update(1, { wastagePercentage: percentage });
  const setCurrency = (currency: string) => db.appState.update(1, { currency: currency });
  const setShowStockValue = (show: boolean) => db.appState.update(1, { showStockValue: show });
  
  const addBank = async (name: string) => {
    const tempId = `temp_${Date.now()}`;
    await db.banks.add({ id: tempId, name, createdAt: new Date().toISOString() });
    const newBank = await queueOrSync({ action: 'appendData', payload: { tableName: 'banks', data: { name }, select: '*' } });
    if(newBank) await db.banks.where({ id: tempId }).modify(newBank);
  }
  
  const addCategory = async (type: 'cash' | 'bank', name: string, direction: 'credit' | 'debit') => {
      const tempId = `temp_${Date.now()}`;
      await db.categories.add({ id: tempId, name, type, direction, is_deletable: true});
      const newCategory = await queueOrSync({ action: 'appendData', payload: { tableName: 'categories', data: { name, type, direction, is_deletable: true }, select: '*' } });
      if(newCategory) await db.categories.where({id: tempId}).modify(newCategory);
  }
  
  const deleteCategory = async (id: string) => {
    await db.categories.delete(id);
    await queueOrSync({ action: 'deleteData', payload: { tableName: 'categories', id } });
  }

  const transferFunds = async (from: 'cash' | 'bank', amount: number, date?: string, bankId?: string, description?: string) => {
      await reloadData({ force: true });
  };

  const setInitialBalances = async (cash: number, bankTotals: Record<string, number>, date: Date) => {
    try {
        const payload = { cash, bankTotals, date: date.toISOString() };
        await queueOrSync({ action: 'setInitialBalances', payload });
        await reloadData({ force: true });
        closeInitialBalanceDialog();
    } catch (error) {
      handleApiError(error);
      throw error; // Re-throw to be caught in the component
    }
  };

  const addInitialStockItem = async (item: { name: string; weight: number; pricePerKg: number }) => {
      const newItem = await appendData({ tableName: 'initial_stock', data: { name: item.name, weight: item.weight, purchasePricePerKg: item.pricePerKg }, select: '*' });
      if(newItem) await db.initialStock.add(newItem);
  }

  const handleImport = async (file: File) => {
      await reloadData({ force: true });
  }
  
  const handleDeleteAllData = async () => {
    await deleteAllData();
    await logout();
  }
  
  const openInitialBalanceDialog = () => setState(prev => ({...prev, isInitialBalanceDialogOpen: true}));
  const closeInitialBalanceDialog = () => setState(prev => ({...prev, isInitialBalanceDialogOpen: false}));

  const addVendor = async (name: string) => {
    const tempId = `temp_vendor_${Date.now()}`;
    const newVendorData = { id: tempId, name, createdAt: new Date().toISOString() };
    await db.vendors.add(newVendorData);
    const newVendor = await queueOrSync({ action: 'appendData', payload: { tableName: 'vendors', data: { name }, select: '*' }});
    if (newVendor) {
        await db.vendors.where({id: tempId}).modify(newVendor);
        return newVendor as Vendor;
    }
    return newVendorData as Vendor;
  };
  
  const addClient = async (name: string) => {
    const tempId = `temp_client_${Date.now()}`;
    const newClientData = { id: tempId, name, createdAt: new Date().toISOString() };
    await db.clients.add(newClientData);
    const newClient = await queueOrSync({ action: 'appendData', payload: { tableName: 'clients', data: { name }, select: '*' }});
    if (newClient) {
        await db.clients.where({id: tempId}).modify(newClient);
        return newClient as Client;
    }
    return newClientData as Client;
  };

  const recordPayment = async (contactId: string, contactName: string, paymentAmount: number, paymentMethod: 'cash' | 'bank', paymentDate: Date, ledgerType: 'payable' | 'receivable', bankId?: string) => {
    try {
        await queueOrSync({ 
            action: 'recordPaymentAgainstTotal', 
            payload: {
                contact_id: contactId,
                contact_name: contactName,
                payment_amount: paymentAmount,
                payment_date: paymentDate.toISOString(),
                payment_method: paymentMethod,
                ledger_type: ledgerType,
                bank_id: bankId,
            }
        });
        await reloadData({ force: true });
    } catch (e) {
        handleApiError(e);
        throw e;
    }
  };

  const [deletedItems, setDeletedItems] = useState({
    cash: [], bank: [], stock: [], ap_ar: []
  });

  const loadRecycleBinData = useCallback(async () => {
    try {
        const [cash, bank, stock, ap_ar] = await Promise.all([
            readDeletedData({ tableName: 'cash_transactions'}),
            readDeletedData({ tableName: 'bank_transactions'}),
            readDeletedData({ tableName: 'stock_transactions'}),
            readDeletedData({ tableName: 'ap_ar_transactions'}),
        ]);
        setDeletedItems({
            cash: cash || [],
            bank: bank || [],
            stock: stock || [],
            ap_ar: ap_ar || [],
        });
    } catch (error) {
        handleApiError(error);
    }
  }, [handleApiError]);

  const restoreTransaction = useCallback(async (txType: 'cash' | 'bank' | 'stock' | 'ap_ar', id: string) => {
    try {
        let tableName = '';
        switch(txType) {
            case 'cash': tableName = 'cash_transactions'; break;
            case 'bank': tableName = 'bank_transactions'; break;
            case 'stock': tableName = 'stock_transactions'; break;
            case 'ap_ar': tableName = 'ap_ar_transactions'; break;
        }
        await restoreData({ tableName, id });
        toast.success("Item restored successfully.");
        await loadRecycleBinData();
        await updateBalances();
    } catch (error) {
        handleApiError(error);
    }
  }, [handleApiError, loadRecycleBinData, updateBalances]);

  const emptyRecycleBin = useCallback(async () => {
    try {
        await serverEmptyRecycleBin();
        toast.success("Recycle bin has been emptied.");
        await loadRecycleBinData();
    } catch(e) {
        handleApiError(e);
    }
  }, [handleApiError, loadRecycleBinData]);


  return (
    <AppContext.Provider value={{ 
        ...state,
        user,
        fontSize,
        currency,
        wastagePercentage,
        showStockValue,
        cashTransactions: cashTransactions || [],
        bankTransactions: bankTransactions || [],
        stockTransactions: stockTransactions || [],
        ledgerTransactions: ledgerTransactions || [],
        deletedCashTransactions: deletedItems.cash,
        deletedBankTransactions: deletedItems.bank,
        deletedStockTransactions: deletedItems.stock,
        deletedLedgerTransactions: deletedItems.ap_ar,
        cashCategories: cashCategories || [],
        bankCategories: bankCategories || [],
        vendors: vendors || [],
        clients: clients || [],
        banks: banks || [],
        syncQueueCount,
        loadedMonths,
        reloadData,
        loadRecycleBinData,
        loadDataForMonth,
        addCashTransaction,
        addBankTransaction,
        addStockTransaction,
        editCashTransaction,
        editBankTransaction,
        editStockTransaction,
        deleteCashTransaction: (tx) => deleteTransaction('cash_transactions', 'cashTransactions', tx),
        deleteBankTransaction: (tx) => deleteTransaction('bank_transactions', 'bankTransactions', tx),
        deleteStockTransaction: (tx) => deleteTransaction('stock_transactions', 'stockTransactions', tx),
        deleteLedgerTransaction: (tx) => deleteTransaction('ap_ar_transactions', 'ledgerTransactions', tx),
        deleteMultipleCashTransactions: (txs) => Promise.all(txs.map(tx => deleteTransaction('cash_transactions', 'cashTransactions', tx))),
        deleteMultipleBankTransactions: (txs) => Promise.all(txs.map(tx => deleteTransaction('bank_transactions', 'bankTransactions', tx))),
        deleteMultipleStockTransactions: (txs) => Promise.all(txs.map(tx => deleteTransaction('stock_transactions', 'stockTransactions', tx))),
        restoreTransaction,
        emptyRecycleBin,
        transferFunds,
        addCategory,
        deleteCategory,
        setFontSize,
        setWastagePercentage,
        setCurrency,
        setShowStockValue,
        setInitialBalances,
        openInitialBalanceDialog,
        closeInitialBalanceDialog,
        addInitialStockItem,
        handleExport: async () => {}, // Placeholder, to be implemented
        handleImport,
        handleDeleteAllData,
        logout,
        login,
        addVendor,
        addClient,
        addLedgerTransaction,
        recordPayment,
        addBank,
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

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
