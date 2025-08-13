
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import type { CashTransaction, BankTransaction, StockItem, StockTransaction } from '@/lib/types';
import { useToast } from "@/hooks/use-toast"
import { readSheetData, appendSheetRow, updateSheetRow, deleteSheetRow } from '@/app/actions';
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
  needsSetup: boolean;
  wastagePercentage: number;
  currency: string;
  showStockValue: boolean;
  organizationName: string;
}

interface AppContextType extends AppState {
  reloadData: () => Promise<void>;
  addCashTransaction: (tx: Omit<CashTransaction, 'id' | 'rowIndex'>) => void;
  addBankTransaction: (tx: Omit<BankTransaction, 'id' | 'rowIndex'>) => void;
  addStockTransaction: (tx: Omit<StockTransaction, 'id' | 'rowIndex'>) => void;
  editCashTransaction: (originalTx: CashTransaction, updatedTxData: Omit<CashTransaction, 'id' | 'date' | 'rowIndex'>) => void;
  editBankTransaction: (originalTx: BankTransaction, updatedTxData: Omit<BankTransaction, 'id' | 'date' | 'rowIndex'>) => void;
  editStockTransaction: (originalTx: StockTransaction, updatedTxData: Omit<StockTransaction, 'id'| 'date'| 'rowIndex'>) => void;
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
  setNeedsSetup: (needs: boolean) => void;
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
  needsSetup: false,
  wastagePercentage: 0,
  currency: 'BDT',
  showStockValue: false,
  organizationName: '',
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialAppState);
  const [isInitialized, setIsInitialized] = useState(false);
  const { toast } = useToast();

  const setNeedsSetup = (needs: boolean) => {
    setState(prev => ({ ...prev, needsSetup: needs }));
  }

  const reloadData = useCallback(async () => {
    try {
        setState(prev => ({ ...prev, initialBalanceSet: false })); // Show loading indicator
        
        const fetchData = async (range: string, sheetName: string) => {
          try {
            return await readSheetData({ range });
          } catch (error: any) {
            if (error.message.includes("Unable to parse range")) {
                 setState(prev => ({ ...prev, needsSetup: true }));
            }
            console.warn(`Could not read from sheet "${sheetName}". It might not exist yet. Returning empty array.`, error.message);
            return []; // Return empty array to prevent crash
          }
        }
        
        const [cashData, bankData, stockTransactionsData, initialStockData] = await Promise.all([
            fetchData('Cash!A2:E', 'Cash'),
            fetchData('Bank!A2:E', 'Bank'),
            fetchData('Stock Transactions!A2:G', 'Stock Transactions'),
            fetchData('Initial Stock!A2:C', 'Initial Stock'),
        ]);
        
        let needsInitialBalance = true;

        const cashTransactions: CashTransaction[] = cashData
            .map((row, index) => ({
                id: `cash-${index}`,
                rowIndex: index + 2,
                date: row[0] ? new Date(row[0]).toISOString() : new Date().toISOString(),
                type: row[1]?.toLowerCase() as 'income' | 'expense',
                amount: parseFloat(row[2]) || 0,
                description: row[3] || '',
                category: row[4] || '',
            }))
            .filter(tx => tx.date && tx.type && !isNaN(tx.amount));
        
        const bankTransactions: BankTransaction[] = bankData
             .map((row, index) => ({
                id: `bank-${index}`,
                rowIndex: index + 2,
                date: row[0] ? new Date(row[0]).toISOString() : new Date().toISOString(),
                type: row[1]?.toLowerCase() as 'deposit' | 'withdrawal',
                amount: parseFloat(row[2]) || 0,
                description: row[3] || '',
                category: row[4] || '',
            }))
            .filter(tx => tx.date && tx.type && !isNaN(tx.amount));
        
        const initialCashTx = cashTransactions.find(tx => tx.category === 'Initial');
        const initialBankTx = bankTransactions.find(tx => tx.category === 'Initial');

        if (initialCashTx || initialBankTx) {
          needsInitialBalance = false;
        }

        const stockTransactions: StockTransaction[] = stockTransactionsData
            .map((row, index) => ({
                id: `stock-tx-${index}`,
                rowIndex: index + 2,
                date: row[0] ? new Date(row[0]).toISOString() : new Date().toISOString(),
                type: row[1]?.toLowerCase() as 'purchase' | 'sale',
                stockItemName: row[2] || '',
                weight: parseFloat(row[3]) || 0,
                pricePerKg: parseFloat(row[4]) || 0,
                paymentMethod: row[5]?.toLowerCase() as 'cash' | 'bank',
                description: row[6] || '',
            }))
            .filter(tx => tx.date && tx.type && tx.stockItemName && !isNaN(tx.weight) && !isNaN(tx.pricePerKg));

        const initialStockItems: StockItem[] = initialStockData.map((row, index) => ({
            id: `initial-stock-${index}`,
            rowIndex: index + 2,
            name: row[0] || '',
            weight: parseFloat(row[1]) || 0,
            purchasePricePerKg: parseFloat(row[2]) || 0,
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
            rowIndex: 0 // Not applicable for aggregated view
        }));


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
            needsSetup: state.needsSetup, // Persist needsSetup flag if already set
        }));

      } catch (error) {
        console.error("Failed to load data from Google Sheets", error);
        toast({
            variant: 'destructive',
            title: 'Failed to load data',
            description: 'Could not connect to Google Sheets. Please check your setup and sheet names (Cash, Bank, Stock Transactions, Initial Stock).'
        });
        setState(prev => ({ ...prev, initialBalanceSet: true, needsSetup: true }));
      }
  }, [toast, state.needsSetup]);


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
            cashCategories: state.cashCategories,
            bankCategories: state.bankCategories,
        }
        localStorage.setItem('shipshape-ledger-settings', JSON.stringify(settingsToStore));
      } catch (error) {
        console.error("Failed to save settings to localStorage", error);
      }
    }
  }, [state, isInitialized]);
  
  const addCashTransaction = async (tx: Omit<CashTransaction, 'id' | 'rowIndex'>) => {
    try {
      await appendSheetRow({
        range: 'Cash!A:E',
        values: [format(new Date(tx.date), 'MM/dd/yyyy'), tx.type, tx.amount, tx.description, tx.category]
      });
      toast({ title: "Success", description: "Cash transaction added to sheet."});
      await reloadData();
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: "Error", description: "Failed to add cash transaction."});
    }
  };

  const addBankTransaction = async (tx: Omit<BankTransaction, 'id' | 'rowIndex'>) => {
     try {
      await appendSheetRow({
        range: 'Bank!A:E',
        values: [format(new Date(tx.date), 'MM/dd/yyyy'), tx.type, tx.amount, tx.description, tx.category]
      });
      toast({ title: "Success", description: "Bank transaction added to sheet."});
      await reloadData();
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: "Error", description: "Failed to add bank transaction."});
    }
  };
  
  const addStockTransaction = async (tx: Omit<StockTransaction, 'id' | 'rowIndex'>) => {
     try {
      // 1. Add the stock transaction itself
      await appendSheetRow({
        range: 'Stock Transactions!A:G',
        values: [format(new Date(tx.date), 'MM/dd/yyyy'), tx.type, tx.stockItemName, tx.weight, tx.pricePerKg, tx.paymentMethod, tx.description]
      });

      // 2. Add the corresponding financial transaction
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

  const editCashTransaction = async (originalTx: CashTransaction, updatedTxData: Omit<CashTransaction, 'id' | 'date' | 'rowIndex'>) => {
      try {
        if(originalTx.rowIndex === 0) {
            toast({ variant: 'destructive', title: "Error", description: "Cannot edit transactions generated from stock movements."});
            return;
        }
        const range = `Cash!A${originalTx.rowIndex}:E${originalTx.rowIndex}`;
        const values = [format(new Date(originalTx.date), 'MM/dd/yyyy'), updatedTxData.type, updatedTxData.amount, updatedTxData.description, updatedTxData.category];
        await updateSheetRow({ range, values });
        toast({ title: "Success", description: "Cash transaction updated."});
        await reloadData();
      } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: "Error", description: "Failed to update cash transaction."});
      }
  };

  const editBankTransaction = async (originalTx: BankTransaction, updatedTxData: Omit<BankTransaction, 'id' | 'date' | 'rowIndex'>) => {
      try {
        if(originalTx.rowIndex === 0) {
            toast({ variant: 'destructive', title: "Error", description: "Cannot edit transactions generated from stock movements."});
            return;
        }
        const range = `Bank!A${originalTx.rowIndex}:E${originalTx.rowIndex}`;
        const values = [format(new Date(originalTx.date), 'MM/dd/yyyy'), updatedTxData.type, updatedTxData.amount, updatedTxData.description, updatedTxData.category];
        await updateSheetRow({ range, values });
        toast({ title: "Success", description: "Bank transaction updated."});
        await reloadData();
      } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: "Error", description: "Failed to update bank transaction."});
      }
  };

  const editStockTransaction = async (originalTx: StockTransaction, updatedTxData: Omit<StockTransaction, 'id' | 'date' | 'rowIndex'>) => {
      try {
        const range = `Stock Transactions!A${originalTx.rowIndex}:G${originalTx.rowIndex}`;
        const values = [format(new Date(originalTx.date), 'MM/dd/yyyy'), updatedTxData.type, updatedTxData.stockItemName, updatedTxData.weight, updatedTxData.pricePerKg, updatedTxData.paymentMethod, updatedTxData.description];
        await updateSheetRow({ range, values });
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
        await deleteSheetRow({ sheetName: "Cash", rowIndex: tx.rowIndex });
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
        await deleteSheetRow({ sheetName: "Bank", rowIndex: tx.rowIndex });
        toast({ title: "Success", description: "Bank transaction deleted."});
        await reloadData();
    } catch(error) {
        console.error(error);
        toast({ variant: 'destructive', title: "Error", description: "Failed to delete bank transaction."});
    }
  };
  
  const deleteStockTransaction = async (tx: StockTransaction) => {
    try {
        await deleteSheetRow({ sheetName: "Stock Transactions", rowIndex: tx.rowIndex });
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
        const sortedTxs = [...txs].sort((a,b) => b.rowIndex - a.rowIndex);
        for(const tx of sortedTxs) {
            await deleteSheetRow({ sheetName: "Cash", rowIndex: tx.rowIndex });
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
        const sortedTxs = [...txs].sort((a,b) => b.rowIndex - a.rowIndex);
        for(const tx of sortedTxs) {
            await deleteSheetRow({ sheetName: "Bank", rowIndex: tx.rowIndex });
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
        const sortedTxs = [...txs].sort((a,b) => b.rowIndex - a.rowIndex);
        for(const tx of sortedTxs) {
            await deleteSheetRow({ sheetName: "Stock Transactions", rowIndex: tx.rowIndex });
        }
        toast({ title: "Success", description: `${txs.length} stock transactions deleted. Please manually delete corresponding financial entries.`});
        await reloadData();
    } catch(error) {
        console.error(error);
        toast({ variant: 'destructive', title: "Error", description: "Failed to delete multiple stock transactions."});
    }
  };

  const transferFunds = async (from: 'cash' | 'bank', amount: number, date?: string) => {
     const transactionDate = date ? new Date(date) : new Date();
     const formattedDate = format(transactionDate, 'MM/dd/yyyy');
     const description = from === 'cash' ? 'Transfer to Bank' : 'Transfer from Bank';
     
     try {
        if(from === 'cash') {
            await appendSheetRow({ range: 'Cash!A:E', values: [formattedDate, 'expense', amount, description, 'Transfer']});
            await appendSheetRow({ range: 'Bank!A:E', values: [formattedDate, 'deposit', amount, description, 'Transfer']});
        } else { // from bank
            await appendSheetRow({ range: 'Bank!A:E', values: [formattedDate, 'withdrawal', amount, description, 'Transfer']});
            await appendSheetRow({ range: 'Cash!A:E', values: [formattedDate, 'income', amount, description, 'Transfer']});
        }
        toast({ title: "Success", description: "Fund transfer completed."});
        await reloadData();
     } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: "Error", description: "Failed to complete fund transfer."});
     }
  };

  const addCategory = (type: 'cash' | 'bank', category: string) => {
    setState(prev => {
      const categories = type === 'cash' ? prev.cashCategories : prev.bankCategories;
      if (categories.includes(category) || !category) return prev;
      const newCategories = [...categories, category];
      const newState = type === 'cash'
        ? { ...prev, cashCategories: newCategories }
        : { ...prev, bankCategories: newCategories };
      
      const storedSettings = JSON.parse(localStorage.getItem('shipshape-ledger-settings') || '{}');
      storedSettings[`${type}Categories`] = newCategories;
      localStorage.setItem('shipshape-ledger-settings', JSON.stringify(storedSettings));

      return newState;
    });
  };

  const deleteCategory = (type: 'cash' | 'bank', category: string) => {
    setState(prev => {
      const categories = type === 'cash' ? prev.cashCategories : prev.bankCategories;
      const newCategories = categories.filter(c => c !== category);
       const newState = type === 'cash'
        ? { ...prev, cashCategories: newCategories }
        : { ...prev, bankCategories: newCategories };
      
      const storedSettings = JSON.parse(localStorage.getItem('shipshape-ledger-settings') || '{}');
      storedSettings[`${type}Categories`] = newCategories;
      localStorage.setItem('shipshape-ledger-settings', JSON.stringify(storedSettings));

      return newState;
    });
  };

  const setInitialBalances = async (cash: number, bank: number) => {
      try {
          await appendSheetRow({ range: 'Cash!A:E', values: [format(new Date(), 'MM/dd/yyyy'), 'income', cash, 'Initial Balance', 'Initial']});
          await appendSheetRow({ range: 'Bank!A:E', values: [format(new Date(), 'MM/dd/yyyy'), 'deposit', bank, 'Initial Balance', 'Initial']});
          toast({ title: "Initial balances set." });
          await reloadData();
      } catch (e) {
          console.error(e);
          toast({variant: 'destructive', title: 'Failed to set initial balances'});
      }
  }

  const addInitialStockItem = async (item: { name: string; weight: number; pricePerKg: number }) => {
      try {
        await appendSheetRow({
            range: 'Initial Stock!A:C',
            values: [item.name, item.weight, item.pricePerKg]
        });
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
    setNeedsSetup,
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
