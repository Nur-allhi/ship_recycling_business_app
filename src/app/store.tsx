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
}

interface AppContextType extends AppState {
  setInitialBalances: (cash: number, bank: number) => void;
  addCashTransaction: (tx: Omit<CashTransaction, 'id' | 'date'>) => void;
  addBankTransaction: (tx: Omit<BankTransaction, 'id' | 'date'>) => void;
  addStockTransaction: (tx: Omit<StockTransaction, 'id' | 'date'>) => void;
  transferFunds: (from: 'cash' | 'bank', amount: number) => void;
  addCategory: (type: 'cash' | 'bank', category: string) => void;
  deleteCategory: (type: 'cash' | 'bank', category: string) => void;
  setFontSize: (size: FontSize) => void;
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
  bankCategories: ['Salary', 'Investment', 'Loan', 'Shopping'],
  fontSize: 'base',
  initialBalanceSet: false,
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialAppState);
  const [isInitialized, setIsInitialized] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    try {
      const storedState = localStorage.getItem('shipshape-ledger');
      if (storedState) {
        const parsedState = JSON.parse(storedState);
        // ensure initialBalanceSet exists
        if (typeof parsedState.initialBalanceSet === 'undefined') {
          parsedState.initialBalanceSet = (parsedState.cashBalance !== 0 || parsedState.bankBalance !== 0 || parsedState.cashTransactions.length > 0 || parsedState.bankTransactions.length > 0)
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
  
  const addCashTransaction = (tx: Omit<CashTransaction, 'id' | 'date'>) => {
    setState(prev => {
      const newTx = { ...tx, id: crypto.randomUUID(), date: new Date().toISOString() };
      const newBalance = newTx.type === 'income' ? prev.cashBalance + newTx.amount : prev.cashBalance - newTx.amount;
      return {
        ...prev,
        cashBalance: newBalance,
        cashTransactions: [newTx, ...prev.cashTransactions],
      };
    });
  };

  const addBankTransaction = (tx: Omit<BankTransaction, 'id' | 'date'>) => {
    setState(prev => {
      const newTx = { ...tx, id: crypto.randomUUID(), date: new Date().toISOString() };
      const newBalance = newTx.type === 'deposit' ? prev.bankBalance + newTx.amount : prev.bankBalance - newTx.amount;
      return {
        ...prev,
        bankBalance: newBalance,
        bankTransactions: [newTx, ...prev.bankTransactions],
      };
    });
  };
  
  const addStockTransaction = (tx: Omit<StockTransaction, 'id' | 'date'>) => {
      setState(prev => {
          const newTx: StockTransaction = { ...tx, id: crypto.randomUUID(), date: new Date().toISOString() };
          const cost = tx.weight * tx.pricePerKg;
          let newCashBalance = prev.cashBalance;
          let newBankBalance = prev.bankBalance;
          let newCashTransactions = prev.cashTransactions;
          let newBankTransactions = prev.bankTransactions;

          if (tx.type === 'purchase') {
              if (tx.paymentMethod === 'cash') {
                  if(prev.cashBalance < cost) {
                      toast({ variant: "destructive", title: "Insufficient cash balance" });
                      return prev;
                  }
                  newCashBalance -= cost;
                  newCashTransactions = [{ id: crypto.randomUUID(), date: newTx.date, type: 'expense', amount: cost, description: `Purchase: ${tx.stockItemName}`, category: 'Stock' }, ...prev.cashTransactions];
              } else {
                  if(prev.bankBalance < cost) {
                       toast({ variant: "destructive", title: "Insufficient bank balance" });
                      return prev;
                  }
                  newBankBalance -= cost;
                  newBankTransactions = [{ id: crypto.randomUUID(), date: newTx.date, type: 'withdrawal', amount: cost, description: `Purchase: ${tx.stockItemName}`, category: 'Stock' }, ...prev.bankTransactions];
              }
          } else { // Sale
              if (tx.paymentMethod === 'cash') {
                  newCashBalance += cost;
                  newCashTransactions = [{ id: crypto.randomUUID(), date: newTx.date, type: 'income', amount: cost, description: `Sale: ${tx.stockItemName}`, category: 'Stock' }, ...prev.cashTransactions];
              } else {
                  newBankBalance += cost;
                  newBankTransactions = [{ id: crypto.randomUUID(), date: newTx.date, type: 'deposit', amount: cost, description: `Sale: ${tx.stockItemName}`, category: 'Stock' }, ...prev.bankTransactions];
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
                  if(existingItem.weight < tx.weight) {
                      toast({ variant: "destructive", title: "Not enough stock to sell" });
                      return prev;
                  }
                  const newWeight = existingItem.weight - tx.weight;
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
              cashTransactions: newCashTransactions,
              bankTransactions: newBankTransactions,
              stockItems: newStockItems,
              stockTransactions: [newTx, ...prev.stockTransactions],
          };
      });
  };

  const transferFunds = (from: 'cash' | 'bank', amount: number) => {
    setState(prev => {
      if (from === 'cash') {
        if (prev.cashBalance < amount) {
          toast({ variant: "destructive", title: "Insufficient cash balance for transfer." });
          return prev;
        }
        addCashTransaction({ type: 'expense', amount, description: 'Transfer to Bank', category: 'Transfer' });
        addBankTransaction({ type: 'deposit', amount, description: 'Transfer from Cash', category: 'Transfer' });
      } else {
        if (prev.bankBalance < amount) {
          toast({ variant: "destructive", title: "Insufficient bank balance for transfer." });
          return prev;
        }
        addBankTransaction({ type: 'withdrawal', amount, description: 'Transfer to Cash', category: 'Transfer' });
        addCashTransaction({ type: 'income', amount, description: 'Transfer from Bank', category: 'Transfer' });
      }
      // The individual transaction functions already update state, so we just call them.
      // The state will be updated twice, which is slightly inefficient but ensures consistency.
      // A better way would be to refactor this to update state once.
      // Let's refactor
      if (from === 'cash') {
          if (prev.cashBalance < amount) { /* re-check for standalone logic */ return prev; }
          const cashTx: CashTransaction = { id: crypto.randomUUID(), date: new Date().toISOString(), type: 'expense', amount, description: 'Transfer to Bank', category: 'Transfer' };
          const bankTx: BankTransaction = { id: crypto.randomUUID(), date: new Date().toISOString(), type: 'deposit', amount, description: 'Transfer from Cash', category: 'Transfer' };
          return {
              ...prev,
              cashBalance: prev.cashBalance - amount,
              bankBalance: prev.bankBalance + amount,
              cashTransactions: [cashTx, ...prev.cashTransactions],
              bankTransactions: [bankTx, ...prev.bankTransactions],
          }
      } else {
          if (prev.bankBalance < amount) { /* re-check for standalone logic */ return prev; }
          const bankTx: BankTransaction = { id: crypto.randomUUID(), date: new Date().toISOString(), type: 'withdrawal', amount, description: 'Transfer to Cash', category: 'Transfer' };
          const cashTx: CashTransaction = { id: crypto.randomUUID(), date: new Date().toISOString(), type: 'income', amount, description: 'Transfer from Bank', category: 'Transfer' };
           return {
              ...prev,
              bankBalance: prev.bankBalance - amount,
              cashBalance: prev.cashBalance + amount,
              bankTransactions: [bankTx, ...prev.bankTransactions],
              cashTransactions: [cashTx, ...prev.cashTransactions],
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

  const value = {
    ...state,
    setInitialBalances,
    addCashTransaction,
    addBankTransaction,
    addStockTransaction,
    transferFunds,
    addCategory,
    deleteCategory,
    setFontSize,
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
