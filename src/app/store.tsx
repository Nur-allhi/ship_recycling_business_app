
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import type { CashTransaction, BankTransaction, StockItem, StockTransaction, User, Vendor, Client, LedgerTransaction, PaymentInstallment } from '@/lib/types';
import { useToast } from "@/hooks/use-toast"
import { readData, appendData, updateData, deleteData, readDeletedData, restoreData, exportAllData, batchImportData, deleteAllData, logout as serverLogout, addPaymentInstallment } from '@/app/actions';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { getSession } from '@/lib/auth';
import { useRouter, usePathname } from 'next/navigation';
import { AppLoading } from '@/components/app-loading';


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
  cashCategories: string[];
  bankCategories: string[];
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
}

interface AppContextType extends AppState {
  reloadData: (options?: { force?: boolean }) => Promise<void>;
  loadRecycleBinData: () => Promise<void>;
  addCashTransaction: (tx: Omit<CashTransaction, 'id' | 'createdAt' | 'deletedAt'>) => Promise<void>;
  addBankTransaction: (tx: Omit<BankTransaction, 'id' | 'createdAt' | 'deletedAt'>) => Promise<void>;
  addStockTransaction: (tx: Omit<StockTransaction, 'id' | 'createdAt' | 'deletedAt'> & { contact_id?: string, contact_name?: string }) => Promise<void>;
  editCashTransaction: (originalTx: CashTransaction, updatedTxData: Partial<Omit<CashTransaction, 'id' | 'date'>>) => void;
  editBankTransaction: (originalTx: BankTransaction, updatedTxData: Partial<Omit<BankTransaction, 'id' | 'date'>>) => void;
  editStockTransaction: (originalTx: StockTransaction, updatedTxData: Partial<Omit<StockTransaction, 'id' | 'date'>>) => void;
  deleteCashTransaction: (tx: CashTransaction) => void;
  deleteBankTransaction: (tx: BankTransaction) => void;
  deleteStockTransaction: (tx: StockTransaction) => void;
  deleteMultipleCashTransactions: (txs: CashTransaction[]) => void;
  deleteMultipleBankTransactions: (txs: BankTransaction[]) => void;
  deleteMultipleStockTransactions: (txs: StockTransaction[]) => void;
  deleteLedgerTransaction: (tx: LedgerTransaction) => void;
  restoreTransaction: (txType: 'cash' | 'bank' | 'stock' | 'ap_ar', id: string) => void;
  transferFunds: (from: 'cash' | 'bank', amount: number, date?: string) => Promise<void>;
  addCategory: (type: 'cash' | 'bank', category: string) => void;
  deleteCategory: (type: 'cash' | 'bank', category: string) => void;
  setFontSize: (size: FontSize) => void;
  setWastagePercentage: (percentage: number) => void;
  setCurrency: (currency: string) => void;
  setShowStockValue: (show: boolean) => void;
  setInitialBalances: (cash: number, bank: number) => void;
  addInitialStockItem: (item: { name: string; weight: number; pricePerKg: number }) => void;
  handleExport: () => void;
  handleImport: (file: File) => void;
  handleDeleteAllData: () => void;
  logout: () => void;
  addVendor: (name: string) => Promise<any>;
  addClient: (name: string) => Promise<any>;
  addLedgerTransaction: (tx: Omit<LedgerTransaction, 'id' | 'createdAt' | 'deletedAt' | 'user_id' | 'status' | 'paid_amount' | 'installments'>) => Promise<void>;
  recordInstallment: (tx: LedgerTransaction, paymentAmount: number, paymentMethod: 'cash' | 'bank', paymentDate: Date) => Promise<any>;
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
  cashCategories: ['Salary', 'Groceries', 'Transport', 'Utilities', 'Stock Purchase', 'Stock Sale'],
  bankCategories: ['Deposit', 'Withdrawal', 'Stock Purchase', 'Stock Sale'],
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
};

const getCacheKey = () => `ha-mim-iron-mart-cache`;

const getInitialState = (): AppState => {
    let state = { ...initialAppState, initialBalanceSet: false, isLoading: true };
    if (typeof window === 'undefined') return state;
    try {
        const storedSettings = localStorage.getItem('ha-mim-iron-mart-settings');
        if (storedSettings) {
            const settings = JSON.parse(storedSettings);
            state = { ...state, ...settings };
        }
        
        const appCache = localStorage.getItem(getCacheKey());
        if (appCache) {
            const cachedData = JSON.parse(appCache);
            state = { ...state, ...cachedData, initialBalanceSet: true, isLoading: false };
        }
    } catch (e) {
        console.error("Could not parse data from local storage", e);
    }
    return state;
}

const saveStateToLocalStorage = (state: AppState) => {
    if (typeof window === 'undefined') return;
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
            cashTransactions: state.cashTransactions,
            bankBalance: state.bankBalance,
            bankTransactions: state.bankTransactions,
            initialStockItems: state.initialStockItems,
            stockItems: state.stockItems,
            stockTransactions: state.stockTransactions,
            cashCategories: state.cashCategories,
            bankCategories: state.bankCategories,
            vendors: state.vendors,
            clients: state.clients,
            ledgerTransactions: state.ledgerTransactions,
            totalPayables: state.totalPayables,
            totalReceivables: state.totalReceivables,
        };
        localStorage.setItem(getCacheKey(), JSON.stringify(appStateToCache));

    } catch (e) {
        console.error("Could not save state to local storage", e);
    }
}


export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(getInitialState());
  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const logout = useCallback(async () => {
    localStorage.removeItem(getCacheKey());
    await serverLogout();
    localStorage.removeItem('ha-mim-iron-mart-settings');
    setState({...initialAppState, user: null, isLoading: false});
    window.location.href = '/login';
  }, []);

  const handleApiError = useCallback((error: any) => {
    const isAuthError = error.message.includes('JWT') || error.message.includes('Unauthorized') || error.message.includes("SESSION_EXPIRED");
    if (isAuthError) {
        toast({
            variant: 'destructive',
            title: 'Session Expired',
            description: 'Your session has expired. Please log in again.',
        });
        logout();
    } else {
        console.error("API Error:", error);
        toast({
            variant: 'destructive',
            title: 'An Error Occurred',
            description: error.message || 'An unknown error occurred. Please try again.',
        });
    }
  }, [toast, logout]);

  useEffect(() => {
    const checkSessionAndLoadData = async () => {
      try {
        const session = await getSession();
        if (session) {
          setState(prev => ({...prev, user: session }));
          if (!state.initialBalanceSet) {
             await reloadData({force: true});
          }
        } else {
          setState(prev => ({ ...prev, isLoading: false }));
        }
      } catch (error) {
        console.error("Failed to get session", error);
        setState(prev => ({ ...prev, isLoading: false }));
      }
    };
    checkSessionAndLoadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.initialBalanceSet]);
  
  const calculateBalancesAndStock = useCallback((
    cashTxs: CashTransaction[], 
    bankTxs: BankTransaction[],
    stockTxs: StockTransaction[],
  ) => {
      const finalCashBalance = cashTxs.reduce((acc, tx) => acc + (tx.type === 'income' ? tx.amount : -tx.amount), 0);
      const finalBankBalance = bankTxs.reduce((acc, tx) => acc + (tx.type === 'deposit' ? tx.amount : -tx.amount), 0);
        
      const stockPortfolio: Record<string, { weight: number, totalValue: number }> = {};

      state.initialStockItems.forEach(item => {
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
  }, [state.initialStockItems]);
  
  const reloadData = useCallback(async (options?: { force?: boolean }) => {
    const session = await getSession();
    if (!session) return;
    if (!options?.force && state.initialBalanceSet) return;

    setState(prev => ({ ...prev, isLoading: true }));
    try {
      const [
        cashData,
        bankData,
        stockTransactionsData,
        initialStockData,
        categoriesData,
        vendorsData,
        clientsData,
        ledgerData,
        installmentsData,
      ] = await Promise.all([
        readData({ tableName: 'cash_transactions' }),
        readData({ tableName: 'bank_transactions' }),
        readData({ tableName: 'stock_transactions' }),
        readData({ tableName: 'initial_stock' }),
        readData({ tableName: 'categories' }),
        readData({ tableName: 'vendors' }),
        readData({ tableName: 'clients' }),
        readData({ tableName: 'ap_ar_transactions', select: '*, installments:payment_installments(*)' }),
        readData({ tableName: 'payment_installments' }),
      ]);
        
        const cashTransactions: CashTransaction[] = cashData?.map((tx: any) => ({...tx, date: new Date(tx.date).toISOString() })) || [];
        const bankTransactions: BankTransaction[] = bankData?.map((tx: any) => ({...tx, date: new Date(tx.date).toISOString() })) || [];
        const stockTransactions: StockTransaction[] = stockTransactionsData?.map((tx: any) => ({...tx, date: new Date(tx.date).toISOString() })) || [];
        const initialStockItems: StockItem[] = initialStockData || [];

        const needsInitialBalance = cashTransactions.length === 0 && bankTransactions.length === 0 && initialStockItems.length === 0;

        // Temporarily set initial stock in state to use in calculation
        setState(prev => ({...prev, initialStockItems: initialStockItems}));
        
        const { finalCashBalance, finalBankBalance, aggregatedStockItems } = calculateBalancesAndStock(cashTransactions, bankTransactions, stockTransactions);
        
        const cashCategories = categoriesData?.filter((c: any) => c.type === 'cash').map((c: any) => c.name);
        const bankCategories = categoriesData?.filter((c: any) => c.type === 'bank').map((c: any) => c.name);
        
        const installments: PaymentInstallment[] = installmentsData || [];
        const ledgerTransactions: LedgerTransaction[] = (ledgerData || []).map((tx: any) => ({
            ...tx, 
            date: new Date(tx.date).toISOString(),
            installments: installments.filter(ins => ins.ap_ar_transaction_id === tx.id)
        }));

        const totalPayables = ledgerTransactions.filter(tx => tx.type === 'payable' && tx.status !== 'paid').reduce((acc, tx) => acc + (tx.amount - tx.paid_amount), 0);
        const totalReceivables = ledgerTransactions.filter(tx => tx.type === 'receivable' && tx.status !== 'paid').reduce((acc, tx) => acc + (tx.amount - tx.paid_amount), 0);

        setState(prev => ({
            ...prev,
            cashTransactions: cashTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            bankTransactions: bankTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            initialStockItems: initialStockItems,
            stockItems: aggregatedStockItems,
            stockTransactions: stockTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            cashBalance: finalCashBalance,
            bankBalance: finalBankBalance,
            needsInitialBalance,
            cashCategories: cashCategories?.length > 0 ? cashCategories : prev.cashCategories,
            bankCategories: bankCategories?.length > 0 ? bankCategories : prev.bankCategories,
            initialBalanceSet: true,
            vendors: vendorsData || [],
            clients: clientsData || [],
            ledgerTransactions: ledgerTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            totalPayables,
            totalReceivables,
        }));
      } catch (error: any) {
        console.error("Failed to load data during promise resolution:", error);
        handleApiError(error);
      } finally {
        setState(prev => ({...prev, isLoading: false}));
      }
  }, [state.initialBalanceSet, calculateBalancesAndStock, handleApiError]);
  
  const loadRecycleBinData = useCallback(async () => {
    if(!state.user) return;
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
            const { finalCashBalance } = calculateBalancesAndStock(newTxs, prev.bankTransactions, prev.stockTransactions);
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
            toast({ variant: 'destructive', title: 'Failed to save cash transaction.' });
            setState(prev => ({ ...prev, cashTransactions: prev.cashTransactions.filter(t => t.id !== tempId)}));
            handleApiError(error);
        }
    };

    const addBankTransaction = async (tx: Omit<BankTransaction, 'id' | 'createdAt' | 'deletedAt'>) => {
        const tempId = `temp-${Date.now()}`;
        const newTxForUI: BankTransaction = { ...tx, id: tempId, createdAt: new Date().toISOString() };

        setState(prev => {
            const newTxs = [newTxForUI, ...prev.bankTransactions];
            const { finalBankBalance } = calculateBalancesAndStock(prev.cashTransactions, newTxs, prev.stockTransactions);
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
            toast({ variant: 'destructive', title: 'Failed to save bank transaction.' });
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
            const savedTx = await appendData({ tableName: 'ap_ar_transactions', data: { ...tx, status: 'unpaid', paid_amount: 0 }, select: '*, installments:payment_installments(*)' });
            setState(prev => {
                const newLedgerTxs = prev.ledgerTransactions.map(t => t.id === tempId ? savedTx : t);
                return { ...prev, ledgerTransactions: newLedgerTxs };
            });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Failed to save ledger transaction.' });
            setState(prev => ({...prev, ledgerTransactions: prev.ledgerTransactions.filter(t => t.id !== tempId)}));
            handleApiError(error);
        }
    }

  const addStockTransaction = async (tx: Omit<StockTransaction, 'id' | 'createdAt' | 'deletedAt'> & { contact_id?: string, contact_name?: string }) => {
    const { contact_id, contact_name, ...stockTxData } = tx;
    const tempId = `temp-${Date.now()}`;
    const newTxForUI: StockTransaction = { ...stockTxData, id: tempId, createdAt: new Date().toISOString() };
    
    // Optimistic UI for stock
    setState(prev => {
        const newStockTxs = [newTxForUI, ...prev.stockTransactions];
        const { aggregatedStockItems } = calculateBalancesAndStock(prev.cashTransactions, prev.bankTransactions, newStockTxs);
        return {
            ...prev,
            stockTransactions: newStockTxs.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            stockItems: aggregatedStockItems
        };
    });


    try {
      const newStockTx = await appendData({ tableName: 'stock_transactions', data: stockTxData, select: '*' });
      if (!newStockTx) throw new Error("Stock transaction creation failed. The 'stock_transactions' table may not exist.");
      
      // Replace temp stock record
       setState(prev => {
            const newStockTxs = prev.stockTransactions.map(t => t.id === tempId ? newStockTx : t);
            const { aggregatedStockItems } = calculateBalancesAndStock(prev.cashTransactions, prev.bankTransactions, newStockTxs);
            return {
                ...prev,
                stockTransactions: newStockTxs,
                stockItems: aggregatedStockItems
            };
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
          
          addLedgerTransaction({
              type: ledgerType,
              description,
              amount: totalValue,
              date: tx.date,
              contact_id: contact_id,
              contact_name: finalContactName,
          });
      } else {
          const description = `${tx.type === 'purchase' ? 'Purchase' : 'Sale'} of ${tx.weight}kg of ${tx.stockItemName}`;
          const category = tx.type === 'purchase' ? 'Stock Purchase' : 'Stock Sale';
          const financialTxData = {
              date: tx.date,
              amount: totalValue,
              description,
              category,
              linkedStockTxId: newStockTx.id
          };

          if (tx.paymentMethod === 'cash') {
              addCashTransaction({ ...financialTxData, type: tx.type === 'purchase' ? 'expense' : 'income' });
          } else if (tx.paymentMethod === 'bank') { 
              addBankTransaction({ ...financialTxData, type: tx.type === 'purchase' ? 'withdrawal' : 'deposit' });
          }
      }
      
      toast({ title: "Success", description: "Stock transaction recorded."});
    } catch (error: any) {
       // Rollback stock transaction on error
       setState(prev => {
            const newStockTxs = prev.stockTransactions.filter(t => t.id !== tempId);
            const { aggregatedStockItems } = calculateBalancesAndStock(prev.cashTransactions, prev.bankTransactions, newStockTxs);
             return {
                ...prev,
                stockTransactions: newStockTxs,
                stockItems: aggregatedStockItems
            };
       });
      handleApiError(error)
    }
  };

  const editCashTransaction = (originalTx: CashTransaction, updatedTxData: Partial<Omit<CashTransaction, 'id' | 'date'>>) => {
      const updatedTx = { ...originalTx, ...updatedTxData, lastEdited: new Date().toISOString() };
      
      // Optimistic update
      setState(prev => {
          const newTxs = prev.cashTransactions.map(tx => tx.id === originalTx.id ? updatedTx : tx);
          const { finalCashBalance, aggregatedStockItems } = calculateBalancesAndStock(newTxs, prev.bankTransactions, prev.stockTransactions);
          return { ...prev, cashTransactions: newTxs, cashBalance: finalCashBalance, stockItems: aggregatedStockItems };
      });
      
      // Background save
      updateData({ tableName: 'cash_transactions', id: originalTx.id, data: updatedTxData })
        .then(() => toast({ title: "Success", description: "Cash transaction updated." }))
        .catch(error => {
            handleApiError(error);
            // Rollback on failure
            setState(prev => {
                const newTxs = prev.cashTransactions.map(tx => tx.id === originalTx.id ? originalTx : tx);
                const { finalCashBalance, aggregatedStockItems } = calculateBalancesAndStock(newTxs, prev.bankTransactions, prev.stockTransactions);
                return { ...prev, cashTransactions: newTxs, cashBalance: finalCashBalance, stockItems: aggregatedStockItems };
            });
        });
  };

  const editBankTransaction = (originalTx: BankTransaction, updatedTxData: Partial<Omit<BankTransaction, 'id'| 'date'>>) => {
      const updatedTx = { ...originalTx, ...updatedTxData, lastEdited: new Date().toISOString() };
      
      // Optimistic update
      setState(prev => {
          const newTxs = prev.bankTransactions.map(tx => tx.id === originalTx.id ? updatedTx : tx);
          const { finalBankBalance, aggregatedStockItems } = calculateBalancesAndStock(prev.cashTransactions, newTxs, prev.stockTransactions);
          return { ...prev, bankTransactions: newTxs, bankBalance: finalBankBalance, stockItems: aggregatedStockItems };
      });

      // Background save
      updateData({ tableName: 'bank_transactions', id: originalTx.id, data: updatedTxData })
        .then(() => toast({ title: "Success", description: "Bank transaction updated."}))
        .catch(error => {
            handleApiError(error);
            // Rollback on failure
            setState(prev => {
                const newTxs = prev.bankTransactions.map(tx => tx.id === originalTx.id ? originalTx : tx);
                const { finalBankBalance, aggregatedStockItems } = calculateBalancesAndStock(prev.cashTransactions, newTxs, prev.stockTransactions);
                return { ...prev, bankTransactions: newTxs, bankBalance: finalBankBalance, stockItems: aggregatedStockItems };
            });
        });
  };

  const editStockTransaction = (originalTx: StockTransaction, updatedTxData: Partial<Omit<StockTransaction, 'id' | 'date'>>) => {
      const updatedTx = { ...originalTx, ...updatedTxData, lastEdited: new Date().toISOString() };
      
      // Optimistic update
      setState(prev => {
          const newTxs = prev.stockTransactions.map(tx => tx.id === originalTx.id ? updatedTx : tx);
          const { aggregatedStockItems } = calculateBalancesAndStock(prev.cashTransactions, prev.bankTransactions, newTxs);
          return { ...prev, stockTransactions: newTxs, stockItems: aggregatedStockItems };
      });
      
      // Background save
      updateData({ tableName: 'stock_transactions', id: originalTx.id, data: updatedTxData })
        .then(() => toast({ 
            title: "Success", 
            description: "Stock transaction updated. Please manually update the corresponding financial transaction if amount has changed.",
            duration: 5000,
        }))
        .catch(error => {
            handleApiError(error);
             // Rollback on failure
            setState(prev => {
                const newTxs = prev.stockTransactions.map(tx => tx.id === originalTx.id ? originalTx : tx);
                const { aggregatedStockItems } = calculateBalancesAndStock(prev.cashTransactions, prev.bankTransactions, newTxs);
                return { ...prev, stockTransactions: newTxs, stockItems: aggregatedStockItems };
            });
        });
  };

  const deleteCashTransaction = (txToDelete: CashTransaction) => {
    const originalTxs = state.cashTransactions;
    // Optimistic update
    setState(prev => {
        const newTxs = prev.cashTransactions.filter(tx => tx.id !== txToDelete.id);
        const { finalCashBalance, aggregatedStockItems } = calculateBalancesAndStock(newTxs, prev.bankTransactions, prev.stockTransactions);
        return { ...prev, cashTransactions: newTxs, cashBalance: finalCashBalance, stockItems: aggregatedStockItems };
    });

    // Background delete
    deleteData({ tableName: "cash_transactions", id: txToDelete.id })
        .then(() => {
            if (txToDelete.linkedStockTxId) {
                return deleteData({ tableName: "stock_transactions", id: txToDelete.linkedStockTxId });
            }
        })
        .then(() => toast({ title: "Success", description: "Cash transaction moved to recycle bin."}))
        .catch((error) => {
            handleApiError(error);
            setState(prev => ({...prev, cashTransactions: originalTxs})); // Rollback
        });
  };

  const deleteBankTransaction = (txToDelete: BankTransaction) => {
    const originalTxs = state.bankTransactions;
     // Optimistic update
    setState(prev => {
        const newTxs = prev.bankTransactions.filter(tx => tx.id !== txToDelete.id);
        const { finalBankBalance, aggregatedStockItems } = calculateBalancesAndStock(prev.cashTransactions, newTxs, prev.stockTransactions);
        return { ...prev, bankTransactions: newTxs, bankBalance: finalBankBalance, stockItems: aggregatedStockItems };
    });

    // Background delete
    deleteData({ tableName: "bank_transactions", id: txToDelete.id })
        .then(() => {
            if(txToDelete.linkedStockTxId) {
                return deleteData({ tableName: "stock_transactions", id: txToDelete.linkedStockTxId });
            }
        })
        .then(() => toast({ title: "Success", description: "Bank transaction moved to recycle bin."}))
        .catch(error => {
            handleApiError(error);
            setState(prev => ({...prev, bankTransactions: originalTxs})); // Rollback
        });
  };
  
  const deleteStockTransaction = (txToDelete: StockTransaction) => {
     const originalTxs = state.stockTransactions;
     // Optimistic update
    setState(prev => {
        const newTxs = prev.stockTransactions.filter(tx => tx.id !== txToDelete.id);
        const { aggregatedStockItems } = calculateBalancesAndStock(prev.cashTransactions, prev.bankTransactions, newTxs);
        return { ...prev, stockTransactions: newTxs, stockItems: aggregatedStockItems };
    });
    
    // Background delete
    deleteData({ tableName: "stock_transactions", id: txToDelete.id })
        .then(async () => {
            const { data: allCashTxs } = await supabase.from('cash_transactions').select('id, deletedAt').eq('linkedStockTxId', txToDelete.id);
            if (allCashTxs && allCashTxs.length > 0 && !allCashTxs[0].deletedAt) {
                await deleteData({ tableName: "cash_transactions", id: allCashTxs[0].id });
            }
    
            const { data: allBankTxs } = await supabase.from('bank_transactions').select('id, deletedAt').eq('linkedStockTxId', txToDelete.id);
            if (allBankTxs && allBankTxs.length > 0 && !allBankTxs[0].deletedAt) {
                await deleteData({ tableName: "bank_transactions", id: allBankTxs[0].id });
            }
        })
        .then(() => toast({ title: "Stock Transaction Deleted", description: "The corresponding financial entry was also moved to the recycle bin."}))
        .catch(error => {
            handleApiError(error);
            setState(prev => ({...prev, stockTransactions: originalTxs})); // Rollback
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
        
        toast({ title: "Transaction Restored", description: "The item and any linked transactions have been restored." });
        reloadData({ force: true });
        loadRecycleBinData();
    } catch (error: any) {
        handleApiError(error);
    }
  };

  const deleteMultipleCashTransactions = async (txs: CashTransaction[]) => {
     try {
        await Promise.all(txs.map(tx => deleteData({ tableName: "cash_transactions", id: tx.id })));
        toast({ title: "Success", description: `${txs.length} cash transaction(s) deleted.`});
        reloadData({ force: true });
    } catch(error) {
        handleApiError(error);
    }
  };

  const deleteMultipleBankTransactions = async (txs: BankTransaction[]) => {
    try {
        await Promise.all(txs.map(tx => deleteData({ tableName: "bank_transactions", id: tx.id })));
        toast({ title: "Success", description: `${txs.length} bank transaction(s) deleted.`});
        reloadData({ force: true });
    } catch(error) {
        handleApiError(error);
    }
  };

  const deleteMultipleStockTransactions = async (txs: StockTransaction[]) => {
    try {
        await Promise.all(txs.map(tx => deleteData({ tableName: "stock_transactions", id: tx.id })));
        toast({ title: "Success", description: `${txs.length} stock transaction(s) deleted.`});
        reloadData({ force: true });
    } catch(error) {
        handleApiError(error);
    }
  };

  const transferFunds = async (from: 'cash' | 'bank', amount: number, date?: string) => {
     const transactionDate = date || new Date().toISOString();
     const description = from === 'cash' ? 'Transfer to Bank' : 'Transfer from Bank';

     try {
        const baseTx = { date: transactionDate, amount, description, category: 'Transfer' };
        
        if(from === 'cash') {
            await addCashTransaction({ ...baseTx, type: 'expense' });
            await addBankTransaction({ ...baseTx, type: 'deposit' });
        } else {
            await addBankTransaction({ ...baseTx, type: 'withdrawal' });
            await addCashTransaction({ ...baseTx, type: 'income' });
        }
        
     } catch (error) {
        handleApiError(error);
     }
  };

  const addCategory = async (type: 'cash' | 'bank', category: string) => {
    if(!state.user) return;
    const categories = type === 'cash' ? state.cashCategories : state.bankCategories;
    if (categories.includes(category) || !category) return;
    
    try {
      const newCategory = await appendData({ tableName: 'categories', data: { name: category, type } });
      if (newCategory) {
          reloadData({ force: true });
          toast({ title: "Success", description: "Category added." });
      }
    } catch (error) {
      handleApiError(error);
    }
  };

  const deleteCategory = async (type: 'cash' | 'bank', category: string) => {
    console.warn("Database deletion for categories is not implemented. Removing from local state only.");
    setState(prev => {
      const categories = type === 'cash' ? prev.cashCategories : prev.bankCategories;
      const newCategories = categories.filter(c => c !== category);
       if (type === 'cash') {
        return { ...prev, cashCategories: newCategories };
       }
       return { ...prev, bankCategories: newCategories };
    });
  };

  const setInitialBalances = async (cash: number, bank: number) => {
    try {
        const date = new Date().toISOString();
        if (cash > 0) {
            await addCashTransaction({ date, type: 'income', amount: cash, description: 'Initial Balance', category: 'Initial Balance' });
        }
        if (bank > 0) {
            await addBankTransaction({ date, type: 'deposit', amount: bank, description: 'Initial Balance', category: 'Initial Balance' });
        }
        
        toast({ title: "Initial balances set." });
        setState(prev => ({ ...prev, needsInitialBalance: false }));

    } catch (e) {
        handleApiError(e);
    }
}

  const addInitialStockItem = async (item: { name: string; weight: number; pricePerKg: number }) => {
      try {
        const { name, weight, pricePerKg } = item;
        const newItem = await appendData({ tableName: 'initial_stock', data: { name, weight, purchasePricePerKg: pricePerKg } });
        if(newItem) {
            toast({ title: "Initial stock item added." });
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
      toast({ title: "Export Successful", description: "Your data has been exported." });
    } catch (error: any) {
      handleApiError(error);
    }
  };

  const handleImport = async (file: File) => {
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
            toast({ title: "Import Successful", description: "Your data has been restored from backup." });
            reloadData({ force: true });

        } catch (error: any) {
            handleApiError(error);
        }
    };
    reader.readAsText(file);
  };
  
  const handleDeleteAllData = async () => {
    try {
        await deleteAllData();
        toast({ title: 'All Data Deleted', description: 'Your account and all associated data have been permanently removed.' });
        logout();
    } catch (error: any) {
        handleApiError(error);
    }
  };

  const addVendor = async (name: string) => {
    if (!state.user) {
        toast({ variant: 'destructive', title: 'Authentication Error', description: 'You must be logged in to add a vendor.' });
        return null;
    }
    try {
      const newVendor = await appendData({ tableName: 'vendors', data: { name }, select: '*' });
      if (!newVendor) {
        toast({ variant: 'destructive', title: 'Setup Incomplete', description: "Could not save to the 'vendors' table. Please ensure it exists in your database and RLS is configured." });
        return null;
      }
      setState(prev => ({...prev, vendors: [...prev.vendors, newVendor]}));
      toast({ title: 'Vendor Added' });
      return newVendor;
    } catch (error: any) {
      handleApiError(error);
      return null;
    }
  }

  const addClient = async (name: string) => {
    if (!state.user) {
      toast({
        variant: 'destructive',
        title: 'Authentication Error',
        description: 'You must be logged in to add a client.',
      });
      return null;
    }
    try {
      const newClient = await appendData({
        tableName: 'clients',
        data: { name },
        select: '*'
      });
      if (!newClient) {
        toast({
          variant: 'destructive',
          title: 'Setup Incomplete',
          description:
            "Could not save to the 'clients' table. Please ensure it exists and RLS is configured.",
        });
        return null;
      }
      setState(prev => ({...prev, clients: [...prev.clients, newClient]}));
      toast({ title: 'Client Added' });
      return newClient;
    } catch (error: any) {
      handleApiError(error);
      return null;
    }
  };

  const deleteLedgerTransaction = (txToDelete: LedgerTransaction) => {
    if (!state.user || state.user.role !== 'admin') {
        toast({ variant: 'destructive', title: 'Permission Denied', description: 'Only admins can delete transactions.' });
        return;
    }

    const originalTxs = state.ledgerTransactions;
    // Optimistic Delete
    setState(prev => ({
        ...prev,
        ledgerTransactions: prev.ledgerTransactions.filter(tx => tx.id !== txToDelete.id)
    }));

    // Background delete
    deleteData({ tableName: 'ap_ar_transactions', id: txToDelete.id })
      .then(() => toast({ title: 'Transaction moved to recycle bin.' }))
      .catch(error => {
          handleApiError(error);
          setState(prev => ({...prev, ledgerTransactions: originalTxs})); // Rollback
      });
  }
  
  const recordInstallment = async (tx: LedgerTransaction, paymentAmount: number, paymentMethod: 'cash' | 'bank', paymentDate: Date) => {
    try {
        const result = await addPaymentInstallment({
            ap_ar_transaction_id: tx.id,
            original_amount: tx.amount,
            already_paid_amount: tx.paid_amount,
            payment_amount: paymentAmount,
            payment_date: paymentDate.toISOString(),
            payment_method: paymentMethod,
            ledger_type: tx.type,
            description: tx.description
        });

        // Optimistic update of the UI
        setState(prev => {
            const updatedLedgerTxs = prev.ledgerTransactions.map(ledgerTx => {
                if (ledgerTx.id === tx.id) {
                    return {
                        ...ledgerTx,
                        paid_amount: result.updatedParent.paid_amount,
                        status: result.updatedParent.status,
                        installments: [...(ledgerTx.installments || []), result.newInstallment]
                    };
                }
                return ledgerTx;
            });
            
            const newFinancialTx = result.newFinancialTx;
            const newCashTxs = result.paymentMethod === 'cash' ? [...prev.cashTransactions, newFinancialTx] : prev.cashTransactions;
            const newBankTxs = result.paymentMethod === 'bank' ? [...prev.bankTransactions, newFinancialTx] : prev.bankTransactions;

            const { finalCashBalance, finalBankBalance } = calculateBalancesAndStock(newCashTxs, newBankTxs, prev.stockTransactions);

            const totalPayables = updatedLedgerTxs.filter(t => t.type === 'payable' && t.status !== 'paid').reduce((acc, t) => acc + (t.amount - t.paid_amount), 0);
            const totalReceivables = updatedLedgerTxs.filter(t => t.type === 'receivable' && t.status !== 'paid').reduce((acc, t) => acc + (t.amount - t.paid_amount), 0);

            return {
                ...prev,
                ledgerTransactions: updatedLedgerTxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
                cashTransactions: newCashTxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
                bankTransactions: newBankTxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
                cashBalance: finalCashBalance,
                bankBalance: finalBankBalance,
                totalPayables,
                totalReceivables,
            };
        });
        
        toast({title: "Payment Recorded", description: "The installment has been recorded and balances updated."});
    } catch (error: any) {
         handleApiError(new Error(error.message || "An unexpected error occurred during installment recording."));
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
        recordInstallment,
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
