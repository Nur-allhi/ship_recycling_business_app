
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { CashTransaction, BankTransaction, StockItem, StockTransaction } from '@/lib/types';
import { useToast } from "@/hooks/use-toast"
import { Button } from '@/components/ui/button';
import { readSheetData } from '@/ai/flows/sheet-reader-flow';

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
  wastagePercentage: number;
  currency: string;
  showStockValue: boolean;
  organizationName: string;
}

interface AppContextType extends AppState {
  setInitialBalances: (cash: number, bank: number) => void;
  addInitialStockItem: (item: { name: string, weight: number, pricePerKg: number}) => void;
  addCashTransaction: (tx: Omit<CashTransaction, 'id'>) => void;
  addBankTransaction: (tx: Omit<BankTransaction, 'id'>) => void;
  addStockTransaction: (tx: Omit<StockTransaction, 'id'>) => void;
  editCashTransaction: (originalTx: CashTransaction, updatedTxData: Omit<CashTransaction, 'id' | 'date'>) => void;
  editBankTransaction: (originalTx: BankTransaction, updatedTxData: Omit<BankTransaction, 'id' | 'date'>) => void;
  editStockTransaction: (originalTx: StockTransaction, updatedTxData: Omit<StockTransaction, 'id' | 'date'>) => void;
  deleteCashTransaction: (txId: string) => void;
  deleteBankTransaction: (txId: string) => void;
  deleteStockTransaction: (txId: string) => void;
  deleteMultipleCashTransactions: (txIds: string[]) => void;
  deleteMultipleBankTransactions: (txIds: string[]) => void;
  deleteMultipleStockTransactions: (txIds: string[]) => void;
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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const initialAppState: AppState = {
  cashBalance: 0,
  cashTransactions: [],
  bankBalance: 0,
  bankTransactions: [],
  stockItems: [],
  stockTransactions: [],
  cashCategories: ['Salary', 'Groceries', 'Transport', 'Utilities'],
  bankCategories: ['Deposit', 'Withdrawal'],
  fontSize: 'base',
  bodyFont: "'Roboto Slab', serif",
  numberFont: "'Roboto Mono', monospace",
  initialBalanceSet: false, // This will be set to true after fetch
  wastagePercentage: 0,
  currency: 'BDT',
  showStockValue: false,
  organizationName: '',
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialAppState);
  const [isInitialized, setIsInitialized] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    async function loadData() {
      try {
        // Fetch from Google Sheets
        const [cashData, bankData, stockData] = await Promise.all([
          readSheetData({ range: 'Cash!A2:E' }), // Assuming headers are in row 1
          readSheetData({ range: 'Bank!A2:E' }),
          readSheetData({ range: 'Stock!A2:D' })
        ]);

        // Process Cash Transactions
        const cashTransactions: CashTransaction[] = cashData.map((row, index) => ({
          id: `cash-${index}`,
          date: new Date(row[0]).toISOString(),
          type: row[1]?.toLowerCase() as 'income' | 'expense',
          amount: parseFloat(row[2]),
          description: row[3],
          category: row[4],
        }));

        // Process Bank Transactions
        const bankTransactions: BankTransaction[] = bankData.map((row, index) => ({
          id: `bank-${index}`,
          date: new Date(row[0]).toISOString(),
          type: row[1]?.toLowerCase() as 'deposit' | 'withdrawal',
          amount: parseFloat(row[2]),
          description: row[3],
          category: row[4],
        }));

        // Process Stock Items
        const stockItems: StockItem[] = stockData.map((row, index) => ({
            id: row[0] || `stock-${index}`,
            name: row[1],
            weight: parseFloat(row[2]),
            purchasePricePerKg: parseFloat(row[3]),
        }));

        // Calculate initial balances from transactions
        const cashBalance = cashTransactions.reduce((acc, tx) => acc + (tx.type === 'income' ? tx.amount : -tx.amount), 0);
        const bankBalance = bankTransactions.reduce((acc, tx) => acc + (tx.type === 'deposit' ? tx.amount : -tx.amount), 0);

        setState(prev => ({
            ...prev, // Keep user settings like font, currency etc.
            cashTransactions: cashTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            bankTransactions: bankTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            stockItems,
            cashBalance,
            bankBalance,
            initialBalanceSet: true
        }));

      } catch (error) {
        console.error("Failed to load data from Google Sheets", error);
        toast({
            variant: 'destructive',
            title: 'Failed to load data',
            description: 'Could not connect to Google Sheets. Please check your setup.'
        });
        setState(prev => ({ ...prev, initialBalanceSet: true })); // Prevent dialog from showing on error
      }
      setIsInitialized(true);
    }

    // Load settings from localStorage first
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

    loadData();
  }, [toast]);

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


  const setInitialBalances = (cash: number, bank: number) => {
    // This now can be used to add 'Initial Balance' transactions to the sheet via another flow
    toast({ title: "Note", description: "This functionality will now add a transaction to your sheet."});
  };

  const addInitialStockItem = (item: { name: string, weight: number, pricePerKg: number}) => {
    // This now can be used to add a row to the stock sheet
     toast({ title: "Note", description: "This functionality will now add a row to your stock sheet."});
  };
  
  const addCashTransaction = (tx: Omit<CashTransaction, 'id'>) => {
    // TODO: Implement flow to add this transaction to the Google Sheet
    console.log("Adding cash transaction (to be implemented in backend):", tx);
    toast({ title: "Pending", description: "Adding transactions to sheet is not yet implemented."})
  };

  const addBankTransaction = (tx: Omit<BankTransaction, 'id'>) => {
    // TODO: Implement flow to add this transaction to the Google Sheet
    console.log("Adding bank transaction (to be implemented in backend):", tx);
    toast({ title: "Pending", description: "Adding transactions to sheet is not yet implemented."})
  };
  
  const addStockTransaction = (tx: Omit<StockTransaction, 'id'>) => {
    // TODO: Implement flow to add this transaction to the Google Sheet
    console.log("Adding stock transaction (to be implemented in backend):", tx);
    toast({ title: "Pending", description: "Adding transactions to sheet is not yet implemented."})
  };

  // The edit/delete/transfer functions will also need to be backed by flows.
  // For now, they will only update local state, and will be out of sync with the sheet.

  const editCashTransaction = (originalTx: CashTransaction, updatedTxData: Omit<CashTransaction, 'id' | 'date'>) => {
      setState(prev => {
          let newCashBalance = prev.cashBalance;
          if (originalTx.type === 'income') newCashBalance -= originalTx.amount;
          else newCashBalance += originalTx.amount;

          const newTx: CashTransaction = { ...updatedTxData, id: originalTx.id, date: originalTx.date, lastEdited: new Date().toISOString() };
          if (newTx.type === 'income') newCashBalance += newTx.amount;
          else newCashBalance -= newTx.amount;

          const newTransactions = prev.cashTransactions.map(tx => tx.id === originalTx.id ? newTx : tx);

          return { ...prev, cashBalance: newCashBalance, cashTransactions: newTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) };
      });
      toast({title: "Locally Edited", description: "Syncing edits with Google Sheets is not yet implemented."})
  };

  const editBankTransaction = (originalTx: BankTransaction, updatedTxData: Omit<BankTransaction, 'id' | 'date'>) => {
      setState(prev => {
          let newBankBalance = prev.bankBalance;
          if (originalTx.type === 'deposit') newBankBalance -= originalTx.amount;
          else newBankBalance += originalTx.amount;

          const newTx: BankTransaction = { ...updatedTxData, id: originalTx.id, date: originalTx.date, lastEdited: new Date().toISOString() };
          if (newTx.type === 'deposit') newBankBalance += newTx.amount;
          else newBankBalance -= newTx.amount;

          const newTransactions = prev.bankTransactions.map(tx => tx.id === originalTx.id ? newTx : tx);
          return { ...prev, bankBalance: newBankBalance, bankTransactions: newTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) };
      });
       toast({title: "Locally Edited", description: "Syncing edits with Google Sheets is not yet implemented."})
  };

  const editStockTransaction = (originalTx: StockTransaction, updatedTxData: Omit<StockTransaction, 'id' | 'date'>) => {
      setState(prev => {
          const otherStockTxs = prev.stockTransactions.filter(t => t.id !== originalTx.id);
          let tempState = { ...initialAppState, initialBalanceSet: true, wastagePercentage: prev.wastagePercentage, currency: prev.currency, showStockValue: prev.showStockValue, organizationName: prev.organizationName };
          const allTxs = [...otherStockTxs, { ...updatedTxData, id: originalTx.id, date: originalTx.date, lastEdited: new Date().toISOString() }].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          return { ...prev, stockTransactions: allTxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) };
      });
      toast({title: "Locally Edited", description: "Syncing edits with Google Sheets is not yet implemented."})
  };

  const deleteCashTransaction = (txId: string) => {
    setState(prev => ({ ...prev, cashTransactions: prev.cashTransactions.filter(tx => tx.id !== txId) }));
    toast({title: "Locally Deleted", description: "Syncing deletions with Google Sheets is not yet implemented."})
  };

  const deleteBankTransaction = (txId: string) => {
    setState(prev => ({ ...prev, bankTransactions: prev.bankTransactions.filter(tx => tx.id !== txId) }));
    toast({title: "Locally Deleted", description: "Syncing deletions with Google Sheets is not yet implemented."})
  };
  
  const deleteStockTransaction = (txId: string) => {
    setState(prev => ({ ...prev, stockTransactions: prev.stockTransactions.filter(tx => tx.id !== txId) }));
    toast({title: "Locally Deleted", description: "Syncing deletions with Google Sheets is not yet implemented."})
  };

  const deleteMultipleCashTransactions = (txIds: string[]) => {
    setState(prev => ({ ...prev, cashTransactions: prev.cashTransactions.filter(tx => !txIds.includes(tx.id)) }));
    toast({title: "Locally Deleted", description: "Syncing deletions with Google Sheets is not yet implemented."})
  };

  const deleteMultipleBankTransactions = (txIds: string[]) => {
    setState(prev => ({ ...prev, bankTransactions: prev.bankTransactions.filter(tx => !txIds.includes(tx.id)) }));
    toast({title: "Locally Deleted", description: "Syncing deletions with Google Sheets is not yet implemented."})
  };

  const deleteMultipleStockTransactions = (txIds: string[]) => {
    setState(prev => ({ ...prev, stockTransactions: prev.stockTransactions.filter(tx => !txIds.includes(tx.id)) }));
     toast({title: "Locally Deleted", description: "Syncing deletions with Google Sheets is not yet implemented."})
  };

  const transferFunds = (from: 'cash' | 'bank', amount: number, date?: string) => {
     toast({ title: "Pending", description: "Transfer to sheet is not yet implemented."})
  };

  const addCategory = (type: 'cash' | 'bank', category: string) => {
    setState(prev => {
      const categories = type === 'cash' ? prev.cashCategories : prev.bankCategories;
      if (categories.includes(category) || !category) return prev;
      return type === 'cash'
        ? { ...prev, cashCategories: [...categories, category] }
        : { ...prev, bankCategories: [...categories, category] };
    });
  };

  const deleteCategory = (type: 'cash' | 'bank', category: string) => {
    setState(prev => {
      const categories = type === 'cash' ? prev.cashCategories : prev.bankCategories;
      return type === 'cash'
        ? { ...prev, cashCategories: categories.filter(c => c !== category) }
        : { ...prev, bankCategories: categories.filter(c => c !== category) };
    });
  };

  const setFontSize = (size: FontSize) => setState(prev => ({ ...prev, fontSize: size }));
  const setBodyFont = (font: string) => setState(prev => ({ ...prev, bodyFont: font }));
  const setNumberFont = (font: string) => setState(prev => ({ ...prev, numberFont: font }));
  const setWastagePercentage = (percentage: number) => setState(prev => ({ ...prev, wastagePercentage: percentage }));
  const setCurrency = (currency: string) => setState(prev => ({ ...prev, currency }));
  const setShowStockValue = (show: boolean) => setState(prev => ({ ...prev, showStockValue: show }));
  const setOrganizationName = (name: string) => setState(prev => ({...prev, organizationName: name}));

  const value: AppContextType = {
    ...state,
    setInitialBalances,
    addInitialStockItem,
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
  };

  return <AppContext.Provider value={value}>{isInitialized ? children : null}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}

    