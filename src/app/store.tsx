
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { CashTransaction, BankTransaction, StockItem, StockTransaction } from '@/lib/types';
import { useToast } from "@/hooks/use-toast"

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
  initialBalanceSet: boolean;
  wastagePercentage: number;
  currency: string;
}

interface AppContextType extends AppState {
  setInitialBalances: (cash: number, bank: number) => void;
  addCashTransaction: (tx: Omit<CashTransaction, 'id'>) => void;
  addBankTransaction: (tx: Omit<BankTransaction, 'id'>) => void;
  addStockTransaction: (tx: Omit<StockTransaction, 'id'>) => void;
  editCashTransaction: (originalTx: CashTransaction, updatedTxData: Omit<CashTransaction, 'id' | 'date'>) => void;
  editBankTransaction: (originalTx: BankTransaction, updatedTxData: Omit<BankTransaction, 'id' | 'date'>) => void;
  editStockTransaction: (originalTx: StockTransaction, updatedTxData: Omit<StockTransaction, 'id' | 'date'>) => void;
  transferFunds: (from: 'cash' | 'bank', amount: number, date?: string) => void;
  addCategory: (type: 'cash' | 'bank', category: string) => void;
  deleteCategory: (type: 'cash' | 'bank', category: string) => void;
  setFontSize: (size: FontSize) => void;
  setWastagePercentage: (percentage: number) => void;
  setCurrency: (currency: string) => void;
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
  initialBalanceSet: false,
  wastagePercentage: 0,
  currency: 'USD',
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialAppState);
  const [isInitialized, setIsInitialized] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    try {
      const storedState = localStorage.getItem('shipshape-ledger');
      if (storedState) {
        let parsedState = JSON.parse(storedState);

        const categoriesMatch = 
            JSON.stringify(parsedState.bankCategories) === JSON.stringify(initialAppState.bankCategories) &&
            JSON.stringify(parsedState.cashCategories) === JSON.stringify(initialAppState.cashCategories);

        if (!categoriesMatch) {
            parsedState.bankCategories = initialAppState.bankCategories;
            parsedState.cashCategories = initialAppState.cashCategories;
        }

        if (typeof parsedState.initialBalanceSet === 'undefined') {
          parsedState.initialBalanceSet = (parsedState.cashBalance !== 0 || parsedState.bankBalance !== 0 || parsedState.cashTransactions.length > 0 || parsedState.bankTransactions.length > 0)
        }
        
        if (typeof parsedState.wastagePercentage === 'undefined') {
          parsedState.wastagePercentage = 0;
        }

        if (typeof parsedState.currency === 'undefined') {
          parsedState.currency = 'USD';
        }
        
        setState(parsedState);
      }
    } catch (error) {
      console.error("Failed to load state from localStorage", error);
    }
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (isInitialized) {
      try {
        localStorage.setItem('shipshape-ledger', JSON.stringify(state));
      } catch (error) {
        console.error("Failed to save state to localStorage", error);
      }
    }
  }, [state, isInitialized]);

  const setInitialBalances = (cash: number, bank: number) => {
    setState(prev => ({ ...prev, cashBalance: cash, bankBalance: bank, initialBalanceSet: true }));
  };
  
  const addCashTransaction = (tx: Omit<CashTransaction, 'id'>) => {
    setState(prev => {
      const newTx = { ...tx, id: crypto.randomUUID() };
      const newBalance = newTx.type === 'income' ? prev.cashBalance + newTx.amount : prev.cashBalance - newTx.amount;
      return {
        ...prev,
        cashBalance: newBalance,
        cashTransactions: [newTx, ...prev.cashTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      };
    });
  };

  const addBankTransaction = (tx: Omit<BankTransaction, 'id'>) => {
    setState(prev => {
      const newTx = { ...tx, id: crypto.randomUUID() };
      const newBalance = newTx.type === 'deposit' ? prev.bankBalance + newTx.amount : prev.bankBalance - newTx.amount;
      return {
        ...prev,
        bankBalance: newBalance,
        bankTransactions: [newTx, ...prev.bankTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      };
    });
  };
  
  const addStockTransaction = (tx: Omit<StockTransaction, 'id'>) => {
      setState(prev => {
          const newTx: StockTransaction = { ...tx, id: crypto.randomUUID() };
          const costOrProceeds = tx.weight * tx.pricePerKg;
          let newCashBalance = prev.cashBalance;
          let newBankBalance = prev.bankBalance;
          let newCashTransactions = prev.cashTransactions;
          let newBankTransactions = prev.bankTransactions;

          if (tx.type === 'purchase') {
              if (tx.paymentMethod === 'cash') {
                  if(prev.cashBalance < costOrProceeds) {
                      toast({ variant: "destructive", title: "Insufficient cash balance" });
                      return prev;
                  }
                  newCashBalance -= costOrProceeds;
                  newCashTransactions = [{ id: crypto.randomUUID(), date: newTx.date, type: 'expense', amount: costOrProceeds, description: `Purchase: ${tx.stockItemName}`, category: 'Stock' }, ...prev.cashTransactions];
              } else {
                  if(prev.bankBalance < costOrProceeds) {
                       toast({ variant: "destructive", title: "Insufficient bank balance" });
                      return prev;
                  }
                  newBankBalance -= costOrProceeds;
                  newBankTransactions = [{ id: crypto.randomUUID(), date: newTx.date, type: 'withdrawal', amount: costOrProceeds, description: `Purchase: ${tx.stockItemName}`, category: 'Stock' }, ...prev.bankTransactions];
              }
          } else { // Sale
              if (tx.paymentMethod === 'cash') {
                  newCashBalance += costOrProceeds;
                  newCashTransactions = [{ id: crypto.randomUUID(), date: newTx.date, type: 'income', amount: costOrProceeds, description: `Sale: ${tx.stockItemName}`, category: 'Stock' }, ...prev.cashTransactions];
              } else {
                  newBankBalance += costOrProceeds;
                  newBankTransactions = [{ id: crypto.randomUUID(), date: newTx.date, type: 'deposit', amount: costOrProceeds, description: `Sale: ${tx.stockItemName}`, category: 'Stock' }, ...prev.bankTransactions];
              }
          }

          let newStockItems = [...prev.stockItems];
          const existingItemIndex = newStockItems.findIndex(item => item.name.toLowerCase() === tx.stockItemName.toLowerCase());

          if (existingItemIndex > -1) {
              const existingItem = newStockItems[existingItemIndex];
              if (tx.type === 'purchase') {
                  const newWeight = existingItem.weight + tx.weight;
                  const newAvgPrice = ((existingItem.weight * existingItem.purchasePricePerKg) + (tx.weight * tx.pricePerKg)) / newWeight;
                  newStockItems[existingItemIndex] = { ...existingItem, weight: newWeight, purchasePricePerKg: newAvgPrice };
              } else { // Sale
                  const wastageAmount = tx.weight * (prev.wastagePercentage / 100);
                  const totalDeduction = tx.weight + wastageAmount;
                  if(existingItem.weight < totalDeduction) {
                      toast({ variant: "destructive", title: "Not enough stock to sell", description: `Required: ${totalDeduction.toFixed(2)}kg (incl. wastage), Available: ${existingItem.weight.toFixed(2)}kg` });
                      return prev;
                  }
                  const newWeight = existingItem.weight - totalDeduction;
                  newStockItems[existingItemIndex] = { ...existingItem, weight: newWeight };
                  if (newWeight <= 0) {
                      newStockItems.splice(existingItemIndex, 1);
                  }
              }
          } else {
              if (tx.type === 'purchase') {
                  newStockItems.push({ id: crypto.randomUUID(), name: tx.stockItemName, weight: tx.weight, purchasePricePerKg: tx.pricePerKg });
              } else {
                  toast({ variant: "destructive", title: "Cannot sell stock that doesn't exist" });
                  return prev;
              }
          }

          return {
              ...prev,
              cashBalance: newCashBalance,
              bankBalance: newBankBalance,
              cashTransactions: newCashTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
              bankTransactions: newBankTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
              stockItems: newStockItems,
              stockTransactions: [newTx, ...prev.stockTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
          };
      });
  };

  const editCashTransaction = (originalTx: CashTransaction, updatedTxData: Omit<CashTransaction, 'id' | 'date'>) => {
      setState(prev => {
          let newCashBalance = prev.cashBalance;
          // Revert original transaction
          if (originalTx.type === 'income') {
              newCashBalance -= originalTx.amount;
          } else {
              newCashBalance += originalTx.amount;
          }

          // Apply new transaction
          const newTx: CashTransaction = { ...updatedTxData, id: originalTx.id, date: originalTx.date, lastEdited: new Date().toISOString() };
          if (newTx.type === 'income') {
              newCashBalance += newTx.amount;
          } else {
              newCashBalance -= newTx.amount;
          }

          const newTransactions = prev.cashTransactions.map(tx => tx.id === originalTx.id ? newTx : tx);

          return {
              ...prev,
              cashBalance: newCashBalance,
              cashTransactions: newTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
          };
      });
  };

  const editBankTransaction = (originalTx: BankTransaction, updatedTxData: Omit<BankTransaction, 'id' | 'date'>) => {
      setState(prev => {
          let newBankBalance = prev.bankBalance;
          // Revert original transaction
          if (originalTx.type === 'deposit') {
              newBankBalance -= originalTx.amount;
          } else {
              newBankBalance += originalTx.amount;
          }

          // Apply new transaction
          const newTx: BankTransaction = { ...updatedTxData, id: originalTx.id, date: originalTx.date, lastEdited: new Date().toISOString() };
          if (newTx.type === 'deposit') {
              newBankBalance += newTx.amount;
          } else {
              newBankBalance -= newTx.amount;
          }

          const newTransactions = prev.bankTransactions.map(tx => tx.id === originalTx.id ? newTx : tx);

          return {
              ...prev,
              bankBalance: newBankBalance,
              bankTransactions: newTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
          };
      });
  };

  const editStockTransaction = (originalTx: StockTransaction, updatedTxData: Omit<StockTransaction, 'id' | 'date'>) => {
      setState(prev => {
          // This logic is complex. It needs to revert the old state and apply the new one.
          // For simplicity, we will remove the old transaction and add the new one.
          // A more robust solution would re-calculate the state from the beginning.

          // 1. Filter out the transaction to be edited
          const otherStockTxs = prev.stockTransactions.filter(t => t.id !== originalTx.id);

          // 2. Re-calculate the entire state based on all other transactions
          let tempState = { ...initialAppState, initialBalanceSet: true, wastagePercentage: prev.wastagePercentage, currency: prev.currency };
          
          // Get initial balances from the start of the state, not the global initial
          const initialCashTxs = prev.cashTransactions.filter(t => t.description?.includes('Initial Balance'));
          const initialBankTxs = prev.bankTransactions.filter(t => t.description?.includes('Initial Balance'));
          tempState.cashBalance = initialCashTxs.reduce((acc, tx) => acc + tx.amount, 0);
          tempState.bankBalance = initialBankTxs.reduce((acc, tx) => acc + tx.amount, 0);


          const allTxs = [...otherStockTxs, { ...updatedTxData, id: originalTx.id, date: originalTx.date, lastEdited: new Date().toISOString() }].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          for (const tx of allTxs) {
              const costOrProceeds = tx.weight * tx.pricePerKg;
              if (tx.type === 'purchase') {
                  if (tx.paymentMethod === 'cash') tempState.cashBalance -= costOrProceeds;
                  else tempState.bankBalance -= costOrProceeds;

                  const itemIndex = tempState.stockItems.findIndex(i => i.name.toLowerCase() === tx.stockItemName.toLowerCase());
                  if (itemIndex > -1) {
                      const item = tempState.stockItems[itemIndex];
                      const newWeight = item.weight + tx.weight;
                      const newAvgPrice = ((item.weight * item.purchasePricePerKg) + (tx.weight * tx.pricePerKg)) / newWeight;
                      tempState.stockItems[itemIndex] = { ...item, weight: newWeight, purchasePricePerKg: newAvgPrice };
                  } else {
                      tempState.stockItems.push({ id: crypto.randomUUID(), name: tx.stockItemName, weight: tx.weight, purchasePricePerKg: tx.pricePerKg });
                  }
              } else { // Sale
                  if (tx.paymentMethod === 'cash') tempState.cashBalance += costOrProceeds;
                  else tempState.bankBalance += costOrProceeds;
                  
                  const itemIndex = tempState.stockItems.findIndex(i => i.name.toLowerCase() === tx.stockItemName.toLowerCase());
                  if (itemIndex > -1) {
                      const item = tempState.stockItems[itemIndex];
                      const wastageAmount = tx.weight * (prev.wastagePercentage / 100);
                      const totalDeduction = tx.weight + wastageAmount;
                      const newWeight = item.weight - totalDeduction;
                      tempState.stockItems[itemIndex] = { ...item, weight: newWeight };
                       if (newWeight <= 0) {
                          tempState.stockItems.splice(itemIndex, 1);
                      }
                  }
              }
          }
          
          // We can't easily reconstruct cash/bank transactions without more context,
          // so we'll just use the final calculated balances. This is a limitation.
          // For a real app, financial transactions should be immutable or handled by a backend.

          return {
              ...prev,
              stockTransactions: allTxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
              stockItems: tempState.stockItems,
              cashBalance: tempState.cashBalance,
              bankBalance: tempState.bankBalance
          };
      });
  };

  const transferFunds = (from: 'cash' | 'bank', amount: number, date?: string) => {
    setState(prev => {
      if (from === 'cash') {
        if (prev.cashBalance < amount) {
          toast({ variant: "destructive", title: "Insufficient cash balance for transfer." });
          return prev;
        }
      } else {
        if (prev.bankBalance < amount) {
          toast({ variant: "destructive", title: "Insufficient bank balance for transfer." });
          return prev;
        }
      }

      const transactionDate = date || new Date().toISOString();

      if (from === 'cash') {
          const cashTx: CashTransaction = { id: crypto.randomUUID(), date: transactionDate, type: 'expense', amount, description: 'Transfer to Bank', category: 'Transfer' };
          const bankTx: BankTransaction = { id: crypto.randomUUID(), date: transactionDate, type: 'deposit', amount, description: 'Transfer from Cash', category: 'Transfer' };
          return {
              ...prev,
              cashBalance: prev.cashBalance - amount,
              bankBalance: prev.bankBalance + amount,
              cashTransactions: [cashTx, ...prev.cashTransactions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
              bankTransactions: [bankTx, ...prev.bankTransactions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
          }
      } else {
          const bankTx: BankTransaction = { id: crypto.randomUUID(), date: transactionDate, type: 'withdrawal', amount, description: 'Transfer to Cash', category: 'Transfer' };
          const cashTx: CashTransaction = { id: crypto.randomUUID(), date: transactionDate, type: 'income', amount, description: 'Transfer from Bank', category: 'Transfer' };
           return {
              ...prev,
              bankBalance: prev.bankBalance - amount,
              cashBalance: prev.cashBalance + amount,
              bankTransactions: [bankTx, ...prev.bankTransactions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
              cashTransactions: [cashTx, ...prev.cashTransactions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
          }
      }
    });
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

  const setFontSize = (size: FontSize) => {
    setState(prev => ({ ...prev, fontSize: size }));
  };
  
  const setWastagePercentage = (percentage: number) => {
    setState(prev => ({ ...prev, wastagePercentage: percentage }));
  };

  const setCurrency = (currency: string) => {
    setState(prev => ({ ...prev, currency }));
  };

  const value: AppContextType = {
    ...state,
    setInitialBalances,
    addCashTransaction,
    addBankTransaction,
    addStockTransaction,
    editCashTransaction,
    editBankTransaction,
    editStockTransaction,
    transferFunds,
    addCategory,
    deleteCategory,
    setFontSize,
    setWastagePercentage,
    setCurrency,
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
