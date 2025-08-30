
import { useState, useCallback, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { toast } from 'sonner';
import type { User, Category, CashTransaction, BankTransaction, StockTransaction, LedgerTransaction, Vendor, Client, Bank, StockItem } from '@/lib/types';
import { db, bulkPut, clearAllData as clearLocalDb } from '@/lib/db';
import * as server from '@/lib/actions';

type FontSize = 'sm' | 'base' | 'lg';

export interface DataManagerState {
  cashBalance: number;
  bankBalance: number;
  totalPayables: number;
  totalReceivables: number;
  isInitialBalanceDialogOpen: boolean;
  loadedMonths: Record<string, boolean>;
  deletedItems: {
    cash: any[];
    bank: any[];
    stock: any[];
    ap_ar: any[];
  };
}

export interface DataManagerActions {
  reloadData: (options?: { force?: boolean; needsInitialBalance?: boolean }) => Promise<void>;
  updateBalances: () => Promise<void>;
  loadRecycleBinData: () => Promise<void>;
  openInitialBalanceDialog: () => void;
  closeInitialBalanceDialog: () => void;
  setLoadedMonths: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setDeletedItems: React.Dispatch<React.SetStateAction<{ cash: any[]; bank: any[]; stock: any[]; ap_ar: any[]; }>>;
}

export interface DataManagerReturn extends DataManagerState, DataManagerActions {
  // Live data from IndexedDB
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
  stockItems: StockItem[] | undefined;
  syncQueueCount: number;
}

export function useDataManager(
  user: User | null,
  handleApiError: (error: unknown) => void,
  isOnline: boolean
): DataManagerReturn {
  const [state, setState] = useState({
    cashBalance: 0,
    bankBalance: 0,
    totalPayables: 0,
    totalReceivables: 0,
    isInitialBalanceDialogOpen: false,
  });

  const [loadedMonths, setLoadedMonths] = useState<Record<string, boolean>>({});
  const [deletedItems, setDeletedItems] = useState<{ cash: any[], bank: any[], stock: any[], ap_ar: any[] }>({
    cash: [], bank: [], stock: [], ap_ar: []
  });

  // Live data from IndexedDB
  const liveData = useLiveDBData();

  const updateBalances = useCallback(async () => {
    try {
      const [allCash, allBank, allLedger] = await Promise.all([
        db.cash_transactions.toArray(),
        db.bank_transactions.toArray(),
        db.ap_ar_transactions.toArray(),
      ]);

      const cashBalance = allCash.reduce((acc, tx) => acc + (tx.type === 'income' ? tx.actual_amount : -tx.actual_amount), 0);
      const bankBalance = allBank.reduce((acc, tx) => acc + (tx.type === 'deposit' ? tx.actual_amount : -tx.actual_amount), 0);
      const totalPayables = allLedger.filter(tx => tx.type === 'payable').reduce((acc, tx) => acc + (tx.amount - tx.paid_amount), 0);
      const totalReceivables = allLedger.filter(tx => tx.type === 'receivable').reduce((acc, tx) => acc + (tx.amount - tx.paid_amount), 0);
      
      setState(prev => ({ 
        ...prev, 
        cashBalance, 
        bankBalance, 
        totalPayables, 
        totalReceivables 
      }));
    } catch (error) {
      console.error('Error updating balances:', error);
    }
  }, []);

  // Update balances whenever transactions change
  useEffect(() => {
    updateBalances();
  }, [liveData.cashTransactions, liveData.bankTransactions, liveData.ledgerTransactions, updateBalances]);

  const reloadData = useCallback(async (options?: { force?: boolean, needsInitialBalance?: boolean }) => {
    try {
      if (!user) return;

      const localUser = await db.app_state.get(1);
      if (!localUser || !localUser.user || localUser.user.id !== user.id || options?.force) {
        await db.app_state.put({
          id: 1, 
          user: user, 
          fontSize: 'base', 
          currency: 'BDT',
          wastagePercentage: 0, 
          showStockValue: false, 
          lastSync: null
        });
        
        const [
          categoriesData, vendorsData, clientsData, banksData, 
          cashTxs, bankTxs, stockTxs, ledgerData, 
          installmentsData, snapshotsData, initialStockData
        ] = await Promise.all([
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

        // Ensure essential categories exist
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

        if (Array.isArray(categoriesData)) {
            for (const cat of essentialCategories) {
                const exists = (categoriesData as Category[]).some((c: Category) => c.name === cat.name && c.type === cat.type);
                if (!exists) {
                    const newCat = await server.appendData({ tableName: 'categories', data: cat, select: '*' });
                    if (newCat) (categoriesData as Category[]).push(newCat as Category);
                }
            }
        }

        await db.transaction('rw', db.tables, async () => {
          await clearLocalDb();
          await db.app_state.put({
            id: 1, 
            user: user, 
            fontSize: 'base', 
            currency: 'BDT',
            wastagePercentage: 0, 
            showStockValue: false, 
            lastSync: null
          });
          
          await bulkPut('categories', categoriesData);
          await bulkPut('vendors', vendorsData);
          await bulkPut('clients', clientsData);
          await bulkPut('banks', banksData);
          await bulkPut('cash_transactions', cashTxs);
          await bulkPut('bank_transactions', bankTxs);
          await bulkPut('stock_transactions', stockTxs);
          await bulkPut('ap_ar_transactions', ledgerTxsWithInstallments);
          await bulkPut('payment_installments', installmentsData);
          await bulkPut('monthly_snapshots', snapshotsData);
          await bulkPut('initial_stock', initialStockData);
          await db.app_state.update(1, { lastSync: new Date().toISOString() });
        });
        
        setLoadedMonths({});
      }

      await updateBalances();

      if (options?.needsInitialBalance && user.role === 'admin') {
        setState(prev => ({ ...prev, isInitialBalanceDialogOpen: true }));
      }

    } catch (error: any) {
      handleApiError(error);
    }
  }, [user, handleApiError, updateBalances]);

  const loadRecycleBinData = useCallback(async () => {
    if (isOnline) {
      try {
        const [cash, bank, stock, ap_ar] = await Promise.all([
          server.readDeletedData({ tableName: 'cash_transactions', select: '*' }),
          server.readDeletedData({ tableName: 'bank_transactions', select: '*' }),
          server.readDeletedData({ tableName: 'stock_transactions', select: '*' }),
          server.readDeletedData({ tableName: 'ap_ar_transactions', select: '*' }),
        ]);
        setDeletedItems({ 
          cash: cash || [], 
          bank: bank || [], 
          stock: stock || [], 
          ap_ar: ap_ar || [] 
        });
      } catch (error) {
        handleApiError(error);
      }
    } else {
      toast.error("Cannot load recycle bin data while offline.");
    }
  }, [handleApiError, isOnline]);

  const openInitialBalanceDialog = () => setState(prev => ({ ...prev, isInitialBalanceDialogOpen: true }));
  const closeInitialBalanceDialog = () => setState(prev => ({ ...prev, isInitialBalanceDialogOpen: false }));

  return {
    ...state,
    ...liveData,
    loadedMonths,
    deletedItems,
    deletedCashTransactions: deletedItems.cash,
    deletedBankTransactions: deletedItems.bank,
    deletedStockTransactions: deletedItems.stock,
    deletedLedgerTransactions: deletedItems.ap_ar,
    reloadData,
    updateBalances,
    loadRecycleBinData,
    openInitialBalanceDialog,
    closeInitialBalanceDialog,
    setLoadedMonths,
    setDeletedItems,
  };
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
    fontSize: (appState?.fontSize ?? 'base') as FontSize,
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
  };
}
