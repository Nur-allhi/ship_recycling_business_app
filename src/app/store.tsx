
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import type { CashTransaction, BankTransaction, StockItem, StockTransaction } from '@/lib/types';
import { useToast } from "@/hooks/use-toast"
import { readData, appendData, updateData, deleteData, readDeletedData, restoreData } from '@/app/actions';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';

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
  organizationName: string;
}

interface AppContextType extends AppState {
  reloadData: () => Promise<void>;
  loadRecycleBinData: () => Promise<void>;
  addCashTransaction: (tx: Omit<CashTransaction, 'id' | 'createdAt' | 'deletedAt'>) => void;
  addBankTransaction: (tx: Omit<BankTransaction, 'id' | 'createdAt' | 'deletedAt'>) => void;
  addStockTransaction: (tx: Omit<StockTransaction, 'id' | 'createdAt' | 'deletedAt'>) => void;
  editCashTransaction: (originalTx: CashTransaction, updatedTxData: Partial<Omit<CashTransaction, 'id' | 'date'>>) => void;
  editBankTransaction: (originalTx: BankTransaction, updatedTxData: Partial<Omit<BankTransaction, 'id' | 'date'>>) => void;
  editStockTransaction: (originalTx: StockTransaction, updatedTxData: Partial<Omit<StockTransaction, 'id' | 'date'>>) => void;
  deleteCashTransaction: (tx: CashTransaction) => void;
  deleteBankTransaction: (tx: BankTransaction) => void;
  deleteStockTransaction: (tx: StockTransaction) => void;
  deleteMultipleCashTransactions: (txs: CashTransaction[]) => void;
  deleteMultipleBankTransactions: (txs: BankTransaction[]) => void;
  deleteMultipleStockTransactions: (txs: StockTransaction[]) => void;
  restoreTransaction: (txType: 'cash' | 'bank' | 'stock', id: string) => void;
  transferFunds: (from: 'cash' | 'bank', amount: number, date?: string) => void;
  addCategory: (type: 'cash' | 'bank', category: string) => void;
  deleteCategory: (type: 'cash' | 'bank', category: string) => void;
  setFontSize: (size: FontSize) => void;
  setBodyFont: (font: string) => void;
  setNumberFont: (font: string) => void;
  setWastagePercentage: (percentage: number) => void;
  setCurrency: (currency: string) => void;
  setShowStockValue: (show: boolean) => void;
  setOrganizationName: (name: string) => void;
  setInitialBalances: (cash: number, bank: number) => void;
  addInitialStockItem: (item: { name: string; weight: number; pricePerKg: number }) => void;
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
  organizationName: '',
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialAppState);
  const [isInitialized, setIsInitialized] = useState(false);
  const { toast } = useToast();

  const reloadData = useCallback(async () => {
    try {
        const [cashData, bankData, stockTransactionsData, initialStockData, categoriesData] = await Promise.all([
            readData({ tableName: 'cash_transactions' }),
            readData({ tableName: 'bank_transactions' }),
            readData({ tableName: 'stock_transactions' }),
            readData({ tableName: 'initial_stock' }),
            readData({ tableName: 'categories' }),
        ]);
        
        let needsInitialBalance = true;

        const cashTransactions: CashTransaction[] = cashData.map((tx: any) => ({...tx, date: new Date(tx.date).toISOString() }));
        const bankTransactions: BankTransaction[] = bankData.map((tx: any) => ({...tx, date: new Date(tx.date).toISOString() }));

        const initialCashTx = cashTransactions.find(tx => tx.category === 'Initial Balance');
        const initialBankTx = bankTransactions.find(tx => tx.category === 'Initial Balance');
        
        if (initialCashTx || initialBankTx) {
          needsInitialBalance = false;
        }

        const stockTransactions: StockTransaction[] = stockTransactionsData.map((tx: any) => ({...tx, date: new Date(tx.date).toISOString() }));

        const initialStockItems: StockItem[] = initialStockData.map((item: any) => ({
            ...item,
            id: item.id.toString(),
            purchasePricePerKg: item.purchasePricePerKg,
        }));
        
        const finalCashBalance = cashTransactions.reduce((acc, tx) => acc + (tx.type === 'income' ? tx.amount : -tx.amount), 0);
        const finalBankBalance = bankTransactions.reduce((acc, tx) => acc + (tx.type === 'deposit' ? tx.amount : -tx.amount), 0);
        
        const stockPortfolio: Record<string, { weight: number, totalValue: number }> = {};

        initialStockItems.forEach(item => {
            if (!stockPortfolio[item.name]) {
                stockPortfolio[item.name] = { weight: 0, totalValue: 0 };
            }
            stockPortfolio[item.name].weight += item.weight;
            stockPortfolio[item.name].totalValue += item.weight * item.purchasePricePerKg;
        });

        const sortedStockTransactions = [...stockTransactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
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
        
        const cashCategories = categoriesData.filter((c: any) => c.type === 'cash').map((c: any) => c.name);
        const bankCategories = categoriesData.filter((c: any) => c.type === 'bank').map((c: any) => c.name);

        setState(prev => ({
            ...prev,
            cashTransactions: cashTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            bankTransactions: bankTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            stockItems: aggregatedStockItems,
            stockTransactions: stockTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            cashBalance: finalCashBalance,
            bankBalance: finalBankBalance,
            initialBalanceSet: true,
            needsInitialBalance,
            cashCategories: cashCategories.length > 0 ? cashCategories : prev.cashCategories,
            bankCategories: bankCategories.length > 0 ? bankCategories : prev.bankCategories,
        }));

      } catch (error: any) {
        console.error("Failed to load data from Supabase", error);
        if (error.message.includes('relation') && error.message.includes('does not exist')) {
            toast({
                variant: 'destructive',
                title: 'Database tables not found!',
                description: 'Please ensure you have created the required tables in your Supabase project.'
            });
        } else {
            toast({
                variant: 'destructive',
                title: 'Failed to load data',
                description: 'Could not connect to Supabase. Check your console for details and verify your credentials.'
            });
        }
        setState(prev => ({ ...prev, initialBalanceSet: true }));
      }
  }, [toast]);
  
  const loadRecycleBinData = useCallback(async () => {
    try {
        const [deletedCashData, deletedBankData, deletedStockData] = await Promise.all([
            readDeletedData({ tableName: 'cash_transactions' }),
            readDeletedData({ tableName: 'bank_transactions' }),
            readDeletedData({ tableName: 'stock_transactions' }),
        ]);

        setState(prev => ({
            ...prev,
            deletedCashTransactions: deletedCashData.sort((a: any, b: any) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime()),
            deletedBankTransactions: deletedBankData.sort((a: any, b: any) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime()),
            deletedStockTransactions: deletedStockData.sort((a: any, b: any) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime()),
        }));

    } catch (error) {
        console.error("Failed to load recycle bin data", error);
        toast({
            variant: 'destructive',
            title: 'Failed to load recycle bin',
            description: 'Could not fetch deleted items. Please try again later.'
        });
    }
  }, [toast]);


  useEffect(() => {
     try {
      const storedSettings = localStorage.getItem('shipshape-ledger-settings');
      let settings = {};
      if (storedSettings) {
        settings = JSON.parse(storedSettings);
      }
      setState(prev => ({ ...prev, ...settings }));
    } catch (e) {
        console.error("Could not parse settings from local storage", e)
    }

    reloadData();
    setIsInitialized(true);
  }, [reloadData]);

  useEffect(() => {
    if (isInitialized) {
      try {
        const settingsToStore = {
            fontSize: state.fontSize,
            bodyFont: state.bodyFont,
            numberFont: state.numberFont,
            wastagePercentage: state.wastagePercentage,
            currency: state.currency,
            showStockValue: state.showStockValue,
            organizationName: state.organizationName,
        }
        localStorage.setItem('shipshape-ledger-settings', JSON.stringify(settingsToStore));
      } catch (error) {
        console.error("Failed to save settings to localStorage", error);
      }
    }
  }, [state.fontSize, state.bodyFont, state.numberFont, state.wastagePercentage, state.currency, state.showStockValue, state.organizationName, isInitialized]);
  
  const addCashTransaction = async (tx: Omit<CashTransaction, 'id' | 'createdAt' | 'deletedAt'>) => {
    try {
      await appendData({ tableName: 'cash_transactions', data: tx });
      toast({ title: "Success", description: "Cash transaction added."});
      await reloadData();
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: "Error", description: "Failed to add cash transaction."});
    }
  };

  const addBankTransaction = async (tx: Omit<BankTransaction, 'id' | 'createdAt' | 'deletedAt'>) => {
     try {
      await appendData({ tableName: 'bank_transactions', data: tx });
      toast({ title: "Success", description: "Bank transaction added."});
      await reloadData();
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: "Error", description: "Failed to add bank transaction."});
    }
  };
  
  const addStockTransaction = async (tx: Omit<StockTransaction, 'id' | 'createdAt' | 'deletedAt'>) => {
    try {
      const [newStockTx] = await appendData({ tableName: 'stock_transactions', data: tx });
      if (!newStockTx) throw new Error("Stock transaction creation failed.");

      const totalValue = tx.weight * tx.pricePerKg;
      const description = `${tx.type === 'purchase' ? 'Purchase' : 'Sale'} of ${tx.weight}kg of ${tx.stockItemName}`;
      const category = tx.type === 'purchase' ? 'Stock Purchase' : 'Stock Sale';
      const financialTxData = {
          date: tx.date,
          amount: totalValue,
          description,
          category,
          linkedStockTxId: newStockTx.id // Link financial tx to stock tx
      };

      if (tx.paymentMethod === 'cash') {
          await addCashTransaction({
              ...financialTxData,
              type: tx.type === 'purchase' ? 'expense' : 'income',
          });
      } else { // bank
          await addBankTransaction({
              ...financialTxData,
              type: tx.type === 'purchase' ? 'withdrawal' : 'deposit',
          });
      }

      toast({ title: "Success", description: "Stock transaction and financial entry added."});
      // reloadData is already called by addCash/BankTransaction, so no need to call it again here.
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: "Error", description: "Failed to add stock transaction."});
    }
  };

  const editCashTransaction = async (originalTx: CashTransaction, updatedTxData: Partial<Omit<CashTransaction, 'id' | 'date'>>) => {
      try {
        await updateData({ tableName: 'cash_transactions', id: originalTx.id, data: updatedTxData });
        toast({ title: "Success", description: "Cash transaction updated."});
        await reloadData();
      } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: "Error", description: "Failed to update cash transaction."});
      }
  };

  const editBankTransaction = async (originalTx: BankTransaction, updatedTxData: Partial<Omit<BankTransaction, 'id'| 'date'>>) => {
      try {
        await updateData({ tableName: 'bank_transactions', id: originalTx.id, data: updatedTxData });
        toast({ title: "Success", description: "Bank transaction updated."});
        await reloadData();
      } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: "Error", description: "Failed to update bank transaction."});
      }
  };

  const editStockTransaction = async (originalTx: StockTransaction, updatedTxData: Partial<Omit<StockTransaction, 'id' | 'date'>>) => {
      try {
        // This function is tricky because changing weight/price should update the linked financial tx.
        // For now, we show a toast to prompt the user to do it manually.
        // A more advanced implementation would handle this automatically.
        await updateData({ tableName: 'stock_transactions', id: originalTx.id, data: updatedTxData });
        toast({ 
            title: "Success", 
            description: "Stock transaction updated. Please manually update the corresponding financial transaction if amount has changed.",
            duration: 5000,
        });
        await reloadData();
      } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: "Error", description: "Failed to update stock transaction."});
      }
  };

  const deleteCashTransaction = async (tx: CashTransaction) => {
    try {
        // If this cash tx is linked to a stock tx, delete the stock tx as well.
        if(tx.linkedStockTxId) {
             await deleteData({ tableName: "stock_transactions", id: tx.linkedStockTxId });
        }
        await deleteData({ tableName: "cash_transactions", id: tx.id });
        toast({ title: "Success", description: "Cash transaction and any linked stock entry have been moved to the recycle bin."});
        await reloadData();
    } catch(error) {
        console.error(error);
        toast({ variant: 'destructive', title: "Error", description: "Failed to delete cash transaction."});
    }
  };

  const deleteBankTransaction = async (tx: BankTransaction) => {
    try {
        // If this bank tx is linked to a stock tx, delete the stock tx as well.
        if(tx.linkedStockTxId) {
             await deleteData({ tableName: "stock_transactions", id: tx.linkedStockTxId });
        }
        await deleteData({ tableName: "bank_transactions", id: tx.id });
        toast({ title: "Success", description: "Bank transaction and any linked stock entry have been moved to the recycle bin."});
        await reloadData();
    } catch(error) {
        console.error(error);
        toast({ variant: 'destructive', title: "Error", description: "Failed to delete bank transaction."});
    }
  };
  
  const deleteStockTransaction = async (tx: StockTransaction) => {
    try {
        // Find and delete the linked financial transaction first
        const { data: cashTx } = await supabase.from('cash_transactions').select('id').eq('linkedStockTxId', tx.id).maybeSingle();
        if (cashTx) {
            await deleteData({ tableName: "cash_transactions", id: cashTx.id });
        }

        const { data: bankTx } = await supabase.from('bank_transactions').select('id').eq('linkedStockTxId', tx.id).maybeSingle();
        if (bankTx) {
            await deleteData({ tableName: "bank_transactions", id: bankTx.id });
        }

        await deleteData({ tableName: "stock_transactions", id: tx.id });
        toast({ title: "Stock Transaction Deleted", description: "The corresponding financial entry was also moved to the recycle bin."});
        await reloadData();
    } catch(error) {
        console.error(error);
        toast({ variant: 'destructive', title: "Error", description: "Failed to delete stock transaction and its linked financial entry."});
    }
  };
  
  const restoreTransaction = async (txType: 'cash' | 'bank' | 'stock', id: string) => {
    const tableName = `${txType}_transactions`;
    try {
        // Restore the main transaction
        await restoreData({ tableName, id });

        // Check for and restore linked transactions
        if (txType === 'cash' || txType === 'bank') {
            // Find the financial transaction that was just restored
            const { data: finTx } = await supabase.from(tableName).select('linkedStockTxId').eq('id', id).maybeSingle();
            if (finTx?.linkedStockTxId) {
                 await restoreData({ tableName: 'stock_transactions', id: finTx.linkedStockTxId });
            }
        }
         
        if (txType === 'stock') {
             // Find the linked cash or bank transaction based on the stock transaction's ID
            const { data: cashTx } = await supabase.from('cash_transactions').select('id').eq('linkedStockTxId', id).maybeSingle();
            if (cashTx) await restoreData({ tableName: 'cash_transactions', id: cashTx.id });

            const { data: bankTx } = await supabase.from('bank_transactions').select('id').eq('linkedStockTxId', id).maybeSingle();
            if (bankTx) await restoreData({ tableName: 'bank_transactions', id: bankTx.id });
        }
        
        toast({ title: "Transaction Restored", description: "The item and any linked transactions have been restored." });
        await Promise.all([reloadData(), loadRecycleBinData()]);
    } catch (error) {
        console.error("Failed to restore transaction", error);
        toast({ variant: 'destructive', title: "Error", description: "Failed to restore the transaction." });
    }
  };

  const deleteMultipleCashTransactions = async (txs: CashTransaction[]) => {
     try {
        // Use Promise.all to run deletions in parallel for better performance
        await Promise.all(txs.map(tx => deleteCashTransaction(tx)));
        toast({ title: "Success", description: `${txs.length} cash transaction(s) deleted.`});
        await reloadData(); // Single reload after all deletions are done
    } catch(error) {
        console.error(error);
        toast({ variant: 'destructive', title: "Error", description: "Failed to delete multiple cash transactions."});
    }
  };

  const deleteMultipleBankTransactions = async (txs: BankTransaction[]) => {
    try {
        await Promise.all(txs.map(tx => deleteBankTransaction(tx)));
        toast({ title: "Success", description: `${txs.length} bank transaction(s) deleted.`});
        await reloadData();
    } catch(error) {
        console.error(error);
        toast({ variant: 'destructive', title: "Error", description: "Failed to delete multiple bank transactions."});
    }
  };

  const deleteMultipleStockTransactions = async (txs: StockTransaction[]) => {
    try {
        await Promise.all(txs.map(tx => deleteStockTransaction(tx)));
        toast({ title: "Success", description: `${txs.length} stock transaction(s) deleted.`});
        await reloadData();
    } catch(error) {
        console.error(error);
        toast({ variant: 'destructive', title: "Error", description: "Failed to delete multiple stock transactions."});
    }
  };

  const transferFunds = async (from: 'cash' | 'bank', amount: number, date?: string) => {
     const transactionDate = date || new Date().toISOString();
     const description = from === 'cash' ? 'Transfer to Bank' : 'Transfer from Bank';
     
     try {
        if(from === 'cash') {
            await addCashTransaction({ date: transactionDate, type: 'expense', amount, description, category: 'Transfer'});
            await addBankTransaction({ date: transactionDate, type: 'deposit', amount, description, category: 'Transfer'});
        } else { // from bank
            await addBankTransaction({ date: transactionDate, type: 'withdrawal', amount, description, category: 'Transfer'});
            await addCashTransaction({ date: transactionDate, type: 'income', amount, description, category: 'Transfer'});
        }
        toast({ title: "Success", description: "Fund transfer completed."});
        // reloadData is called by add...Transaction
     } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: "Error", description: "Failed to complete fund transfer."});
     }
  };

  const addCategory = async (type: 'cash' | 'bank', category: string) => {
    const categories = type === 'cash' ? state.cashCategories : state.bankCategories;
    if (categories.includes(category) || !category) return;
    
    try {
      await appendData({ tableName: 'categories', data: { name: category, type } });
      toast({ title: "Success", description: "Category added." });
      await reloadData();
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: "Error", description: "Failed to add category." });
    }
  };

  const deleteCategory = async (type: 'cash' | 'bank', category: string) => {
    // Deleting from the database is complex. It requires finding the category's ID first
    // and ensuring no transactions are using it. For now, we only update the local state
    // to avoid leaving the app in a broken state. A proper implementation would need a
    // more robust backend approach, possibly with a check for existing usage.
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
          await addCashTransaction({ date: new Date().toISOString(), type: 'income', amount: cash, description: 'Initial Balance', category: 'Initial Balance'});
          await addBankTransaction({ date: new Date().toISOString(), type: 'deposit', amount: bank, description: 'Initial Balance', category: 'Initial Balance'});
          toast({ title: "Initial balances set." });
          await reloadData();
      } catch (e) {
          console.error(e);
          toast({variant: 'destructive', title: 'Failed to set initial balances'});
      }
  }

  const addInitialStockItem = async (item: { name: string; weight: number; pricePerKg: number }) => {
      try {
        const { name, weight, pricePerKg } = item;
        await appendData({ tableName: 'initial_stock', data: { name, weight, purchasePricePerKg: pricePerKg } });
        toast({ title: "Initial stock item added." });
        await reloadData();
      } catch (e) {
          console.error(e);
          toast({variant: 'destructive', title: 'Failed to add initial stock item.'});
      }
  }

  const setFontSize = (size: FontSize) => setState(prev => ({ ...prev, fontSize: size }));
  const setBodyFont = (font: string) => setState(prev => ({ ...prev, bodyFont: font }));
  const setNumberFont = (font: string) => setState(prev => ({ ...prev, numberFont: font }));
  const setWastagePercentage = (percentage: number) => setState(prev => ({ ...prev, wastagePercentage: percentage }));
  const setCurrency = (currency: string) => setState(prev => ({ ...prev, currency }));
  const setShowStockValue = (show: boolean) => setState(prev => ({ ...prev, showStockValue: show }));
  const setOrganizationName = (name: string) => setState(prev => ({...prev, organizationName: name}));

  const value: AppContextType = {
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
    restoreTransaction,
    transferFunds,
    addCategory,
    deleteCategory,
    setFontSize,
    setBodyFont,
    setNumberFont,
    setWastagePercentage,
    setCurrency,
    setShowStockValue,
    setOrganizationName,
    setInitialBalances,
    addInitialStockItem,
  };

  return <AppContext.Provider value={value}>{isInitialized ? children : <div className="flex items-center justify-center min-h-screen">Loading...</div>}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
