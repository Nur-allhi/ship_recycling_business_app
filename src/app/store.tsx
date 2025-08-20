
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import type { CashTransaction, BankTransaction, StockItem, StockTransaction, User, Vendor, Client, LedgerTransaction, PaymentInstallment, Bank, Category } from '@/lib/types';
import { toast } from 'sonner';
import { readData, appendData, updateData, deleteData, readDeletedData, restoreData, exportAllData, batchImportData, deleteAllData, logout as serverLogout, recordPaymentAgainstTotal, getBalances, login as serverLogin, hasUsers, emptyRecycleBin as serverEmptyRecycleBin, recordDirectPayment } from '@/app/actions';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { getSession } from '@/lib/auth';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';

type FontSize = 'sm' | 'base' | 'lg';

interface AppState {
  cashBalance: number;
  cashTransactions: CashTransaction[];
  bankBalance: number;
  bankTransactions: BankTransaction[];
  initialStockItems: StockItem[];
  stockItems: StockItem[];
  stockTransactions: StockTransaction[];
  deletedCashTransactions: CashTransaction[];
  deletedBankTransactions: BankTransaction[];
  deletedStockTransactions: StockTransaction[];
  deletedLedgerTransactions: LedgerTransaction[];
  cashCategories: Category[];
  bankCategories: Category[];
  fontSize: FontSize;
  isInitialBalanceDialogOpen: boolean;
  wastagePercentage: number;
  currency: string;
  showStockValue: boolean;
  user: User | null;
  vendors: Vendor[];
  clients: Client[];
  ledgerTransactions: LedgerTransaction[];
  totalPayables: number;
  totalReceivables: number;
  isLoading: boolean;
  banks: Bank[];
  loadedMonths: Record<string, boolean>; // YYYY-MM format
}

interface AppContextType extends AppState {
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
  setInitialBalances: (cash: number, bankTotals: Record<string, number>, date: Date) => void;
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

const CACHE_KEY = 'haMimIronMartCache';
const CACHE_VERSION = '1.2'; // Increment version to invalidate old cache

const defaultState: AppState = {
    cashBalance: 0,
    cashTransactions: [],
    bankBalance: 0,
    bankTransactions: [],
    initialStockItems: [],
    stockItems: [],
    stockTransactions: [],
    deletedCashTransactions: [],
    deletedBankTransactions: [],
    deletedStockTransactions: [],
    deletedLedgerTransactions: [],
    cashCategories: [],
    bankCategories: [],
    fontSize: 'base',
    isInitialBalanceDialogOpen: false,
    wastagePercentage: 0,
    currency: 'BDT',
    showStockValue: false,
    user: null,
    vendors: [],
    clients: [],
    ledgerTransactions: [],
    totalPayables: 0,
    totalReceivables: 0,
    isLoading: true,
    banks: [],
    loadedMonths: {},
};


const FIXED_CASH_CATEGORIES = [
    { name: 'Cash In', direction: 'credit', is_deletable: false },
    { name: 'Cash Out', direction: 'debit', is_deletable: false },
    { name: 'Utilities', direction: 'debit', is_deletable: false },
    { name: 'Operational', direction: 'debit', is_deletable: false },
    { name: 'A/P Settlement', direction: 'debit', is_deletable: false },
    { name: 'A/R Settlement', direction: 'credit', is_deletable: false },
];

const FIXED_BANK_CATEGORIES = [
    { name: 'Deposit', direction: 'credit', is_deletable: false },
    { name: 'Withdrawal', direction: 'debit', is_deletable: false },
    { name: 'A/P Settlement', direction: 'debit', is_deletable: false },
    { name: 'A/R Settlement', direction: 'credit', is_deletable: false },
];


export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(defaultState);
  const [isHydrated, setIsHydrated] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  
  useEffect(() => {
    // This effect runs only on the client, after hydration
    let cachedState: Partial<AppState> = {};
    try {
      const cachedData = localStorage.getItem(CACHE_KEY);
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        if (parsed.version === CACHE_VERSION) {
            cachedState = parsed.data;
        } else {
            localStorage.removeItem(CACHE_KEY);
        }
      }
    } catch (e) {
      console.error("Failed to load from localStorage", e);
    }
    // Set the state from cache, but keep isLoading true until we fetch from server
    setState(prev => ({...prev, ...cachedState, isLoading: true}));
    setIsHydrated(true); // Signal that client-side state is now loaded
  }, []);

  useEffect(() => {
    if (!isHydrated) return; // Don't save to localStorage until client state is loaded
    // Persist state to localStorage on any change except for certain transient properties.
    const { isLoading, isInitialBalanceDialogOpen, deletedCashTransactions, deletedBankTransactions, deletedStockTransactions, deletedLedgerTransactions, ...stateToCache } = state;
    try {
      const dataToStore = {
        version: CACHE_VERSION,
        timestamp: new Date().toISOString(),
        data: stateToCache,
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(dataToStore));
    } catch (e) {
      console.error("Failed to save to localStorage", e);
    }
  }, [state, isHydrated]);


  const openInitialBalanceDialog = () => {
    if(state.user?.role === 'admin') {
      setState(prev => ({ ...prev, isInitialBalanceDialogOpen: true }));
    } else {
      toast.error("Permission Denied.");
    }
  }

  const closeInitialBalanceDialog = () => {
    setState(prev => ({ ...prev, isInitialBalanceDialogOpen: false }));
  }

  const logout = useCallback(async () => {
    await serverLogout();
    if(typeof window !== 'undefined') {
        localStorage.removeItem(CACHE_KEY);
    }
    setState({...defaultState, user: null, isLoading: false});
    window.location.href = '/login';
  }, []);

  const handleApiError = useCallback((error: any) => {
    const isAuthError = error.message.includes('JWT') || error.message.includes('Unauthorized') || error.message.includes("SESSION_EXPIRED");
    if (isAuthError) {
        toast.error('Session Expired', {
            description: 'Your session has expired. Please log in again.',
        });
        logout();
    } else {
        console.error("API Error:", error);
        toast.error('An Error Occurred', {
            description: error.message || 'An unknown error occurred. Please try again.',
        });
    }
  }, [logout]);
  
  const reloadData = useCallback(async (options?: { force?: boolean, needsInitialBalance?: boolean }) => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
        const session = await getSession();
        if (!session) {
            setState(prev => ({...prev, isLoading: false, user: null }));
            return;
        }
        if (!state.user) {
            setState(prev => ({ ...prev, user: session }));
        }

        if(options?.needsInitialBalance && session.role === 'admin') {
            toast.info("Welcome! Let's set up your starting balance.", {
                description: "You can close this and set it later from the Settings menu.",
                duration: 10000,
                action: {
                    label: "Set Balances",
                    onClick: () => openInitialBalanceDialog(),
                }
            })
             setState(prev => ({...prev, isInitialBalanceDialogOpen: true }));
        }
        
        const today = new Date();
        const thirtyDaysAgo = subDays(today, 30);
        const monthKey = format(today, 'yyyy-MM');

        // Fetch static data and balances first
        const [
            categoriesData, vendorsData, clientsData, banksData, balances
        ] = await Promise.all([
            readData({ tableName: 'categories' }),
            readData({ tableName: 'vendors' }),
            readData({ tableName: 'clients' }),
            readData({ tableName: 'banks' }),
            getBalances()
        ]);
        
        // Fetch recent transactions
        const [
            cashTxs, bankTxs, stockTxs, ledgerData, installmentsData
        ] = await Promise.all([
            readData({ tableName: 'cash_transactions', startDate: thirtyDaysAgo.toISOString() }),
            readData({ tableName: 'bank_transactions', startDate: thirtyDaysAgo.toISOString() }),
            readData({ tableName: 'stock_transactions', startDate: thirtyDaysAgo.toISOString() }),
            readData({ tableName: 'ap_ar_transactions', startDate: thirtyDaysAgo.toISOString() }),
            readData({ tableName: 'payment_installments', startDate: thirtyDaysAgo.toISOString() }),
        ]);

        const ledgerTxs = (ledgerData || []).map((tx: any) => ({
            ...tx,
            installments: (installmentsData || []).filter((ins: any) => ins.ap_ar_transaction_id === tx.id)
        }));

        const fixedCashNames = new Set(FIXED_CASH_CATEGORIES.map(c => c.name));
        const dbCashCategories: Category[] = (categoriesData || []).filter((c: any) => c.type === 'cash' && !fixedCashNames.has(c.name));
        const cashCategories = [...FIXED_CASH_CATEGORIES, ...dbCashCategories];

        const fixedBankNames = new Set(FIXED_BANK_CATEGORIES.map(c => c.name));
        const dbBankCategories: Category[] = (categoriesData || []).filter((c: any) => c.type === 'bank' && !fixedBankNames.has(c.name));
        const bankCategories = [...FIXED_BANK_CATEGORIES, ...dbBankCategories];
        
        setState(prev => ({
            ...prev,
            cashTransactions: (cashTxs || []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            bankTransactions: (bankTxs || []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            stockTransactions: (stockTxs || []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            ledgerTransactions: (ledgerTxs || []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            cashCategories,
            bankCategories,
            vendors: vendorsData || [],
            clients: clientsData || [],
            banks: banksData || [],
            cashBalance: balances.cashBalance,
            bankBalance: balances.bankBalance,
            stockItems: balances.stockItems,
            totalPayables: balances.totalPayables,
            totalReceivables: balances.totalReceivables,
            loadedMonths: { [monthKey]: true },
        }));
        
    } catch (error: any) {
        handleApiError(error);
    } finally {
        setState(prev => ({...prev, isLoading: false}));
    }
  }, [handleApiError, state.user]);

  const login = useCallback(async (credentials: Parameters<typeof serverLogin>[0]) => {
    setState(prev => ({ ...prev, isLoading: true }));
    const result = await serverLogin(credentials);
    if(result.success) {
      if (credentials.rememberMe) {
          localStorage.setItem('rememberedUsername', credentials.username);
      } else {
          localStorage.removeItem('rememberedUsername');
      }
      await reloadData({ needsInitialBalance: result.needsInitialBalance });
    } else {
      setState(prev => ({ ...prev, isLoading: false }));
    }
    return result;
  }, [reloadData]);

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


  useEffect(() => {
    if (!isHydrated) return; // Wait for client state to be loaded
    const checkSessionAndLoad = async () => {
        const session = await getSession();
        if (session) {
            // We have a session, set user from session, keep cached data for now.
            setState(prev => ({ ...prev, user: session, isLoading: false }));
            // Fetch fresh data in the background
            reloadData();
        } else {
            // No session, clear user and stop loading.
            setState(prev => ({...prev, isLoading: false, user: null }));
        }
    };
    
    checkSessionAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated]); // Run only when hydration is complete

  useEffect(() => {
    if (state.isLoading) return; // Don't redirect while loading
    if (pathname === '/login') {
        if(state.user) router.replace('/');
    } else {
        if(!state.user) router.replace('/login');
    }
  }, [pathname, state.user, state.isLoading, router]);
  

  const loadRecycleBinData = useCallback(async () => {
    if(!state.user || state.user.role !== 'admin') return;
    try {
        const results = await Promise.allSettled([
            readDeletedData({ tableName: 'cash_transactions' }),
            readDeletedData({ tableName: 'bank_transactions' }),
            readDeletedData({ tableName: 'stock_transactions' }),
            readDeletedData({ tableName: 'ap_ar_transactions' }),
        ]);

        const [deletedCashData, deletedBankData, deletedStockData, deletedLedgerData] = results.map(r => r.status === 'fulfilled' ? r.value : []);
        
        setState(prev => ({
            ...prev,
            deletedCashTransactions: deletedCashData.sort((a: any, b: any) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime()),
            deletedBankTransactions: deletedBankData.sort((a: any, b: any) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime()),
            deletedStockTransactions: deletedStockData.sort((a: any, b: any) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime()),
            deletedLedgerTransactions: deletedLedgerData.sort((a: any, b: any) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime()),
        }));

    } catch (error: any) {
        handleApiError(error);
    }
  }, [state.user, handleApiError]);

  const loadDataForMonth = useCallback(async (month: Date) => {
    const monthKey = format(month, 'yyyy-MM');
    if (state.loadedMonths[monthKey]) {
        return; // Data for this month is already loaded
    }

    toast.info(`Loading data for ${format(month, 'MMMM yyyy')}...`);

    try {
        const startDate = startOfMonth(month).toISOString();
        const endDate = endOfMonth(month).toISOString();

        const [cashTxs, bankTxs, stockTxs, ledgerData, installmentsData] = await Promise.all([
            readData({ tableName: 'cash_transactions', startDate, endDate }),
            readData({ tableName: 'bank_transactions', startDate, endDate }),
            readData({ tableName: 'stock_transactions', startDate, endDate }),
            readData({ tableName: 'ap_ar_transactions', startDate, endDate }),
            readData({ tableName: 'payment_installments', startDate, endDate }),
        ]);

        // Merge new data with existing data, avoiding duplicates
        const mergeTransactions = (existing: any[], newTxs: any[]) => {
            const existingIds = new Set(existing.map(tx => tx.id));
            const uniqueNewTxs = newTxs.filter(tx => !existingIds.has(tx.id));
            return [...existing, ...uniqueNewTxs];
        };
        
        const allCashTxs = mergeTransactions(state.cashTransactions, cashTxs);
        const allBankTxs = mergeTransactions(state.bankTransactions, bankTxs);
        const allStockTxs = mergeTransactions(state.stockTransactions, stockTxs);

        const newLedgerTxs = (ledgerData || []).map((tx: any) => ({
            ...tx,
            installments: (installmentsData || []).filter((ins: any) => ins.ap_ar_transaction_id === tx.id)
        }));
        const allLedgerTxs = mergeTransactions(state.ledgerTransactions, newLedgerTxs);

        // Balances are fetched separately and are always up-to-date, so no recalculation is needed here.

        setState(prev => ({
            ...prev,
            cashTransactions: allCashTxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            bankTransactions: allBankTxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            stockTransactions: allStockTxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            ledgerTransactions: allLedgerTxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            loadedMonths: { ...prev.loadedMonths, [monthKey]: true },
        }));

    } catch (error) {
        handleApiError(error);
    }
  }, [state.loadedMonths, state.cashTransactions, state.bankTransactions, state.stockTransactions, state.ledgerTransactions, handleApiError]);
  
    const addCashTransaction = async (tx: Omit<CashTransaction, 'id' | 'createdAt' | 'deletedAt'>) => {
        try {
            if(tx.category === 'A/P Settlement' || tx.category === 'A/R Settlement') {
                if(!tx.contact_id) throw new Error("Contact is required for settlements");

                const contactType = tx.category === 'A/P Settlement' ? 'vendor' : 'client';
                const contactList = contactType === 'vendor' ? state.vendors : state.clients;
                const contactName = contactList.find(c => c.id === tx.contact_id)?.name;
                if(!contactName) throw new Error("Contact not found for settlement");
                
                await recordDirectPayment({
                    payment_method: 'cash',
                    date: tx.date,
                    amount: tx.actual_amount,
                    category: tx.category,
                    description: tx.description,
                    contact_id: tx.contact_id,
                    contact_name: contactName
                });
                await reloadData();

            } else {
                const newTx = await appendData({ tableName: 'cash_transactions', data: tx, logDescription: `Added cash transaction: ${tx.description}`, select: '*' });
                if (newTx) {
                    setState(prev => ({
                        ...prev,
                        cashTransactions: [newTx, ...prev.cashTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
                    }));
                }
                await updateBalances();
            }
        } catch (error) {
            handleApiError(error);
        }
    };

    const addBankTransaction = async (tx: Omit<BankTransaction, 'id' | 'createdAt' | 'deletedAt'>) => {
        try {
             if(tx.category === 'A/P Settlement' || tx.category === 'A/R Settlement') {
                if(!tx.contact_id) throw new Error("Contact is required for settlements");

                const contactType = tx.category === 'A/P Settlement' ? 'vendor' : 'client';
                const contactList = contactType === 'vendor' ? state.vendors : state.clients;
                const contactName = contactList.find(c => c.id === tx.contact_id)?.name;
                if(!contactName) throw new Error("Contact not found for settlement");
                
                await recordDirectPayment({
                    payment_method: 'bank',
                    bank_id: tx.bank_id,
                    date: tx.date,
                    amount: tx.actual_amount,
                    category: tx.category,
                    description: tx.description,
                    contact_id: tx.contact_id,
                    contact_name: contactName
                });
                await reloadData();
            } else {
                const newTx = await appendData({ tableName: 'bank_transactions', data: tx, logDescription: `Added bank transaction: ${tx.description}`, select: '*' });
                if (newTx) {
                    setState(prev => ({
                        ...prev,
                        bankTransactions: [newTx, ...prev.bankTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
                    }));
                }
                await updateBalances();
            }
        } catch (error) {
            handleApiError(error);
        }
    };

    const addLedgerTransaction = async (tx: Omit<LedgerTransaction, 'id' | 'createdAt' | 'deletedAt' | 'status' | 'paid_amount' | 'installments'>) => {
        try {
            const dataToSave = { ...tx, status: 'unpaid', paid_amount: 0 };
            const newTx = await appendData({ tableName: 'ap_ar_transactions', data: dataToSave, logDescription: `Added A/P or A/R: ${tx.description}`, select: '*' });
             if (newTx) {
                setState(prev => ({
                    ...prev,
                    ledgerTransactions: [{...newTx, installments: []}, ...prev.ledgerTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
                }));
                await updateBalances();
            }
        } catch (error) {
            handleApiError(error);
        }
    }

  const addStockTransaction = async (tx: Omit<StockTransaction, 'id' | 'createdAt' | 'deletedAt'> & { contact_id?: string, contact_name?: string }, bank_id?: string) => {
    const { contact_id, contact_name, ...stockTxData } = tx;

    try {
      const newStockTx = await appendData({ tableName: 'stock_transactions', data: stockTxData, select: '*' });
      if (!newStockTx) throw new Error("Stock transaction creation failed.");
      
      setState(prev => ({
        ...prev,
        stockTransactions: [newStockTx, ...prev.stockTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      }));

      if (tx.paymentMethod === 'credit' && contact_id) {
          const ledgerType = tx.type === 'purchase' ? 'payable' : 'receivable';
          const description = tx.description || `${tx.type === 'purchase' ? 'Purchase' : 'Sale'} of ${tx.weight}kg of ${tx.stockItemName} on credit`;
          
          let finalContactName = contact_name;
          if (!finalContactName) {
            const contactList = tx.type === 'purchase' ? state.vendors : state.clients;
            finalContactName = contactList.find(c => c.id === contact_id)?.name;
          }
          
          if (!finalContactName) {
            throw new Error(`Could not find a name for the selected ${tx.type === 'purchase' ? 'vendor' : 'client'}.`);
          }
          
          await addLedgerTransaction({
              type: ledgerType,
              description,
              amount: tx.expected_amount, // The credit is for the full expected amount
              date: tx.date,
              contact_id: contact_id,
              contact_name: finalContactName,
          });
      } else {
          const description = tx.description || `${tx.type === 'purchase' ? 'Purchase' : 'Sale'} of ${tx.weight}kg of ${tx.stockItemName}`;
          
          if (tx.paymentMethod === 'cash') {
              const newCashTx = {
                  date: tx.date,
                  expected_amount: tx.expected_amount,
                  actual_amount: tx.actual_amount,
                  difference: tx.difference,
                  difference_reason: tx.difference_reason,
                  description,
                  category: 'Stock Transaction',
                  type: tx.type === 'purchase' ? 'expense' : 'income',
                  linkedStockTxId: newStockTx.id
              };
              const savedCashTx = await appendData({ tableName: 'cash_transactions', data: newCashTx, select: '*' });
              if (savedCashTx) {
                  setState(prev => ({
                      ...prev,
                      cashTransactions: [savedCashTx, ...prev.cashTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
                  }));
              }

          } else if (tx.paymentMethod === 'bank') { 
              if (!bank_id) throw new Error("Bank ID is required for bank payment.");
              const newBankTx = {
                  date: tx.date,
                  expected_amount: tx.expected_amount,
                  actual_amount: tx.actual_amount,
                  difference: tx.difference,
                  difference_reason: tx.difference_reason,
                  description,
                  category: 'Stock Transaction',
                  type: tx.type === 'purchase' ? 'withdrawal' : 'deposit',
                  bank_id: bank_id,
                  linkedStockTxId: newStockTx.id
              };
              const savedBankTx = await appendData({ tableName: 'bank_transactions', data: newBankTx, select: '*' });
              if (savedBankTx) {
                  setState(prev => ({
                      ...prev,
                      bankTransactions: [savedBankTx, ...prev.bankTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
                  }));
              }
          }
      }
      
      await updateBalances();

    } catch (error: any) {
      handleApiError(error)
    }
  };

  const editCashTransaction = async (originalTx: CashTransaction, updatedTxData: Partial<Omit<CashTransaction, 'id' | 'date' | 'createdAt'>>) => {
      try {
        await updateData({ tableName: 'cash_transactions', id: originalTx.id, data: updatedTxData, logDescription: `Edited cash tx: ${originalTx.id}` });
        toast.success("Success", { description: "Cash transaction updated." });
        await reloadData();
      } catch (error) {
            handleApiError(error);
      }
  };

  const editBankTransaction = async (originalTx: BankTransaction, updatedTxData: Partial<Omit<BankTransaction, 'id'| 'date' | 'createdAt'>>) => {
      try {
        await updateData({ tableName: 'bank_transactions', id: originalTx.id, data: updatedTxData, logDescription: `Edited bank tx: ${originalTx.id}` });
        toast.success("Success", { description: "Bank transaction updated."});
        await reloadData();
      } catch(error) {
            handleApiError(error);
      }
  };

  const editStockTransaction = async (originalTx: StockTransaction, updatedTxData: Partial<Omit<StockTransaction, 'id' | 'date' | 'createdAt'>>) => {
      try {
          await updateData({ tableName: 'stock_transactions', id: originalTx.id, data: updatedTxData, logDescription: `Edited stock tx: ${originalTx.id}` });
          
          if (originalTx.paymentMethod === 'cash' || originalTx.paymentMethod === 'bank') {
              const tableName = `${originalTx.paymentMethod}_transactions`;
              const { data: linkedTxs } = await supabase.from(tableName).select('id, linkedStockTxId').eq('linkedStockTxId', originalTx.id);
              const activeLinkedTx = (linkedTxs as any[])?.find(tx => tx.linkedStockTxId === originalTx.id);

              if (activeLinkedTx) {
                  const newAmount = (updatedTxData.weight || originalTx.weight) * (updatedTxData.pricePerKg || originalTx.pricePerKg);
                  const newDescription = `${updatedTxData.type || originalTx.type === 'purchase' ? 'Purchase' : 'Sale'} of ${updatedTxData.weight || originalTx.weight}kg of ${updatedTxData.stockItemName || originalTx.stockItemName}`;
                  await updateData({ tableName, id: activeLinkedTx.id, data: { actual_amount: newAmount, expected_amount: newAmount, description: newDescription } });
              }
          }
          
          toast.success("Success", { 
              description: "Stock transaction and linked financial entry updated.",
              duration: 5000,
          });
          await reloadData();

      } catch(error) {
          handleApiError(error);
      }
  };

  const deleteCashTransaction = (txToDelete: CashTransaction) => {
    deleteData({ tableName: "cash_transactions", id: txToDelete.id, logDescription: `Deleted cash tx: ${txToDelete.id}` })
        .then(() => {
            if (txToDelete.linkedStockTxId) {
                return deleteData({ tableName: "stock_transactions", id: txToDelete.linkedStockTxId, logDescription: `Deleted linked stock tx: ${txToDelete.linkedStockTxId}` });
            }
        })
        .then(() => {
          toast.success("Success", { description: "Cash transaction moved to recycle bin."});
          reloadData();
        })
        .catch((error) => {
            handleApiError(error);
        });
  };

  const deleteBankTransaction = (txToDelete: BankTransaction) => {
    deleteData({ tableName: "bank_transactions", id: txToDelete.id, logDescription: `Deleted bank tx: ${txToDelete.id}` })
        .then(() => {
            if(txToDelete.linkedStockTxId) {
                return deleteData({ tableName: "stock_transactions", id: txToDelete.linkedStockTxId, logDescription: `Deleted linked stock tx: ${txToDelete.linkedStockTxId}` });
            }
        })
        .then(() => {
          toast.success("Success", { description: "Bank transaction moved to recycle bin."});
          reloadData();
        })
        .catch(error => {
            handleApiError(error);
        });
  };
  
  const deleteStockTransaction = (txToDelete: StockTransaction) => {
    deleteData({ tableName: "stock_transactions", id: txToDelete.id, logDescription: `Deleted stock tx: ${txToDelete.id}` })
        .then(async () => {
            const { data: allCashTxs } = await supabase.from('cash_transactions').select('id, deletedAt').eq('linkedStockTxId', txToDelete.id);
            const activeCashTx = allCashTxs?.find(tx => !tx.deletedAt);
            if (activeCashTx) {
                await deleteData({ tableName: "cash_transactions", id: activeCashTx.id });
            }
    
            const { data: allBankTxs } = await supabase.from('bank_transactions').select('id, deletedAt').eq('linkedStockTxId', txToDelete.id);
            const activeBankTx = allBankTxs?.find(tx => !tx.deletedAt);
            if (activeBankTx) {
                await deleteData({ tableName: "bank_transactions", id: activeBankTx.id });
            }

            toast.success("Stock Transaction Deleted", { description: "The corresponding financial entry was also moved to the recycle bin."});
            reloadData();
        })
        .catch(error => {
            handleApiError(error);
        });
  };
  
  const restoreTransaction = async (txType: 'cash' | 'bank' | 'stock' | 'ap_ar', id: string) => {
    const tableName = txType === 'ap_ar' ? 'ap_ar_transactions' : `${txType}_transactions`;
    try {
        await restoreData({ tableName, id });

        if (txType === 'cash' || txType === 'bank') {
            const { data: finTx } = await supabase.from(tableName).select('linkedStockTxId').eq('id', id).maybeSingle();
            if (finTx?.linkedStockTxId) {
                 await restoreData({ tableName: 'stock_transactions', id: finTx.linkedStockTxId });
            }
        }
         
        if (txType === 'stock') {
            const { data: cashTx } = await supabase.from('cash_transactions').select('id, deletedAt').eq('linkedStockTxId', id).maybeSingle();
            if (cashTx) await restoreData({ tableName: 'cash_transactions', id: cashTx.id });

            const { data: bankTx } = await supabase.from('bank_transactions').select('id, deletedAt').eq('linkedStockTxId', id).maybeSingle();
            if (bankTx) await restoreData({ tableName: 'bank_transactions', id: bankTx.id });
        }
        
        toast.success("Transaction Restored", { description: "The item and any linked transactions have been restored." });
        reloadData();
        loadRecycleBinData();
    } catch (error: any) {
        handleApiError(error);
    }
  };

  const emptyRecycleBin = async () => {
    try {
        await serverEmptyRecycleBin();
        toast.success("Recycle Bin Emptied", { description: "All deleted items have been permanently removed."});
        loadRecycleBinData();
    } catch (error: any) {
        handleApiError(error);
    }
  }

  const deleteMultipleCashTransactions = async (txs: CashTransaction[]) => {
     try {
        await Promise.all(txs.map(tx => deleteData({ tableName: "cash_transactions", id: tx.id })));
        toast.success("Success", { description: `${txs.length} cash transaction(s) deleted.`});
        reloadData();
    } catch(error) {
        handleApiError(error);
    }
  };

  const deleteMultipleBankTransactions = async (txs: BankTransaction[]) => {
    try {
        await Promise.all(txs.map(tx => deleteData({ tableName: "bank_transactions", id: tx.id })));
        toast.success("Success", { description: `${txs.length} bank transaction(s) deleted.`});
        reloadData();
    } catch(error) {
        handleApiError(error);
    }
  };

  const deleteMultipleStockTransactions = async (txs: StockTransaction[]) => {
    try {
        await Promise.all(txs.map(tx => deleteData({ tableName: "stock_transactions", id: tx.id })));
        toast.success("Success", { description: `${txs.length} stock transaction(s) deleted.`});
        reloadData();
    } catch(error) {
        handleApiError(error);
    }
  };

  const transferFunds = async (from: 'cash' | 'bank', amount: number, date?: string, bankId?: string, description?: string) => {
     const transactionDate = date || new Date().toISOString();
     
     try {
        if(from === 'cash') {
            if(!bankId) throw new Error("A destination bank account is required.");
            const txDescription = description || 'Transfer to Bank';
            const cashTx = await appendData({ tableName: 'cash_transactions', data: { date: transactionDate, actual_amount: amount, expected_amount: amount, difference: 0, description: txDescription, category: 'Cash Out', type: 'expense' }, select: '*' });
            const bankTx = await appendData({ tableName: 'bank_transactions', data: { date: transactionDate, actual_amount: amount, expected_amount: amount, difference: 0, description: txDescription, category: 'Deposit', type: 'deposit', bank_id: bankId! }, select: '*' });
            setState(prev => ({
              ...prev,
              cashTransactions: [cashTx, ...prev.cashTransactions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
              bankTransactions: [bankTx, ...prev.bankTransactions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            }))

        } else { // from bank
            if(!bankId) throw new Error("A source bank account is required.");
            const txDescription = description || 'Transfer from Bank';
            const bankTx = await appendData({ tableName: 'bank_transactions', data: { date: transactionDate, actual_amount: amount, expected_amount: amount, difference: 0, description: txDescription, category: 'Withdrawal', type: 'withdrawal', bank_id: bankId! }, select: '*' });
            const cashTx = await appendData({ tableName: 'cash_transactions', data: { date: transactionDate, actual_amount: amount, expected_amount: amount, difference: 0, description: txDescription, category: 'Cash In', type: 'income' }, select: '*' });
            setState(prev => ({
              ...prev,
              cashTransactions: [cashTx, ...prev.cashTransactions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
              bankTransactions: [bankTx, ...prev.bankTransactions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            }))
        }
        await updateBalances();
     } catch (error) {
        handleApiError(error);
     }
  };

  const addCategory = async (type: 'cash' | 'bank', category: string, direction: 'credit' | 'debit') => {
    if (!state.user || state.user.role !== 'admin') return;
    try {
      const dataToSave = { name: category, type, direction, is_deletable: true };

      const newCategory = await appendData({ tableName: 'categories', data: dataToSave, logDescription: `Added category: ${category}`, select: '*' });

      if (newCategory) {
          if(type === 'cash') {
              setState(prev => ({...prev, cashCategories: [...prev.cashCategories, newCategory]}));
          } else {
              setState(prev => ({...prev, bankCategories: [...prev.bankCategories, newCategory]}));
          }
          toast.success("Success", { description: "Category added." });
      }
    } catch (error) {
      handleApiError(error);
    }
  };

  const deleteCategory = async (id: string) => {
    if (!state.user || state.user.role !== 'admin') return;
    try {
        const { error } = await supabase
            .from('categories')
            .delete()
            .match({ id: id, is_deletable: true });
        
        if (error) throw error;
      
        setState(prev => ({
          ...prev,
          cashCategories: prev.cashCategories.filter(c => c.id !== id),
          bankCategories: prev.bankCategories.filter(c => c.id !== id),
        }));

      toast.success("Success", { description: "Category deleted." });
    } catch (error) {
      handleApiError(error);
    }
  };

  const setInitialBalances = async (cash: number, bankTotals: Record<string, number>, date: Date) => {
    if (state.user?.role !== 'admin') return;
    try {
        const transactionDate = date.toISOString();
        const cashData = { date: transactionDate, type: 'income' as const, actual_amount: cash, expected_amount: cash, difference: 0, description: 'Initial Balance', category: 'Cash In' };
        
        const bankData = Object.entries(bankTotals).filter(([, amount]) => amount > 0).map(([bankId, amount]) => ({
            date: transactionDate,
            type: 'deposit' as const,
            actual_amount: amount,
            expected_amount: amount,
            difference: 0,
            description: 'Initial Balance',
            category: 'Deposit',
            bank_id: bankId,
        }));
        
        const promises = [];
        if (cash > 0) {
            promises.push(appendData({tableName: 'cash_transactions', data: cashData }));
        }
        if (bankData.length > 0) {
            promises.push(appendData({tableName: 'bank_transactions', data: bankData }));
        }
        
        await Promise.all(promises);
        
        toast.success("Initial balances set.");
        closeInitialBalanceDialog();
        await reloadData();

    } catch (e) {
        handleApiError(e);
    }
  }

  const addInitialStockItem = async (item: { name: string; weight: number; pricePerKg: number }) => {
      try {
        if(state.user?.role !== 'admin') throw new Error("Only admins can add initial stock.");
        const { name, weight, pricePerKg } = item;
        const newItem = await appendData({ tableName: 'initial_stock', data: { name, weight, purchasePricePerKg: pricePerKg }, logDescription: `Added initial stock: ${name}` });
        if(newItem) {
            toast.success("Initial stock item added.");
            await reloadData();
        }
      } catch (e) {
          handleApiError(e);
      }
  }

  const handleExport = async () => {
    try {
      const data = await exportAllData();
      const zip = new JSZip();
      zip.file("ha-mim-iron-mart-backup.json", JSON.stringify(data, null, 2));
      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, `ha-mim-iron-mart-backup-${format(new Date(), 'yyyy-MM-dd')}.zip`);
      toast.success("Export Successful", { description: "Your data has been exported." });
    } catch (error: any) {
      handleApiError(error);
    }
  };

  const handleImport = async (file: File) => {
    if(state.user?.role !== 'admin') {
      toast.error('Permission Denied');
      return;
    }
    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            let jsonString = event.target?.result as string;
            if (file.name.endsWith('.zip')) {
                const zip = await JSZip.loadAsync(file);
                const jsonFile = zip.file("ha-mim-iron-mart-backup.json");
                if (!jsonFile) {
                    throw new Error("Backup JSON file not found in the zip archive.");
                }
                jsonString = await jsonFile.async("string");
            }
            const data = JSON.parse(jsonString);
            
            const requiredTables = ['cash_transactions', 'bank_transactions', 'stock_transactions', 'initial_stock', 'categories'];
            for(const table of requiredTables) {
                if(!Array.isArray(data[table])) {
                    throw new Error(`Invalid backup file format. Missing or invalid '${table}' data.`);
                }
            }

            await batchImportData(data);
            toast.success("Import Successful", { description: "Your data has been restored from backup." });
            await reloadData();

        } catch (error: any) {
            handleApiError(error);
        }
    };
    reader.readAsText(file);
  };
  
  const handleDeleteAllData = async () => {
     if(state.user?.role !== 'admin') {
      toast.error('Permission Denied');
      return;
    }
    try {
        await deleteAllData();
        toast.success('All Data Deleted', { description: 'Your account and all associated data have been permanently removed.' });
        logout();
    } catch (error: any) {
        handleApiError(error);
    }
  };

  const addVendor = async (name: string) => {
    if (!state.user || state.user.role !== 'admin') {
        toast.error('Permission Denied');
        return null;
    }
    try {
      const newVendor = await appendData({ tableName: 'vendors', data: { name }, select: '*', logDescription: `Added vendor: ${name}` });
      if (!newVendor) {
        toast.error('Setup Incomplete', { description: "Could not save to the 'vendors' table. Please ensure it exists in your database." });
        return null;
      }
      setState(prev => ({...prev, vendors: [...prev.vendors, newVendor]}));
      toast.success('Vendor Added');
      return newVendor;
    } catch (error: any) {
      handleApiError(error);
      return null;
    }
  }

  const addClient = async (name: string) => {
    if (!state.user || state.user.role !== 'admin') {
        toast.error('Permission Denied');
        return null;
    }
    try {
      const newClient = await appendData({
        tableName: 'clients',
        data: { name },
        select: '*',
        logDescription: `Added client: ${name}`,
      });
      if (!newClient) {
        toast.error(
          'Setup Incomplete',
          {description: "Could not save to the 'clients' table. Please ensure it exists.",}
        );
        return null;
      }
      setState(prev => ({...prev, clients: [...prev.clients, newClient]}));
      toast.success('Client Added');
      return newClient;
    } catch (error: any) {
      handleApiError(error);
      return null;
    }
  };

  const addBank = async (name: string) => {
    if (!state.user || state.user.role !== 'admin') {
      toast.error('Permission Denied');
      return;
    }
    try {
        const newBank = await appendData({
            tableName: 'banks',
            data: { name },
            select: '*',
            logDescription: `Added bank: ${name}`,
        });
        if (!newBank) {
            toast.error(
                'Setup Incomplete',
                {description: 'Could not save to the "banks" table. Please ensure it exists.'}
            );
            return;
        }
        setState(prev => ({ ...prev, banks: [...prev.banks, newBank] }));
        toast.success('Bank Added');
    } catch (error: any) {
        handleApiError(error);
    }
  }

  const deleteLedgerTransaction = (txToDelete: LedgerTransaction) => {
    if (!state.user || state.user.role !== 'admin') {
        toast.error('Permission Denied', { description: 'Only admins can delete transactions.' });
        return;
    }

    deleteData({ tableName: 'ap_ar_transactions', id: txToDelete.id, logDescription: `Deleted ledger tx: ${txToDelete.id}` })
      .then(() => {
        toast.success('Transaction moved to recycle bin.');
        reloadData();
      })
      .catch(error => {
          handleApiError(error);
      });
  }
  
  const recordPayment = async (contactId: string, contactName: string, paymentAmount: number, paymentMethod: 'cash' | 'bank', paymentDate: Date, ledgerType: 'payable' | 'receivable', bankId?: string) => {
    if (state.user?.role !== 'admin') {
      toast.error('Permission Denied');
      return;
    }
    try {
        if(paymentMethod === 'bank' && !bankId) {
            throw new Error("Please select a bank account for this payment.");
        }
        await recordPaymentAgainstTotal({
            contact_id: contactId,
            contact_name: contactName,
            payment_amount: paymentAmount,
            payment_date: paymentDate.toISOString(),
            payment_method: paymentMethod,
            ledger_type: ledgerType,
            bank_id: bankId,
        });

        toast.success("Payment Recorded", { description: "The payment has been recorded and balances are updating."});
        await reloadData();
        
    } catch (error: any) {
         handleApiError(new Error(error.message || "An unexpected error occurred during payment recording."));
         throw error;
    }
  }

  const setFontSize = (size: FontSize) => {
    setState(prev => ({ ...prev, fontSize: size }));
  };

  const setWastagePercentage = (percentage: number) => {
    setState(prev => ({ ...prev, wastagePercentage: percentage }));
  };

  const setCurrency = (currency: string) => {
    setState(prev => ({ ...prev, currency }));
  };

  const setShowStockValue = (show: boolean) => {
    setState(prev => ({ ...prev, showStockValue: show }));
  };
  
  if (!isHydrated) {
    // Render a static loading state on the server and during initial client render
    return <div />;
  }

  return (
    <AppContext.Provider value={{ 
        ...state, 
        reloadData,
        loadRecycleBinData,
        loadDataForMonth,
        addCashTransaction, 
        addBankTransaction,
        addStockTransaction,
        editCashTransaction,
        editBankTransaction,
        editStockTransaction,
        deleteCashTransaction,
        deleteBankTransaction,
        deleteStockTransaction,
        deleteMultipleCashTransactions,
        deleteMultipleBankTransactions,
        deleteMultipleStockTransactions,
        deleteLedgerTransaction,
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
        handleExport,
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
