"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import type { CashTransaction, BankTransaction, StockItem, StockTransaction, User } from '@/lib/types';
import { useToast } from "@/hooks/use-toast"
import { readData, appendData, updateData, deleteData, readDeletedData, restoreData, exportAllData, batchImportData, deleteAllData } from '@/app/actions';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { getSession, removeSession } from '@/lib/auth';
import { useRouter } from 'next/navigation';
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
  setInitialBalances: (cash: number, bank: number) => void;
  addInitialStockItem: (item: { name: string; weight: number; pricePerKg: number }) => void;
  handleExport: () => void;
  handleImport: (file: File) => void;
  handleDeleteAllData: () => void;
  logout: () => void;
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
  user: null,
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialAppState);
  const [isInitialized, setIsInitialized] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const reloadData = useCallback(async () => {
    if (!state.user) return;
    try {
        const userId = state.user.role === 'admin' ? undefined : state.user.id;

        const [cashData, bankData, stockTransactionsData, initialStockData, categoriesData] = await Promise.all([
            readData({ tableName: 'cash_transactions', userId }),
            readData({ tableName: 'bank_transactions', userId }),
            readData({ tableName: 'stock_transactions', userId }),
            readData({ tableName: 'initial_stock' }),
            readData({ tableName: 'categories' }),
        ]);
        
        let needsInitialBalance = true;

        const cashTransactions: CashTransaction[] = cashData.map((tx: any) => ({...tx, date: new Date(tx.date).toISOString() }));
        const bankTransactions: BankTransaction[] = bankData.map((tx: any) => ({...tx, date: new Date(tx.date).toISOString() }));

        const initialCashTx = cashTransactions.find(tx => tx.category === 'Initial Balance');
        const initialBankTx = bankTransactions.find(tx => tx.category === 'Initial Balance');
        
        if (initialCashTx || initialBankTx || initialStockData.length > 0) {
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
            needsInitialBalance,
            cashCategories: cashCategories.length > 0 ? cashCategories : prev.cashCategories,
            bankCategories: bankCategories.length > 0 ? bankCategories : prev.bankCategories,
        }));

      } catch (error: any) {
        console.error("Failed to load data", error);
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
      }
  }, [toast, state.user]);
  
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
      const storedSettings = localStorage.getItem('ha-mim-iron-mart-settings');
      let settings = {};
      if (storedSettings) {
        settings = JSON.parse(storedSettings);
      }
      setState(prev => ({ ...prev, ...settings }));
    } catch (e) {
        console.error("Could not parse settings from local storage", e)
    }

    const loadUser = async () => {
        const session = await getSession();
        if (session) {
            // Set user and mark app as ready to render the main UI
            setState(prev => ({...prev, user: session, initialBalanceSet: true})); 
        } else {
            router.push('/login');
            // If no session, still mark as "initialized" to unblock the login page render
            setIsInitialized(true); 
        }
    }

    loadUser();

  }, [router]);
  
   useEffect(() => {
    if (state.user) {
        // Now that the user is confirmed, load their data in the background.
        reloadData();
        // Mark as initialized to save settings, etc.
        setIsInitialized(true);
    }
   }, [state.user, reloadData]);


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
        }
        localStorage.setItem('ha-mim-iron-mart-settings', JSON.stringify(settingsToStore));
      } catch (error) {
        console.error("Failed to save settings to localStorage", error);
      }
    }
  }, [state.fontSize, state.bodyFont, state.numberFont, state.wastagePercentage, state.currency, state.showStockValue, isInitialized]);
  
  const addCashTransaction = async (tx: Omit<CashTransaction, 'id' | 'createdAt' | 'deletedAt'>) => {
    try {
      const dataToInsert = state.user ? { ...tx, user_id: state.user.id } : tx;
      await appendData({ tableName: 'cash_transactions', data: dataToInsert });
      toast({ title: "Success", description: "Cash transaction added."});
      await reloadData();
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: "Error", description: "Failed to add cash transaction."});
    }
  };

  const addBankTransaction = async (tx: Omit<BankTransaction, 'id' | 'createdAt' | 'deletedAt'>) => {
     try {
      const dataToInsert = state.user ? { ...tx, user_id: state.user.id } : tx;
      await appendData({ tableName: 'bank_transactions', data: dataToInsert });
      toast({ title: "Success", description: "Bank transaction added."});
      await reloadData();
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: "Error", description: "Failed to add bank transaction."});
    }
  };
  
  const addStockTransaction = async (tx: Omit<StockTransaction, 'id' | 'createdAt' | 'deletedAt'>) => {
    try {
      const dataToInsert = state.user ? { ...tx, user_id: state.user.id } : tx;
      const [newStockTx] = await appendData({ tableName: 'stock_transactions', data: dataToInsert });
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
        await deleteData({ tableName: "cash_transactions", id: tx.id });
        if(tx.linkedStockTxId) {
             await deleteData({ tableName: "stock_transactions", id: tx.linkedStockTxId });
        }
        toast({ title: "Success", description: "Cash transaction and any linked stock entry have been moved to the recycle bin."});
        await reloadData();
    } catch(error) {
        console.error(error);
        toast({ variant: 'destructive', title: "Error", description: "Failed to delete cash transaction."});
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
        console.error(error);
        toast({ variant: 'destructive', title: "Error", description: "Failed to delete bank transaction."});
    }
  };
  
  const deleteStockTransaction = async (tx: StockTransaction) => {
    try {
        await deleteData({ tableName: "stock_transactions", id: tx.id });

        // Find and soft delete the linked financial transaction.
        // This needs to check both active and deleted items in case the linked item is already in the recycle bin.
        const { data: allCashTxs, error: cashErr } = await supabase.from('cash_transactions').select('id, deletedAt').eq('linkedStockTxId', tx.id);
        if (cashErr) console.error("Error checking cash tx:", cashErr.message);
        if (allCashTxs && allCashTxs.length > 0 && !allCashTxs[0].deletedAt) {
            await deleteData({ tableName: "cash_transactions", id: allCashTxs[0].id });
        }

        const { data: allBankTxs, error: bankErr } = await supabase.from('bank_transactions').select('id, deletedAt').eq('linkedStockTxId', tx.id);
        if (bankErr) console.error("Error checking bank tx:", bankErr.message);
        if (allBankTxs && allBankTxs.length > 0 && !allBankTxs[0].deletedAt) {
            await deleteData({ tableName: "bank_transactions", id: allBankTxs[0].id });
        }
        
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
        await restoreData({ tableName, id });

        if (txType === 'cash' || txType === 'bank') {
            const { data: finTx } = await supabase.from(tableName).select('linkedStockTxId').eq('id', id).maybeSingle();
            if (finTx?.linkedStockTxId) {
                 await restoreData({ tableName: 'stock_transactions', id: finTx.linkedStockTxId });
            }
        }
         
        if (txType === 'stock') {
            // Find the linked cash or bank transaction based on the stock transaction's ID
            // We need to check the recycle bin, so we can't use readData directly, we check all rows.
            const { data: cashTx } = await supabase.from('cash_transactions').select('id, deletedAt').eq('linkedStockTxId', id).maybeSingle();
            if (cashTx) await restoreData({ tableName: 'cash_transactions', id: cashTx.id });

            const { data: bankTx } = await supabase.from('bank_transactions').select('id, deletedAt').eq('linkedStockTxId', id).maybeSingle();
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
        await Promise.all(txs.map(tx => deleteCashTransaction(tx)));
        toast({ title: "Success", description: `${txs.length} cash transaction(s) deleted.`});
        await reloadData();
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
          const commonData = { user_id: state.user?.id };
          await addCashTransaction({ date: new Date().toISOString(), type: 'income', amount: cash, description: 'Initial Balance', category: 'Initial Balance', ...commonData});
          await addBankTransaction({ date: new Date().toISOString(), type: 'deposit', amount: bank, description: 'Initial Balance', category: 'Initial Balance', ...commonData});
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

  const handleExport = async () => {
    try {
      const data = await exportAllData();
      const zip = new JSZip();
      zip.file("ha-mim-iron-mart-backup.json", JSON.stringify(data, null, 2));
      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, `ha-mim-iron-mart-backup-${format(new Date(), 'yyyy-MM-dd')}.zip`);
      toast({ title: "Export Successful", description: "Your data has been exported." });
    } catch (error: any) {
      console.error(error);
      toast({ variant: 'destructive', title: "Export Failed", description: error.message });
    }
  };

  const handleImport = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            let jsonString = event.target?.result as string;
            // Handle zip files
            if (file.name.endsWith('.zip')) {
                const zip = await JSZip.loadAsync(file);
                const jsonFile = zip.file("ha-mim-iron-mart-backup.json");
                if (!jsonFile) {
                    throw new Error("Backup JSON file not found in the zip archive.");
                }
                jsonString = await jsonFile.async("string");
            }
            const data = JSON.parse(jsonString);
            
            // Basic validation
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
            console.error(error);
            toast({ variant: 'destructive', title: "Import Failed", description: error.message });
        }
    };
    reader.readAsText(file);
  };
  
  const handleDeleteAllData = async () => {
    try {
        await deleteAllData();
        toast({ title: 'All Data Deleted', description: 'Your ledger has been reset.' });
        await reloadData();
    } catch (error: any) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Deletion Failed', description: error.message });
    }
  };

  const logout = async () => {
    await removeSession();
    setState(initialAppState); // Reset state to initial
    router.push('/login');
  };

  const setFontSize = (size: FontSize) => setState(prev => ({ ...prev, fontSize: size }));
  const setBodyFont = (font: string) => setState(prev => ({ ...prev, bodyFont: font }));
  const setNumberFont = (font: string) => setState(prev => ({ ...prev, numberFont: font }));
  const setWastagePercentage = (percentage: number) => setState(prev => ({ ...prev, wastagePercentage: percentage }));
  const setCurrency = (currency: string) => setState(prev => ({ ...prev, currency }));
  const setShowStockValue = (show: boolean) => setState(prev => ({ ...prev, showStockValue: show }));

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
    setInitialBalances,
    addInitialStockItem,
    handleExport,
    handleImport,
    handleDeleteAllData,
    logout,
  };

  if (!isInitialized && !state.user) {
    return <div className="flex items-center justify-center min-h-screen"><Logo className="h-16 w-16 text-primary animate-pulse" /></div>;
  }
  
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
