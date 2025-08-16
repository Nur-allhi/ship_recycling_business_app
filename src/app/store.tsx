
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import type { CashTransaction, BankTransaction, StockItem, StockTransaction, User, Vendor, Client, LedgerTransaction, PaymentInstallment } from '@/lib/types';
import { useToast } from "@/hooks/use-toast"
import { readData, appendData, updateData, deleteData, readDeletedData, restoreData, exportAllData, batchImportData, deleteAllData, logout as serverLogout, addPaymentInstallment } from '@/app/actions';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { getSession, removeSession } from '@/lib/auth';
import { useRouter, usePathname } from 'next/navigation';
import Logo from '@/components/logo';


type FontSize = 'sm' | 'base' | 'lg';

interface AppState {
  cashBalance: number;
  cashTransactions: CashTransaction[];
  bankBalance: number;
  bankTransactions: BankTransaction[];
  stockItems: StockItem[];
  stockTransactions: StockTransaction[];
  deletedCashTransactions: CashTransaction[];
  deletedBankTransactions: BankTransaction[];
  deletedStockTransactions: StockTransaction[];
  deletedLedgerTransactions: LedgerTransaction[];
  cashCategories: string[];
  bankCategories: string[];
  fontSize: FontSize;
  bodyFont: string;
  numberFont: string;
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
}

interface AppContextType extends AppState {
  reloadData: () => Promise<void>;
  reloadLedger: () => Promise<void>;
  loadRecycleBinData: () => Promise<void>;
  addCashTransaction: (tx: Omit<CashTransaction, 'id' | 'createdAt' | 'deletedAt' | 'user_id'>) => Promise<any>;
  addBankTransaction: (tx: Omit<BankTransaction, 'id' | 'createdAt' | 'deletedAt' | 'user_id'>) => Promise<any>;
  addStockTransaction: (tx: Omit<StockTransaction, 'id' | 'createdAt' | 'deletedAt' | 'user_id'> & { contact_id?: string, contact_name?: string }) => Promise<any>;
  editCashTransaction: (originalTx: CashTransaction, updatedTxData: Partial<Omit<CashTransaction, 'id' | 'date'>>) => void;
  editBankTransaction: (originalTx: BankTransaction, updatedTxData: Partial<Omit<BankTransaction, 'id' | 'date'>>) => void;
  editStockTransaction: (originalTx: StockTransaction, updatedTxData: Partial<Omit<StockTransaction, 'id' | 'date'>>) => void;
  deleteCashTransaction: (tx: CashTransaction) => void;
  deleteBankTransaction: (tx: BankTransaction) => void;
  deleteStockTransaction: (tx: StockTransaction) => void;
  deleteMultipleCashTransactions: (txs: CashTransaction[]) => void;
  deleteMultipleBankTransactions: (txs: BankTransaction[]) => void;
  deleteMultipleStockTransactions: (txs: StockTransaction[]) => void;
  deleteLedgerTransaction: (tx: LedgerTransaction) => Promise<any>;
  restoreTransaction: (txType: 'cash' | 'bank' | 'stock' | 'ap_ar', id: string) => void;
  transferFunds: (from: 'cash' | 'bank', amount: number, date?: string) => void;
  addCategory: (type: 'cash' | 'bank', category: string) => void;
  deleteCategory: (type: 'cash' | 'bank', category: string) => void;
  setFontSize: (size: FontSize) => void;
  setBodyFont: (font: string) => void;
  setNumberFont: (font: string) => void;
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
  addLedgerTransaction: (tx: Omit<LedgerTransaction, 'id' | 'createdAt' | 'deletedAt' | 'user_id' | 'status' | 'paid_amount' | 'installments'>) => Promise<any>;
  recordInstallment: (tx: LedgerTransaction, paymentAmount: number, paymentMethod: 'cash' | 'bank', paymentDate: Date) => Promise<any>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const initialAppState: AppState = {
  cashBalance: 0,
  cashTransactions: [],
  bankBalance: 0,
  bankTransactions: [],
  stockItems: [],
  stockTransactions: [],
  deletedCashTransactions: [],
  deletedBankTransactions: [],
  deletedStockTransactions: [],
  deletedLedgerTransactions: [],
  cashCategories: ['Salary', 'Groceries', 'Transport', 'Utilities', 'Stock Purchase', 'Stock Sale'],
  bankCategories: ['Deposit', 'Withdrawal', 'Stock Purchase', 'Stock Sale'],
  fontSize: 'base',
  bodyFont: "'Roboto Slab', serif",
  numberFont: "'Roboto Mono', monospace",
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
};

const getInitialState = (): AppState => {
    try {
        const storedSettings = localStorage.getItem('ha-mim-iron-mart-settings');
        if (storedSettings) {
            const settings = JSON.parse(storedSettings);
            return { ...initialAppState, ...settings };
        }
    } catch (e) {
        console.error("Could not parse settings from local storage", e);
    }
    return initialAppState;
}


export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(getInitialState());
  const [sessionChecked, setSessionChecked] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();

  const logout = useCallback(async () => {
    await serverLogout();
    localStorage.removeItem('ha-mim-iron-mart-settings');
    setState({...initialAppState, user: null});
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
        setState(prev => ({ ...prev, user: session }));
      } catch (error) {
        console.error("Failed to get session", error);
      } finally {
        setSessionChecked(true);
      }
    };
    checkSessionAndLoadData();
  }, [pathname]);
  
  const calculateBalancesAndStock = useCallback((
    cashTxs: CashTransaction[], 
    bankTxs: BankTransaction[],
    stockTxs: StockTransaction[],
    initialStock: StockItem[]
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

  const reloadLedger = useCallback(async () => {
    if (!state.user) return;
    try {
        const [ledgerData, installmentsData] = await Promise.all([
             readData({ tableName: 'ap_ar_transactions', select: '*, installments:payment_installments(*)' }),
             readData({ tableName: 'payment_installments' })
        ]);
        
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
            ledgerTransactions: ledgerTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            totalPayables,
            totalReceivables,
        }));
    } catch (error) {
        handleApiError(error);
    }
  }, [state.user, handleApiError]);


  const reloadData = useCallback(async () => {
    if (!state.user) {
        setState(prev => ({...prev, initialBalanceSet: true, needsInitialBalance: !state.user}));
        return;
    }
    try {
        const results = await Promise.allSettled([
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

        const [cashData, bankData, stockTransactionsData, initialStockData, categoriesData, vendorsData, clientsData, ledgerData, installmentsData] = results.map(r => {
            if (r.status === 'rejected') {
                handleApiError(r.reason);
                return []; // Return empty array on error to prevent crashes
            }
            return r.value;
        });
        
        let needsInitialBalance = true;

        const cashTransactions: CashTransaction[] = cashData?.map((tx: any) => ({...tx, date: new Date(tx.date).toISOString() })) || [];
        const bankTransactions: BankTransaction[] = bankData?.map((tx: any) => ({...tx, date: new Date(tx.date).toISOString() })) || [];
        
        if (cashTransactions.length > 0 || bankTransactions.length > 0 || (initialStockData && initialStockData.length > 0)) {
            needsInitialBalance = false;
        }

        const stockTransactions: StockTransaction[] = stockTransactionsData?.map((tx: any) => ({...tx, date: new Date(tx.date).toISOString() })) || [];

        const initialStockItems: StockItem[] = initialStockData || [];

        const { finalCashBalance, finalBankBalance, aggregatedStockItems } = calculateBalancesAndStock(cashTransactions, bankTransactions, stockTransactions, initialStockItems);
        
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
        setState(prev => ({...prev, initialBalanceSet: true}));
        handleApiError(error);
      }
  }, [toast, state.user, handleApiError, calculateBalancesAndStock]);
  
  useEffect(() => {
    if (state.user && sessionChecked) {
        reloadData();
    } else if (sessionChecked) {
        setState(prev => ({...prev, initialBalanceSet: true, needsInitialBalance: !state.user}));
    }
  }, [state.user, sessionChecked, reloadData]);
  
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
  
  const addCashTransaction = async (tx: Omit<CashTransaction, 'id' | 'createdAt' | 'deletedAt' | 'user_id'>) => {
    try {
      const newTx = await appendData({ tableName: 'cash_transactions', data: { ...tx } });
      if (newTx) {
          setState(prev => {
              const newTxs = [newTx, ...prev.cashTransactions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
              const newBalance = prev.cashBalance + (newTx.type === 'income' ? newTx.amount : -newTx.amount);
              return {
                  ...prev,
                  cashTransactions: newTxs,
                  cashBalance: newBalance,
              }
          })
      }
      return newTx;
    } catch (error) {
      handleApiError(error);
    }
  };

  const addBankTransaction = async (tx: Omit<BankTransaction, 'id' | 'createdAt' | 'deletedAt' | 'user_id'>) => {
    try {
        const newTx = await appendData({ tableName: 'bank_transactions', data: { ...tx } });
        if (newTx) {
            setState(prev => {
                const newTxs = [newTx, ...prev.bankTransactions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                const newBalance = prev.bankBalance + (newTx.type === 'deposit' ? newTx.amount : -newTx.amount);
                return {
                    ...prev,
                    bankTransactions: newTxs,
                    bankBalance: newBalance,
                }
            })
        }
        return newTx;
    } catch (error) {
        handleApiError(error);
    }
  };
  
  const addStockTransaction = async (tx: Omit<StockTransaction, 'id' | 'createdAt' | 'deletedAt' | 'user_id'> & { contact_id?: string, contact_name?: string }) => {
    try {
      const { contact_id, contact_name, ...stockTxData } = tx;

      const newStockTx = await appendData({ tableName: 'stock_transactions', data: stockTxData });
      if (!newStockTx) throw new Error("Stock transaction creation failed. The 'stock_transactions' table may not exist.");
      
      const totalValue = tx.weight * tx.pricePerKg;

      if (tx.paymentMethod === 'credit' && contact_id) {
          const ledgerType = tx.type === 'purchase' ? 'payable' : 'receivable';
          const description = `${tx.type === 'purchase' ? 'Purchase' : 'Sale'} of ${tx.weight}kg of ${tx.stockItemName} on credit`;
          
          if (!contact_name) throw new Error("Could not find contact name for credit transaction.");

          await addLedgerTransaction({
              type: ledgerType,
              description,
              amount: totalValue,
              date: tx.date,
              contact_id: contact_id,
              contact_name: contact_name,
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
              await addCashTransaction({ ...financialTxData, type: tx.type === 'purchase' ? 'expense' : 'income' });
          } else if (tx.paymentMethod === 'bank') { 
              await addBankTransaction({ ...financialTxData, type: tx.type === 'purchase' ? 'withdrawal' : 'deposit' });
          }
      }
      
      // We need a full reload here because stock calculations are complex
      await reloadData();
      toast({ title: "Success", description: "Stock transaction recorded."});
      return newStockTx;
    } catch (error: any) {
      handleApiError(error)
    }
  };

  const editCashTransaction = async (originalTx: CashTransaction, updatedTxData: Partial<Omit<CashTransaction, 'id' | 'date'>>) => {
      try {
        await updateData({ tableName: 'cash_transactions', id: originalTx.id, data: updatedTxData });
        toast({ title: "Success", description: "Cash transaction updated."});
        await reloadData();
      } catch (error) {
        handleApiError(error);
      }
  };

  const editBankTransaction = async (originalTx: BankTransaction, updatedTxData: Partial<Omit<BankTransaction, 'id'| 'date'>>) => {
      try {
        await updateData({ tableName: 'bank_transactions', id: originalTx.id, data: updatedTxData });
        toast({ title: "Success", description: "Bank transaction updated."});
        await reloadData();
      } catch (error) {
        handleApiError(error);
      }
  };

  const editStockTransaction = async (originalTx: StockTransaction, updatedTxData: Partial<Omit<StockTransaction, 'id' | 'date'>>) => {
      try {
        await updateData({ tableName: 'stock_transactions', id: originalTx.id, data: updatedTxData });
        toast({ 
            title: "Success", 
            description: "Stock transaction updated. Please manually update the corresponding financial transaction if amount has changed.",
            duration: 5000,
        });
        await reloadData();
      } catch (error) {
        handleApiError(error);
      }
  };

  const deleteCashTransaction = async (tx: CashTransaction) => {
    try {
        await deleteData({ tableName: "cash_transactions", id: tx.id });
        if(tx.linkedStockTxId) {
             await deleteData({ tableName: "stock_transactions", id: tx.linkedStockTxId });
        }
        toast({ title: "Success", description: "Cash transaction and any linked stock entry have been moved to the recycle bin."});
        await reloadData();
    } catch(error) {
        handleApiError(error);
    }
  };

  const deleteBankTransaction = async (tx: BankTransaction) => {
    try {
        await deleteData({ tableName: "bank_transactions", id: tx.id });
        if(tx.linkedStockTxId) {
             await deleteData({ tableName: "stock_transactions", id: tx.linkedStockTxId });
        }
        toast({ title: "Success", description: "Bank transaction and any linked stock entry have been moved to the recycle bin."});
        await reloadData();
    } catch(error) {
        handleApiError(error);
    }
  };
  
  const deleteStockTransaction = async (tx: StockTransaction) => {
    try {
        await deleteData({ tableName: "stock_transactions", id: tx.id });
        const { data: allCashTxs } = await supabase.from('cash_transactions').select('id, deletedAt').eq('linkedStockTxId', tx.id);
        if (allCashTxs && allCashTxs.length > 0 && !allCashTxs[0].deletedAt) {
            await deleteData({ tableName: "cash_transactions", id: allCashTxs[0].id });
        }

        const { data: allBankTxs } = await supabase.from('bank_transactions').select('id, deletedAt').eq('linkedStockTxId', tx.id);
        if (allBankTxs && allBankTxs.length > 0 && !allBankTxs[0].deletedAt) {
            await deleteData({ tableName: "bank_transactions", id: allBankTxs[0].id });
        }
        
        toast({ title: "Stock Transaction Deleted", description: "The corresponding financial entry was also moved to the recycle bin."});
        await reloadData();
    } catch(error) {
        handleApiError(error);
    }
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
        await Promise.all([reloadData(), loadRecycleBinData()]);
    } catch (error: any) {
        handleApiError(error);
    }
  };

  const deleteMultipleCashTransactions = async (txs: CashTransaction[]) => {
     try {
        await Promise.all(txs.map(tx => deleteData({ tableName: "cash_transactions", id: tx.id })));
        toast({ title: "Success", description: `${txs.length} cash transaction(s) deleted.`});
        await reloadData();
    } catch(error) {
        handleApiError(error);
    }
  };

  const deleteMultipleBankTransactions = async (txs: BankTransaction[]) => {
    try {
        await Promise.all(txs.map(tx => deleteData({ tableName: "bank_transactions", id: tx.id })));
        toast({ title: "Success", description: `${txs.length} bank transaction(s) deleted.`});
        await reloadData();
    } catch(error) {
        handleApiError(error);
    }
  };

  const deleteMultipleStockTransactions = async (txs: StockTransaction[]) => {
    try {
        await Promise.all(txs.map(tx => deleteData({ tableName: "stock_transactions", id: tx.id })));
        toast({ title: "Success", description: `${txs.length} stock transaction(s) deleted.`});
        await reloadData();
    } catch(error) {
        handleApiError(error);
    }
  };

  const transferFunds = async (from: 'cash' | 'bank', amount: number, date?: string) => {
     const transactionDate = date || new Date().toISOString();
     const description = from === 'cash' ? 'Transfer to Bank' : 'Transfer from Bank';

     try {
        const baseTx = { date: transactionDate, amount, description, category: 'Transfer' };
        let cashTx, bankTx;
        if(from === 'cash') {
            cashTx = await addCashTransaction({ ...baseTx, type: 'expense' });
            bankTx = await addBankTransaction({ ...baseTx, type: 'deposit' });
        } else {
            bankTx = await addBankTransaction({ ...baseTx, type: 'withdrawal' });
            cashTx = await addCashTransaction({ ...baseTx, type: 'income' });
        }
        if (cashTx && bankTx) {
          toast({ title: "Success", description: "Fund transfer completed."});
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
          setState(prev => ({
              ...prev,
              cashCategories: type === 'cash' ? [...prev.cashCategories, category] : prev.cashCategories,
              bankCategories: type === 'bank' ? [...prev.bankCategories, category] : prev.bankCategories,
          }))
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
        const operations = [];

        if (cash > 0) {
            operations.push(addCashTransaction({ date, type: 'income', amount: cash, description: 'Initial Balance', category: 'Initial Balance' }));
        }
        if (bank > 0) {
            operations.push(addBankTransaction({ date, type: 'deposit', amount: bank, description: 'Initial Balance', category: 'Initial Balance' }));
        }
        
        await Promise.all(operations);

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
            await reloadData(); // Reload is needed to recalculate aggregated stock
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
            await reloadData();

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
      const newVendor = await appendData({ tableName: 'vendors', data: { name } });
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

  const addLedgerTransaction = async (tx: Omit<LedgerTransaction, 'id' | 'createdAt' | 'deletedAt' | 'user_id' | 'status' | 'paid_amount' | 'installments'>) => {
    if (!state.user) {
        toast({ variant: 'destructive', title: 'Authentication Error', description: 'You must be logged in.' });
        return null;
    }
    try {
        const newTx = await appendData({ tableName: 'ap_ar_transactions', data: { ...tx, status: 'unpaid', paid_amount: 0 }, select: '*, installments:payment_installments(*)' });
        if(!newTx) throw new Error("Could not create ledger transaction.");
        
        setState(prev => {
            const newLedgerTxs = [newTx, ...prev.ledgerTransactions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            const totalPayables = newLedgerTxs.filter(t => t.type === 'payable' && t.status !== 'paid').reduce((acc, t) => acc + (t.amount - t.paid_amount), 0);
            const totalReceivables = newLedgerTxs.filter(t => t.type === 'receivable' && t.status !== 'paid').reduce((acc, t) => acc + (t.amount - t.paid_amount), 0);

            return {
                ...prev,
                ledgerTransactions: newLedgerTxs,
                totalPayables,
                totalReceivables
            }
        });
        
        return newTx;
    } catch (error: any) {
        handleApiError(error);
        return null;
    }
  }

  const deleteLedgerTransaction = async (tx: LedgerTransaction) => {
    if (!state.user || state.user.role !== 'admin') {
        toast({ variant: 'destructive', title: 'Permission Denied', description: 'Only admins can delete transactions.' });
        return null;
    }
    try {
        await deleteData({ tableName: 'ap_ar_transactions', id: tx.id });
        toast({ title: 'Transaction moved to recycle bin.' });
        await reloadData();
    } catch(error) {
        handleApiError(error);
    }
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
        
        toast({title: "Payment Recorded", description: "The installment has been recorded and balances updated."});
        await reloadData(); // Full reload is best here to ensure all balances are correct
        return result;
    } catch (error: any) {
         handleApiError(new Error(error.message || "An unexpected error occurred during installment recording."));
         throw error;
    }
  }

  const saveSettings = () => {
      try {
        const settingsToSave = {
            fontSize: state.fontSize,
            bodyFont: state.bodyFont,
            numberFont: state.numberFont,
            wastagePercentage: state.wastagePercentage,
            currency: state.currency,
            showStockValue: state.showStockValue,
        }
        localStorage.setItem('ha-mim-iron-mart-settings', JSON.stringify(settingsToSave));
      } catch (e) {
          console.error("Could not save settings to local storage", e);
      }
  }
  
  useEffect(() => {
    saveSettings();
  }, [state.fontSize, state.bodyFont, state.numberFont, state.wastagePercentage, state.currency, state.showStockValue])

  if (!sessionChecked && !pathname.includes('/login')) {
    return <AppLoading />;
  }

  return (
    <AppContext.Provider value={{ 
        ...state, 
        reloadData,
        reloadLedger,
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
        setBodyFont: (font) => setState(prev => ({...prev, bodyFont: font })),
        setNumberFont: (font) => setState(prev => ({...prev, numberFont: font })),
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

export function AppLoading() {
    return (
        <div className="flex items-center justify-center min-h-screen bg-background">
            <div className="flex flex-col items-center gap-4">
                <div className="loader"></div>
                <p className="text-muted-foreground">Loading your ledger...</p>
            </div>
        </div>
    );
}
