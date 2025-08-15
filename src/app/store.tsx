
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import type { CashTransaction, BankTransaction, StockItem, StockTransaction } from '@/lib/types';
import { useToast } from "@/hooks/use-toast"
import { readData, appendData, updateData, deleteData } from '@/app/actions';
import { format } from 'date-fns';

type FontSize = 'sm' | 'base' | 'lg';

interface AppState {
  cashBalance: number;
  cashTransactions: CashTransaction[];
  bankBalance: number;
  bankTransactions: BankTransaction[];
  stockItems: StockItem[];
  stockTransactions: StockTransaction[];
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
  addCashTransaction: (tx: Omit<CashTransaction, 'id'>) => void;
  addBankTransaction: (tx: Omit<BankTransaction, 'id'>) => void;
  addStockTransaction: (tx: Omit<StockTransaction, 'id'>) => void;
  editCashTransaction: (originalTx: CashTransaction, updatedTxData: Partial<Omit<CashTransaction, 'id' | 'date'>>) => void;
  editBankTransaction: (originalTx: BankTransaction, updatedTxData: Partial<Omit<BankTransaction, 'id' | 'date'>>) => void;
  editStockTransaction: (originalTx: StockTransaction, updatedTxData: Partial<Omit<StockTransaction, 'id' | 'date'>>) => void;
  deleteCashTransaction: (tx: CashTransaction) => void;
  deleteBankTransaction: (tx: BankTransaction) => void;
  deleteStockTransaction: (tx: StockTransaction) => void;
  deleteMultipleCashTransactions: (txs: CashTransaction[]) => void;
  deleteMultipleBankTransactions: (txs: BankTransaction[]) => void;
  deleteMultipleStockTransactions: (txs: StockTransaction[]) => void;
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
  
  const addCashTransaction = async (tx: Omit<CashTransaction, 'id'>) => {
    try {
      await appendData({ tableName: 'cash_transactions', data: tx });
      toast({ title: "Success", description: "Cash transaction added."});
      await reloadData();
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: "Error", description: "Failed to add cash transaction."});
    }
  };

  const addBankTransaction = async (tx: Omit<BankTransaction, 'id'>) => {
     try {
      await appendData({ tableName: 'bank_transactions', data: tx });
      toast({ title: "Success", description: "Bank transaction added."});
      await reloadData();
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: "Error", description: "Failed to add bank transaction."});
    }
  };
  
  const addStockTransaction = async (tx: Omit<StockTransaction, 'id'>) => {
     try {
      await appendData({ tableName: 'stock_transactions', data: tx });

      const totalValue = tx.weight * tx.pricePerKg;
      const description = `${tx.type === 'purchase' ? 'Purchase' : 'Sale'} of ${tx.stockItemName}`;
      const category = tx.type === 'purchase' ? 'Stock Purchase' : 'Stock Sale';

      if (tx.paymentMethod === 'cash') {
          await addCashTransaction({
              date: tx.date,
              type: tx.type === 'purchase' ? 'expense' : 'income',
              amount: totalValue,
              description,
              category
          });
      } else { // bank
          await addBankTransaction({
              date: tx.date,
              type: tx.type === 'purchase' ? 'withdrawal' : 'deposit',
              amount: totalValue,
              description,
              category
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
        await updateData({ tableName: 'stock_transactions', id: originalTx.id, data: updatedTxData });
        toast({ title: "Success", description: "Stock transaction updated. Please manually update the corresponding financial transaction."});
        await reloadData();
      } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: "Error", description: "Failed to update stock transaction."});
      }
  };

  const deleteCashTransaction = async (tx: CashTransaction) => {
    try {
        if(['Stock Purchase', 'Stock Sale'].includes(tx.category)) {
             toast({ variant: 'destructive', title: "Deletion Prohibited", description: "This transaction came from a stock movement. Please delete the original stock transaction instead."});
             return;
        }
        await deleteData({ tableName: "cash_transactions", id: tx.id });
        toast({ title: "Success", description: "Cash transaction deleted."});
        await reloadData();
    } catch(error) {
        console.error(error);
        toast({ variant: 'destructive', title: "Error", description: "Failed to delete cash transaction."});
    }
  };

  const deleteBankTransaction = async (tx: BankTransaction) => {
    try {
         if(['Stock Purchase', 'Stock Sale'].includes(tx.category)) {
             toast({ variant: 'destructive', title: "Deletion Prohibited", description: "This transaction came from a stock movement. Please delete the original stock transaction instead."});
             return;
        }
        await deleteData({ tableName: "bank_transactions", id: tx.id });
        toast({ title: "Success", description: "Bank transaction deleted."});
        await reloadData();
    } catch(error) {
        console.error(error);
        toast({ variant: 'destructive', title: "Error", description: "Failed to delete bank transaction."});
    }
  };
  
  const deleteStockTransaction = async (tx: StockTransaction) => {
    try {
        await deleteData({ tableName: "stock_transactions", id: tx.id });
        toast({ title: "Stock Transaction Deleted", description: "Please manually delete the corresponding entry from your Cash or Bank ledger."});
        await reloadData();
    } catch(error) {
        console.error(error);
        toast({ variant: 'destructive', title: "Error", description: "Failed to delete stock transaction."});
    }
  };

  const deleteMultipleCashTransactions = async (txs: CashTransaction[]) => {
     try {
        if(txs.some(tx => ['Stock Purchase', 'Stock Sale'].includes(tx.category))) {
            toast({ variant: 'destructive', title: "Error", description: "Cannot delete transactions generated from stock movements in bulk."});
            return;
        }
        for(const tx of txs) {
            await deleteData({ tableName: "cash_transactions", id: tx.id });
        }
        toast({ title: "Success", description: `${txs.length} cash transactions deleted.`});
        await reloadData();
    } catch(error) {
        console.error(error);
        toast({ variant: 'destructive', title: "Error", description: "Failed to delete multiple cash transactions."});
    }
  };

  const deleteMultipleBankTransactions = async (txs: BankTransaction[]) => {
    try {
        if(txs.some(tx => ['Stock Purchase', 'Stock Sale'].includes(tx.category))) {
            toast({ variant: 'destructive', title: "Error", description: "Cannot delete transactions generated from stock movements in bulk."});
            return;
        }
        for(const tx of txs) {
            await deleteData({ tableName: "bank_transactions", id: tx.id });
        }
        toast({ title: "Success", description: `${txs.length} bank transactions deleted.`});
        await reloadData();
    } catch(error) {
        console.error(error);
        toast({ variant: 'destructive', title: "Error", description: "Failed to delete multiple bank transactions."});
    }
  };

  const deleteMultipleStockTransactions = async (txs: StockTransaction[]) => {
    try {
        for(const tx of txs) {
            await deleteData({ tableName: "stock_transactions", id: tx.id });
        }
        toast({ title: "Success", description: `${txs.length} stock transactions deleted. Please manually delete corresponding financial entries.`});
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
    // This is more complex with a database, would need to find the category's ID first.
    // For now, let's keep it simple and just remove from local state. A real implementation
    // would require a proper ID-based deletion.
    console.warn("Deleting categories from the database is not fully implemented yet.");
    setState(prev => {
      const categories = type === 'cash' ? prev.cashCategories : prev.bankCategories;
      const newCategories = categories.filter(c => c !== category);
       return type === 'cash'
        ? { ...prev, cashCategories: newCategories }
        : { ...prev, bankCategories: newCategories };
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
        await appendData({ tableName: 'initial_stock', data: item });
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
