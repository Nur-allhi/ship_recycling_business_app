
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import type { CashTransaction, BankTransaction, StockItem, StockTransaction, User, Vendor, Client, LedgerTransaction, PaymentInstallment, Bank, Category } from '@/lib/types';
import { toast } from 'sonner';
import { readData, appendData, updateData, deleteData, readDeletedData, restoreData, exportAllData, batchImportData, deleteAllData, logout as serverLogout, recordPaymentAgainstTotal, recordDirectPayment } from '@/app/actions';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { getSession } from '@/lib/auth';
import { useRouter, usePathname } from 'next/navigation';
import { AppLoading } from '@/components/app-loading';


type FontSize = 'sm' | 'base' | 'lg';

interface DataStatus {
    cash: boolean;
    bank: boolean;
    stock: boolean;
    credit: boolean;
    settings: boolean;
}

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
  initialBalanceSet: boolean;
  needsInitialBalance: boolean;
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
  dataLoaded: DataStatus;
}

interface AppContextType extends AppState {
  reloadData: (options?: { force?: boolean }) => Promise<void>;
  loadDataForTab: (tab: 'cash' | 'bank' | 'stock' | 'credit' | 'settings') => Promise<void>;
  loadRecycleBinData: () => Promise<void>;
  addCashTransaction: (tx: Omit<CashTransaction, 'id' | 'createdAt' | 'deletedAt'>) => Promise<void>;
  addBankTransaction: (tx: Omit<BankTransaction, 'id' | 'createdAt' | 'deletedAt'>, contactId?: string, contactName?: string) => Promise<void>;
  addStockTransaction: (tx: Omit<StockTransaction, 'id' | 'createdAt' | 'deletedAt'> & { contact_id?: string, contact_name?: string }) => Promise<void>;
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
  transferFunds: (from: 'cash' | 'bank', amount: number, date?: string, bankId?: string) => Promise<void>;
  addCategory: (type: 'cash' | 'bank', category: string, direction: 'credit' | 'debit') => void;
  deleteCategory: (id: string) => void;
  setFontSize: (size: FontSize) => void;
  setWastagePercentage: (percentage: number) => void;
  setCurrency: (currency: string) => void;
  setShowStockValue: (show: boolean) => void;
  setInitialBalances: (cash: number, bankTotals: Record<string, number>) => void;
  addInitialStockItem: (item: { name: string; weight: number; pricePerKg: number }) => void;
  handleExport: () => void;
  handleImport: (file: File) => void;
  handleDeleteAllData: () => void;
  logout: () => void;
  addVendor: (name: string) => Promise<any>;
  addClient: (name: string) => Promise<any>;
  addBank: (name: string) => Promise<void>;
  addLedgerTransaction: (tx: Omit<LedgerTransaction, 'id' | 'createdAt' | 'deletedAt' | 'status' | 'paid_amount' | 'installments'>) => Promise<void>;
  recordPayment: (contactId: string, contactName: string, paymentAmount: number, paymentMethod: 'cash' | 'bank', paymentDate: Date, ledgerType: 'payable' | 'receivable', bankId?: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const initialAppState: AppState = {
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
  initialBalanceSet: false,
  needsInitialBalance: false,
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
  dataLoaded: {
    cash: false,
    bank: false,
    stock: false,
    credit: false,
    settings: false,
  },
};

const getCacheKey = (userId: string | null) => `ha-mim-iron-mart-cache-${userId || 'guest'}`;

const getInitialState = (): AppState => {
    let state = { ...initialAppState, initialBalanceSet: false, isLoading: true };
    if (typeof window === 'undefined') return state;
    
    try {
        const storedSettings = localStorage.getItem('ha-mim-iron-mart-settings');
        if (storedSettings) {
            const settings = JSON.parse(storedSettings);
            state = { ...state, ...settings };
        }
        
    } catch (e) {
        console.error("Could not parse data from local storage", e);
    }
    return state;
}

const saveStateToLocalStorage = (state: AppState) => {
    if (typeof window === 'undefined' || !state.user) return;
    try {
        const settingsToSave = {
            fontSize: state.fontSize,
            wastagePercentage: state.wastagePercentage,
            currency: state.currency,
            showStockValue: state.showStockValue,
        };
        localStorage.setItem('ha-mim-iron-mart-settings', JSON.stringify(settingsToSave));

        const appStateToCache = {
            cashBalance: state.cashBalance,
            bankBalance: state.bankBalance,
            initialStockItems: state.initialStockItems,
            stockItems: state.stockItems,
            cashCategories: state.cashCategories,
            bankCategories: state.bankCategories,
            vendors: state.vendors,
            clients: state.clients,
            totalPayables: state.totalPayables,
            totalReceivables: state.totalReceivables,
            banks: state.banks,
            cashTransactions: state.dataLoaded.cash ? state.cashTransactions : [],
            bankTransactions: state.dataLoaded.bank ? state.bankTransactions : [],
            stockTransactions: state.dataLoaded.stock ? state.stockTransactions : [],
            ledgerTransactions: state.dataLoaded.credit ? state.ledgerTransactions : [],
            deletedCashTransactions: state.deletedCashTransactions,
            deletedBankTransactions: state.deletedBankTransactions,
            deletedStockTransactions: state.deletedStockTransactions,
            deletedLedgerTransactions: state.deletedLedgerTransactions,
        };
        localStorage.setItem(getCacheKey(state.user.id), JSON.stringify(appStateToCache));

    } catch (e) {
        console.error("Could not save state to local storage", e);
    }
}

const FIXED_CASH_CATEGORIES = [
    { name: 'Stock Purchase', direction: 'debit', is_deletable: false },
    { name: 'Stock Sale', direction: 'credit', is_deletable: false },
    { name: 'Utilities', direction: 'debit', is_deletable: false },
    { name: 'Operational', direction: 'debit', is_deletable: false },
    { name: 'Transfer', direction: null, is_deletable: false },
    { name: 'Initial Balance', direction: 'credit', is_deletable: false },
];

const FIXED_BANK_CATEGORIES = [
    { name: 'Deposit', direction: 'credit', is_deletable: false },
    { name: 'Withdrawal', direction: 'debit', is_deletable: false },
    { name: 'Stock Purchase', direction: 'debit', is_deletable: false },
    { name: 'Stock Sale', direction: 'credit', is_deletable: false },
    { name: 'A/P Settlement', direction: 'debit', is_deletable: false },
    { name: 'A/R Settlement', direction: 'credit', is_deletable: false },
    { name: 'Transfer', direction: null, is_deletable: false },
    { name: 'Initial Balance', direction: 'credit', is_deletable: false },
];


export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(getInitialState());
  const [isMounted, setIsMounted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const logout = useCallback(async () => {
    if (state.user) {
        localStorage.removeItem(getCacheKey(state.user.id));
    }
    await serverLogout();
    localStorage.removeItem('ha-mim-iron-mart-settings');
    setState({...initialAppState, user: null, isLoading: false});
    window.location.href = '/login';
  }, [state.user]);

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
  
  const calculateBalancesAndStock = useCallback((
    cashTxs: CashTransaction[], 
    bankTxs: BankTransaction[],
    stockTxs: StockTransaction[],
    initialStock: StockItem[],
  ) => {
      const finalCashBalance = cashTxs.reduce((acc, tx) => acc + (tx.type === 'income' ? tx.amount : -tx.amount), 0);
      const finalBankBalance = bankTxs.reduce((acc, tx) => acc + (tx.type === 'deposit' ? tx.amount : -tx.amount), 0);
        
      const stockPortfolio: Record<string, { weight: number, totalValue: number }> = {};

      initialStock.forEach(item => {
          if (!stockPortfolio[item.name]) {
              stockPortfolio[item.name] = { weight: 0, totalValue: 0 };
          }
          stockPortfolio[item.name].weight += item.weight;
          stockPortfolio[item.name].totalValue += item.weight * item.purchasePricePerKg;
      });

      const sortedStockTransactions = [...stockTxs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      sortedStockTransactions.forEach(tx => {
          if (!stockPortfolio[tx.stockItemName]) {
              stockPortfolio[tx.stockItemName] = { weight: 0, totalValue: 0 };
          }
          
          const item = stockPortfolio[tx.stockItemName];
          const currentAvgPrice = item.weight > 0 ? item.totalValue / item.weight : 0;

          if (tx.type === 'purchase') {
              item.weight += tx.weight;
              item.totalValue += tx.weight * tx.pricePerKg;
          } else { // sale
              item.weight -= tx.weight;
              item.totalValue -= tx.weight * currentAvgPrice;
          }
      });

      const aggregatedStockItems: StockItem[] = Object.entries(stockPortfolio).map(([name, data], index) => ({
          id: `stock-agg-${index}`,
          name,
          weight: data.weight,
          purchasePricePerKg: data.weight > 0 ? data.totalValue / data.weight : 0,
      }));

      return { finalCashBalance, finalBankBalance, aggregatedStockItems };
  }, []);
  
  const reloadData = useCallback(async (options?: { force?: boolean }) => {
    const session = await getSession();
    if (!session) return;
    if (!options?.force && state.initialBalanceSet && state.user?.id === session.id) return;

    setState(prev => ({ ...prev, isLoading: true }));
    try {
        const [
            initialStockData,
            categoriesData,
            vendorsData,
            clientsData,
            banksData,
            cashData, 
            bankData,
            stockTransactionsData,
            ledgerData,
            installmentsData,
        ] = await Promise.all([
            readData({ tableName: 'initial_stock' }),
            readData({ tableName: 'categories' }),
            readData({ tableName: 'vendors' }),
            readData({ tableName: 'clients' }),
            readData({ tableName: 'banks' }),
            readData({ tableName: 'cash_transactions' }),
            readData({ tableName: 'bank_transactions' }),
            readData({ tableName: 'stock_transactions' }),
            readData({ tableName: 'ap_ar_transactions' }),
            readData({ tableName: 'payment_installments' }),
        ]);

        const cashTransactions: CashTransaction[] = cashData || [];
        const bankTransactions: BankTransaction[] = bankData || [];
        const stockTransactions: StockTransaction[] = stockTransactionsData || [];
        const initialStockItems: StockItem[] = initialStockData || [];
        
        const allLedgerData: LedgerTransaction[] = (ledgerData || []).map((tx: any) => ({
            ...tx,
            installments: (installmentsData || []).filter((ins: any) => ins.ap_ar_transaction_id === tx.id)
        }));

        const needsInitialBalance = cashTransactions.length === 0 && bankTransactions.length === 0 && initialStockItems.length === 0;
        
        const { finalCashBalance, finalBankBalance, aggregatedStockItems } = calculateBalancesAndStock(cashTransactions, bankTransactions, stockTransactions, initialStockItems);
        
        const dbCashCategories: Category[] = (categoriesData || []).filter((c: any) => c.type === 'cash');
        const dbBankCategories: Category[] = (categoriesData || []).filter((c: any) => c.type === 'bank');
        
        setState(prev => ({
            ...prev,
            cashTransactions: cashTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            bankTransactions: bankTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            stockTransactions: stockTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            ledgerTransactions: allLedgerData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            dataLoaded: { cash: true, bank: true, stock: true, credit: true, settings: false },

            initialStockItems: initialStockItems,
            stockItems: aggregatedStockItems,
            cashBalance: finalCashBalance,
            bankBalance: finalBankBalance,
            needsInitialBalance,
            cashCategories: [...FIXED_CASH_CATEGORIES, ...dbCashCategories],
            bankCategories: [...FIXED_BANK_CATEGORIES, ...dbBankCategories],
            initialBalanceSet: true,
            vendors: vendorsData || [],
            clients: clientsData || [],
            totalPayables: allLedgerData.filter((tx: any) => tx.type === 'payable' && tx.status !== 'paid').reduce((acc: number, tx: any) => acc + (tx.amount - tx.paid_amount), 0),
            totalReceivables: allLedgerData.filter((tx: any) => tx.type === 'receivable' && tx.status !== 'paid').reduce((acc: number, tx: any) => acc + (tx.amount - tx.paid_amount), 0),
            banks: banksData || [],
            user: session
        }));
      } catch (error: any) {
        console.error("Failed to load data during promise resolution:", error);
        handleApiError(error);
      } finally {
        setState(prev => ({...prev, isLoading: false}));
      }
  }, [calculateBalancesAndStock, handleApiError, state.initialBalanceSet, state.user?.id]);


  const loadDataForTab = useCallback(async (tab: 'cash' | 'bank' | 'stock' | 'credit' | 'settings') => {
    // This function can be used for explicit reloads, but initial load is now handled by reloadData
    if (state.dataLoaded[tab]) return;

    try {
        let needsFullReload = false;
        switch(tab) {
            case 'cash':
                if (!state.dataLoaded.cash) needsFullReload = true;
                break;
            case 'bank':
                if (!state.dataLoaded.bank) needsFullReload = true;
                break;
            case 'stock':
                 if (!state.dataLoaded.stock) needsFullReload = true;
                break;
             case 'credit':
                if (!state.dataLoaded.credit) needsFullReload = true;
                break;
        }

        if (needsFullReload) {
            await reloadData({ force: true });
        }
    } catch(e) {
        handleApiError(e);
    }
  }, [state.dataLoaded, handleApiError, reloadData]);


  useEffect(() => {
    const checkSessionAndLoadData = async () => {
        const session = await getSession();
        if (session) {
            if (pathname === '/login') {
                router.replace('/');
            }
            if (state.user?.id !== session.id || !state.initialBalanceSet) {
                 await reloadData({ force: true });
            }
        } else {
            if (pathname !== '/login') {
                router.replace('/login');
            }
        }
        if (state.isLoading) {
            setState(prev => ({ ...prev, isLoading: false }));
        }
    };

    if (isMounted) {
      checkSessionAndLoadData();
    }
  }, [pathname, isMounted, router, reloadData, state.user?.id, state.initialBalanceSet]);
  
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
  
    const addCashTransaction = async (tx: Omit<CashTransaction, 'id' | 'createdAt' | 'deletedAt'>) => {
        const tempId = `temp-${Date.now()}`;
        const newTxForUI: CashTransaction = { ...tx, id: tempId, createdAt: new Date().toISOString() };

        setState(prev => {
            const newTxs = [newTxForUI, ...prev.cashTransactions];
            const { finalCashBalance } = calculateBalancesAndStock(newTxs, prev.bankTransactions, prev.stockTransactions, prev.initialStockItems);
            return {
                ...prev,
                cashTransactions: newTxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
                cashBalance: finalCashBalance,
            };
        });

        try {
            const savedTx = await appendData({ tableName: 'cash_transactions', data: tx, select: '*' });
            setState(prev => {
                const newTxs = prev.cashTransactions.map(t => t.id === tempId ? savedTx : t);
                return { ...prev, cashTransactions: newTxs };
            });
        } catch (error) {
            toast.error('Failed to save cash transaction.');
            setState(prev => ({ ...prev, cashTransactions: prev.cashTransactions.filter(t => t.id !== tempId)}));
            handleApiError(error);
        }
    };

    const addBankTransaction = async (tx: Omit<BankTransaction, 'id' | 'createdAt' | 'deletedAt'>, contactId?: string, contactName?: string) => {
        if ((tx.category === 'A/R Settlement' || tx.category === 'A/P Settlement') && contactId && contactName) {
            await recordDirectPayment({
                payment_method: 'bank',
                bank_id: tx.bank_id,
                date: tx.date,
                amount: tx.amount,
                category: tx.category,
                description: tx.description,
                contact_id: contactId,
                contact_name: contactName,
            });
            reloadData({ force: true });
            return;
        }

        const tempId = `temp-${Date.now()}`;
        const newTxForUI: BankTransaction = { ...tx, id: tempId, createdAt: new Date().toISOString() };

        setState(prev => {
            const newTxs = [newTxForUI, ...prev.bankTransactions];
            const { finalBankBalance } = calculateBalancesAndStock(prev.cashTransactions, newTxs, prev.stockTransactions, prev.initialStockItems);
            return {
                ...prev,
                bankTransactions: newTxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
                bankBalance: finalBankBalance,
            };
        });

        try {
            const savedTx = await appendData({ tableName: 'bank_transactions', data: tx, select: '*' });
             setState(prev => {
                const newTxs = prev.bankTransactions.map(t => t.id === tempId ? savedTx : t);
                 return { ...prev, bankTransactions: newTxs };
            });
        } catch (error) {
            toast.error('Failed to save bank transaction.');
            setState(prev => ({...prev, bankTransactions: prev.bankTransactions.filter(t => t.id !== tempId)}));
            handleApiError(error);
        }
    };

    const addLedgerTransaction = async (tx: Omit<LedgerTransaction, 'id' | 'createdAt' | 'deletedAt' | 'status' | 'paid_amount' | 'installments'>) => {
        const tempId = `temp-${Date.now()}`;
        const newTxForUI: LedgerTransaction = { ...tx, id: tempId, createdAt: new Date().toISOString(), status: 'unpaid', paid_amount: 0, installments: [] };
        
        setState(prev => {
            const newLedgerTxs = [newTxForUI, ...prev.ledgerTransactions];
            const totalPayables = newLedgerTxs.filter(t => t.type === 'payable' && t.status !== 'paid').reduce((acc, t) => acc + (t.amount - t.paid_amount), 0);
            const totalReceivables = newLedgerTxs.filter(t => t.type === 'receivable' && t.status !== 'paid').reduce((acc, t) => acc + (t.amount - t.paid_amount), 0);
            return {
                ...prev,
                ledgerTransactions: newLedgerTxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
                totalPayables,
                totalReceivables
            };
        });

        try {
            const savedTxData = { ...tx, status: 'unpaid', paid_amount: 0 };
            const savedTx = await appendData({ tableName: 'ap_ar_transactions', data: savedTxData, select: '*, installments:payment_installments(*)' });
            
            if (savedTx && !savedTx.installments) {
                savedTx.installments = [];
            }

            setState(prev => {
                const newLedgerTxs = prev.ledgerTransactions.map(t => t.id === tempId ? savedTx : t);
                return { ...prev, ledgerTransactions: newLedgerTxs };
            });
        } catch (error) {
            toast.error('Failed to save ledger transaction.');
            setState(prev => ({...prev, ledgerTransactions: prev.ledgerTransactions.filter(t => t.id !== tempId)}));
            handleApiError(error);
        }
    }

  const addStockTransaction = async (tx: Omit<StockTransaction, 'id' | 'createdAt' | 'deletedAt'> & { contact_id?: string, contact_name?: string }) => {
    const { contact_id, contact_name, ...stockTxData } = tx;
    const tempId = `temp-${Date.now()}`;
    const newTxForUI: StockTransaction = { ...stockTxData, id: tempId, createdAt: new Date().toISOString() };
    
    setState(prev => {
        const newStockTxs = [newTxForUI, ...prev.stockTransactions];
        const { aggregatedStockItems } = calculateBalancesAndStock(prev.cashTransactions, prev.bankTransactions, newStockTxs, prev.initialStockItems);
        return {
            ...prev,
            stockTransactions: newStockTxs.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            stockItems: aggregatedStockItems
        };
    });


    try {
      const newStockTx = await appendData({ tableName: 'stock_transactions', data: stockTxData, select: '*' });
      if (!newStockTx) throw new Error("Stock transaction creation failed. The 'stock_transactions' table may not exist.");
      
       setState(prev => {
            const newStockTxs = prev.stockTransactions.map(t => t.id === tempId ? newStockTx : t);
            return { ...prev, stockTransactions: newStockTxs };
       });

      const totalValue = tx.weight * tx.pricePerKg;

      if (tx.paymentMethod === 'credit' && contact_id) {
          const ledgerType = tx.type === 'purchase' ? 'payable' : 'receivable';
          const description = `${tx.type === 'purchase' ? 'Purchase' : 'Sale'} of ${tx.weight}kg of ${tx.stockItemName} on credit`;
          
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
              amount: totalValue,
              date: tx.date,
              contact_id: contact_id,
              contact_name: finalContactName,
          });
      } else {
          const description = `${tx.type === 'purchase' ? 'Purchase' : 'Sale'} of ${tx.weight}kg of ${tx.stockItemName}`;
          
          if (tx.paymentMethod === 'cash') {
              const category = tx.type === 'purchase' ? 'Stock Purchase' : 'Stock Sale';
              await addCashTransaction({ date: tx.date, amount: totalValue, description, category, type: tx.type === 'purchase' ? 'expense' : 'income', linkedStockTxId: newStockTx.id });
          } else if (tx.paymentMethod === 'bank') { 
              const category = tx.type === 'purchase' ? 'Stock Purchase' : 'Stock Sale';
              await addBankTransaction({ date: tx.date, amount: totalValue, description, category, type: tx.type === 'purchase' ? 'withdrawal' : 'deposit', bank_id: tx.bank_id!, linkedStockTxId: newStockTx.id });
          }
      }
      
      toast.success("Success", { description: "Stock transaction recorded."});
      reloadData({ force: true });
    } catch (error: any) {
       setState(prev => {
            const newStockTxs = prev.stockTransactions.filter(t => t.id !== tempId);
            const { aggregatedStockItems } = calculateBalancesAndStock(prev.cashTransactions, prev.bankTransactions, newStockTxs, prev.initialStockItems);
             return {
                ...prev,
                stockTransactions: newStockTxs,
                stockItems: aggregatedStockItems
            };
       });
      handleApiError(error)
    }
  };

  const editCashTransaction = async (originalTx: CashTransaction, updatedTxData: Partial<Omit<CashTransaction, 'id' | 'date' | 'createdAt'>>) => {
      const updatedTx = { ...originalTx, ...updatedTxData, lastEdited: new Date().toISOString() };
      
      setState(prev => {
          const newTxs = prev.cashTransactions.map(tx => tx.id === originalTx.id ? updatedTx : tx);
          const { finalCashBalance, aggregatedStockItems } = calculateBalancesAndStock(newTxs, prev.bankTransactions, prev.stockTransactions, prev.initialStockItems);
          return { ...prev, cashTransactions: newTxs, cashBalance: finalCashBalance, stockItems: aggregatedStockItems };
      });
      
      try {
        await updateData({ tableName: 'cash_transactions', id: originalTx.id, data: updatedTxData });
        toast.success("Success", { description: "Cash transaction updated." });
        reloadData({ force: true });
      } catch (error) {
            handleApiError(error);
            setState(prev => {
                const newTxs = prev.cashTransactions.map(tx => tx.id === originalTx.id ? originalTx : tx);
                const { finalCashBalance, aggregatedStockItems } = calculateBalancesAndStock(newTxs, prev.bankTransactions, prev.stockTransactions, prev.initialStockItems);
                return { ...prev, cashTransactions: newTxs, cashBalance: finalCashBalance, stockItems: aggregatedStockItems };
            });
      }
  };

  const editBankTransaction = async (originalTx: BankTransaction, updatedTxData: Partial<Omit<BankTransaction, 'id'| 'date' | 'createdAt'>>) => {
      const updatedTx = { ...originalTx, ...updatedTxData, lastEdited: new Date().toISOString() };
      
      setState(prev => {
          const newTxs = prev.bankTransactions.map(tx => tx.id === originalTx.id ? updatedTx : tx);
          const { finalBankBalance, aggregatedStockItems } = calculateBalancesAndStock(prev.cashTransactions, newTxs, prev.stockTransactions, prev.initialStockItems);
          return { ...prev, bankTransactions: newTxs, bankBalance: finalBankBalance, stockItems: aggregatedStockItems };
      });

      try {
        await updateData({ tableName: 'bank_transactions', id: originalTx.id, data: updatedTxData });
        toast.success("Success", { description: "Bank transaction updated."});
        reloadData({ force: true });
      } catch(error) {
            handleApiError(error);
            setState(prev => {
                const newTxs = prev.bankTransactions.map(tx => tx.id === originalTx.id ? originalTx : tx);
                const { finalBankBalance, aggregatedStockItems } = calculateBalancesAndStock(prev.cashTransactions, newTxs, prev.stockTransactions, prev.initialStockItems);
                return { ...prev, bankTransactions: newTxs, bankBalance: finalBankBalance, stockItems: aggregatedStockItems };
            });
      }
  };

  const editStockTransaction = async (originalTx: StockTransaction, updatedTxData: Partial<Omit<StockTransaction, 'id' | 'date' | 'createdAt'>>) => {
      const updatedTx = { ...originalTx, ...updatedTxData, lastEdited: new Date().toISOString() };
      
      setState(prev => {
          const newTxs = prev.stockTransactions.map(tx => tx.id === originalTx.id ? updatedTx : tx);
          const { aggregatedStockItems } = calculateBalancesAndStock(prev.cashTransactions, prev.bankTransactions, newTxs, prev.initialStockItems);
          return { ...prev, stockTransactions: newTxs, stockItems: aggregatedStockItems };
      });
      
      try {
          await updateData({ tableName: 'stock_transactions', id: originalTx.id, data: updatedTxData });
          
          if (originalTx.paymentMethod === 'cash' || originalTx.paymentMethod === 'bank') {
              const tableName = `${originalTx.paymentMethod}_transactions`;
              const { data: linkedTxs } = await readData({ tableName, select: `id, linkedStockTxId`});
              const activeLinkedTx = (linkedTxs as any[])?.find(tx => tx.linkedStockTxId === originalTx.id);

              if (activeLinkedTx) {
                  const newAmount = updatedTx.weight * updatedTx.pricePerKg;
                  const newDescription = `${updatedTx.type === 'purchase' ? 'Purchase' : 'Sale'} of ${updatedTx.weight}kg of ${updatedTx.stockItemName}`;
                  await updateData({ tableName, id: activeLinkedTx.id, data: { amount: newAmount, description: newDescription } });
              }
          }
          
          toast.success("Success", { 
              description: "Stock transaction and linked financial entry updated.",
              duration: 5000,
          });
          reloadData({ force: true });

      } catch(error) {
          handleApiError(error);
          setState(prev => {
              const newTxs = prev.stockTransactions.map(tx => tx.id === originalTx.id ? originalTx : tx);
              const { aggregatedStockItems } = calculateBalancesAndStock(prev.cashTransactions, prev.bankTransactions, newTxs, prev.initialStockItems);
              return { ...prev, stockTransactions: newTxs, stockItems: aggregatedStockItems };
          });
      }
  };

  const deleteCashTransaction = (txToDelete: CashTransaction) => {
    const originalTxs = state.cashTransactions;
    setState(prev => {
        const newTxs = prev.cashTransactions.filter(tx => tx.id !== txToDelete.id);
        const { finalCashBalance, aggregatedStockItems } = calculateBalancesAndStock(newTxs, prev.bankTransactions, prev.stockTransactions, prev.initialStockItems);
        return { ...prev, cashTransactions: newTxs, cashBalance: finalCashBalance, stockItems: aggregatedStockItems };
    });

    deleteData({ tableName: "cash_transactions", id: txToDelete.id })
        .then(() => {
            if (txToDelete.linkedStockTxId) {
                return deleteData({ tableName: "stock_transactions", id: txToDelete.linkedStockTxId });
            }
        })
        .then(() => {
          toast.success("Success", { description: "Cash transaction moved to recycle bin."});
          reloadData({ force: true });
        })
        .catch((error) => {
            handleApiError(error);
            setState(prev => ({...prev, cashTransactions: originalTxs}));
        });
  };

  const deleteBankTransaction = (txToDelete: BankTransaction) => {
    const originalTxs = state.bankTransactions;
    setState(prev => {
        const newTxs = prev.bankTransactions.filter(tx => tx.id !== txToDelete.id);
        const { finalBankBalance, aggregatedStockItems } = calculateBalancesAndStock(prev.cashTransactions, newTxs, prev.stockTransactions, prev.initialStockItems);
        return { ...prev, bankTransactions: newTxs, bankBalance: finalBankBalance, stockItems: aggregatedStockItems };
    });

    deleteData({ tableName: "bank_transactions", id: txToDelete.id })
        .then(() => {
            if(txToDelete.linkedStockTxId) {
                return deleteData({ tableName: "stock_transactions", id: txToDelete.linkedStockTxId });
            }
        })
        .then(() => {
          toast.success("Success", { description: "Bank transaction moved to recycle bin."});
          reloadData({ force: true });
        })
        .catch(error => {
            handleApiError(error);
            setState(prev => ({...prev, bankTransactions: originalTxs}));
        });
  };
  
  const deleteStockTransaction = (txToDelete: StockTransaction) => {
     const originalTxs = state.stockTransactions;
    setState(prev => {
        const newTxs = prev.stockTransactions.filter(tx => tx.id !== txToDelete.id);
        const { aggregatedStockItems } = calculateBalancesAndStock(prev.cashTransactions, prev.bankTransactions, newTxs, prev.initialStockItems);
        return { ...prev, stockTransactions: newTxs, stockItems: aggregatedStockItems };
    });
    
    deleteData({ tableName: "stock_transactions", id: txToDelete.id })
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
            reloadData({ force: true });
        })
        .catch(error => {
            handleApiError(error);
            setState(prev => ({...prev, stockTransactions: originalTxs}));
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
        reloadData({ force: true });
        loadRecycleBinData();
    } catch (error: any) {
        handleApiError(error);
    }
  };

  const deleteMultipleCashTransactions = async (txs: CashTransaction[]) => {
     try {
        await Promise.all(txs.map(tx => deleteData({ tableName: "cash_transactions", id: tx.id })));
        toast.success("Success", { description: `${txs.length} cash transaction(s) deleted.`});
        reloadData({ force: true });
    } catch(error) {
        handleApiError(error);
    }
  };

  const deleteMultipleBankTransactions = async (txs: BankTransaction[]) => {
    try {
        await Promise.all(txs.map(tx => deleteData({ tableName: "bank_transactions", id: tx.id })));
        toast.success("Success", { description: `${txs.length} bank transaction(s) deleted.`});
        reloadData({ force: true });
    } catch(error) {
        handleApiError(error);
    }
  };

  const deleteMultipleStockTransactions = async (txs: StockTransaction[]) => {
    try {
        await Promise.all(txs.map(tx => deleteData({ tableName: "stock_transactions", id: tx.id })));
        toast.success("Success", { description: `${txs.length} stock transaction(s) deleted.`});
        reloadData({ force: true });
    } catch(error) {
        handleApiError(error);
    }
  };

  const transferFunds = async (from: 'cash' | 'bank', amount: number, date?: string, bankId?: string) => {
     const transactionDate = date || new Date().toISOString();
     
     try {
        if(from === 'cash') {
            if(!bankId) throw new Error("A destination bank account is required.");
            const description = 'Transfer to Bank';
            await addCashTransaction({ date: transactionDate, amount, description, category: 'Transfer', type: 'expense' });
            await addBankTransaction({ date: transactionDate, amount, description, category: 'Transfer', type: 'deposit', bank_id: bankId! });
        } else { // from bank
            if(!bankId) throw new Error("A source bank account is required.");
            const description = 'Transfer from Bank';
            await addBankTransaction({ date: transactionDate, amount, description, category: 'Transfer', type: 'withdrawal', bank_id: bankId! });
            await addCashTransaction({ date: transactionDate, amount, description, category: 'Transfer', type: 'income' });
        }
        reloadData({ force: true });
     } catch (error) {
        handleApiError(error);
     }
  };

  const addCategory = async (type: 'cash' | 'bank', category: string, direction: 'credit' | 'debit') => {
    if (!state.user || state.user.role !== 'admin') return;
    try {
      const dataToSave = { name: category, type, direction, is_deletable: true };

      const newCategory = await appendData({ tableName: 'categories', data: dataToSave, select: '*' });

      if (newCategory) {
          reloadData({ force: true });
          toast.success("Success", { description: "Category added." });
      }
    } catch (error) {
      handleApiError(error);
    }
  };

  const deleteCategory = async (id: string) => {
    if(!state.user || state.user.role !== 'admin') return;
    try {
        const { error } = await supabase.from('categories').delete().eq('id', id).eq('is_deletable', true);
        if(error) throw error;
        reloadData({ force: true });
        toast.success("Success", { description: "Category deleted." });
    } catch(error) {
        handleApiError(error);
    }
  };

  const setInitialBalances = async (cash: number, bankTotals: Record<string, number>) => {
    if (state.user?.role !== 'admin') return;
    try {
        const date = new Date().toISOString();
        const cashData = { date, type: 'income' as const, amount: cash, description: 'Initial Balance', category: 'Initial Balance' };
        
        const bankData = Object.entries(bankTotals).filter(([, amount]) => amount > 0).map(([bankId, amount]) => ({
            date,
            type: 'deposit' as const,
            amount,
            description: 'Initial Balance',
            category: 'Initial Balance',
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
        setState(prev => ({ ...prev, needsInitialBalance: false }));
        reloadData({ force: true });

    } catch (e) {
        handleApiError(e);
    }
}

  const addInitialStockItem = async (item: { name: string; weight: number; pricePerKg: number }) => {
      try {
        if(state.user?.role !== 'admin') throw new Error("Only admins can add initial stock.");
        const { name, weight, pricePerKg } = item;
        const newItem = await appendData({ tableName: 'initial_stock', data: { name, weight, purchasePricePerKg: pricePerKg } });
        if(newItem) {
            toast.success("Initial stock item added.");
            reloadData({ force: true });
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
            reloadData({ force: true });

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
      const newVendor = await appendData({ tableName: 'vendors', data: { name }, select: '*' });
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
        select: '*'
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
            select: '*'
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

    const originalTxs = state.ledgerTransactions;
    setState(prev => ({
        ...prev,
        ledgerTransactions: prev.ledgerTransactions.filter(tx => tx.id !== txToDelete.id)
    }));

    deleteData({ tableName: 'ap_ar_transactions', id: txToDelete.id })
      .then(() => {
        toast.success('Transaction moved to recycle bin.');
        reloadData({ force: true });
      })
      .catch(error => {
          handleApiError(error);
          setState(prev => ({...prev, ledgerTransactions: originalTxs}));
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
        reloadData({ force: true });
        
    } catch (error: any) {
         handleApiError(new Error(error.message || "An unexpected error occurred during payment recording."));
         throw error;
    }
  }
  
  useEffect(() => {
    saveStateToLocalStorage(state);
  }, [state])

  if (!isMounted) {
    return <AppLoading />;
  }

  if (state.isLoading && pathname !== '/login') {
    return <AppLoading />;
  }

  return (
    <AppContext.Provider value={{ 
        ...state, 
        reloadData,
        loadDataForTab,
        loadRecycleBinData,
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
        transferFunds,
        addCategory,
        deleteCategory,
        setFontSize: (size) => setState(prev => ({ ...prev, fontSize: size })),
        setWastagePercentage: (p) => setState(prev => ({ ...prev, wastagePercentage: p })),
        setCurrency: (c) => setState(prev => ({ ...prev, currency: c })),
        setShowStockValue: (s) => setState(prev => ({ ...prev, showStockValue: s })),
        setInitialBalances,
        addInitialStockItem,
        handleExport,
        handleImport,
        handleDeleteAllData,
        logout,
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
