
"use client";
import { useCallback } from 'react';
import { toast } from 'sonner';
import { db, bulkPut } from '@/lib/db';
import type { SyncQueueItem } from '@/lib/db';
import * as server from '@/lib/actions';
import { useAppContext } from './app-context';
import type { CashTransaction, BankTransaction, StockTransaction, Vendor, Client, LedgerTransaction, Category } from '@/lib/types';

export function useAppActions() {
    const { isOnline, handleApiError, reloadData, updateBalances, setLoadedMonths, setDeletedItems } = useAppContext();

    const queueOrSync = useCallback(async (item: Omit<SyncQueueItem, 'timestamp' | 'id'>) => {
        if (isOnline) {
            try {
                let result;
                switch(item.action) {
                    case 'appendData': result = await server.appendData(item.payload); break;
                    case 'updateData': result = await server.updateData(item.payload); break;
                    case 'deleteData': result = await server.deleteData(item.payload); break;
                    case 'restoreData': result = await server.restoreData(item.payload); break;
                    case 'recordPaymentAgainstTotal': result = await server.recordPaymentAgainstTotal(item.payload); break;
                    case 'recordDirectPayment': result = await server.recordDirectPayment(item.payload); break;
                    case 'updateStockTransaction': result = await server.updateStockTransaction(item.payload); break;
                    case 'setInitialBalances': result = await server.setInitialBalances(item.payload); break;
                }
                return result;
            } catch (error) {
                handleApiError(error);
                await db.syncQueue.add({ ...item, timestamp: Date.now() });
                throw error;
            }
        } else {
            await db.syncQueue.add({ ...item, timestamp: Date.now() });
            toast.info("You are offline. Change saved locally and will sync later.");
            return null;
        }
    }, [isOnline, handleApiError]);
    
    // AUTH ACTIONS
    const login = useCallback(async (credentials: Parameters<typeof server.login>[0]) => {
        const result = await server.login(credentials);
        if (result.success) {
            await reloadData({ needsInitialBalance: result.needsInitialBalance, force: true });
        }
        return result;
    }, [reloadData]);

    // DATA MUTATION ACTIONS
    const addCashTransaction = async (tx: Omit<CashTransaction, 'id' | 'createdAt' | 'deletedAt'>) => {
        const tempId = `temp_${Date.now()}`;
        const newTxData = { ...tx, id: tempId, createdAt: new Date().toISOString() };
        await db.cashTransactions.add(newTxData);
        
        try {
            if (tx.category === 'A/R Settlement' || tx.category === 'A/P Settlement') {
                const payload = {
                    payment_method: 'cash' as const, date: tx.date, amount: tx.actual_amount, category: tx.category,
                    description: tx.description, contact_id: tx.contact_id!,
                    contact_name: tx.type === 'income' ? (await db.clients.get(tx.contact_id!))?.name || '?' : (await db.vendors.get(tx.contact_id!))?.name || '?',
                };
                await queueOrSync({ action: 'recordDirectPayment', payload });
            } else {
                const savedTx = await queueOrSync({ action: 'appendData', payload: { tableName: 'cash_transactions', data: tx, logDescription: `Added cash transaction: ${tx.description}`, select: '*' } });
                if (savedTx) await db.cashTransactions.where({ id: tempId }).modify(savedTx);
            }
            await updateBalances();
        } catch (e) {}
    };

    const addBankTransaction = async (tx: Omit<BankTransaction, 'id' | 'createdAt' | 'deletedAt'>) => {
        const tempId = `temp_${Date.now()}`;
        await db.bankTransactions.add({ ...tx, id: tempId, createdAt: new Date().toISOString() });
        try {
             if (tx.category === 'A/R Settlement' || tx.category === 'A/P Settlement') {
                const payload = {
                    payment_method: 'bank' as const, bank_id: tx.bank_id, date: tx.date, amount: tx.actual_amount, category: tx.category,
                    description: tx.description, contact_id: tx.contact_id!,
                    contact_name: tx.type === 'deposit' ? (await db.clients.get(tx.contact_id!))?.name || '?' : (await db.vendors.get(tx.contact_id!))?.name || '?',
                };
                await queueOrSync({ action: 'recordDirectPayment', payload });
            } else {
                const savedTx = await queueOrSync({ action: 'appendData', payload: { tableName: 'bank_transactions', data: tx, logDescription: `Added bank transaction: ${tx.description}`, select: '*' } });
                if (savedTx) await db.bankTransactions.where({ id: tempId }).modify(savedTx);
            }
            await updateBalances();
        } catch(e) {}
    };

    const addStockTransaction = async (tx: Omit<StockTransaction, 'id' | 'createdAt' | 'deletedAt'> & { contact_id?: string; contact_name?: string }, bank_id?: string) => {
        const stockTempId = `temp_stock_${Date.now()}`;
        await db.stockTransactions.add({ ...tx, id: stockTempId, createdAt: new Date().toISOString() });
        const savedStockTxPromise = queueOrSync({ action: 'appendData', payload: { tableName: 'stock_transactions', data: tx, select: '*' }});

        if (tx.paymentMethod === 'cash' || tx.paymentMethod === 'bank') {
            const financialTxData = {
                date: tx.date, expected_amount: tx.expected_amount, actual_amount: tx.actual_amount,
                difference: tx.difference, difference_reason: tx.difference_reason,
                description: tx.description || `${tx.type} of ${tx.weight}kg of ${tx.stockItemName}`,
                category: tx.type === 'purchase' ? 'Stock Purchase' : 'Stock Sale', linkedStockTxId: stockTempId,
            };

            if (tx.paymentMethod === 'cash') {
                const cashTempId = `temp_cash_${Date.now()}`;
                await db.cashTransactions.add({ ...financialTxData, type: tx.type === 'purchase' ? 'expense' : 'income', id: cashTempId, createdAt: new Date().toISOString() });
                savedStockTxPromise.then(async (savedStockTx) => {
                    if (savedStockTx) {
                        await db.stockTransactions.where({ id: stockTempId }).modify(savedStockTx);
                        const finalFinancialData = { ...financialTxData, type: tx.type === 'purchase' ? 'expense' : 'income', linkedStockTxId: savedStockTx.id };
                        const savedFinancialTx = await queueOrSync({ action: 'appendData', payload: { tableName: 'cash_transactions', data: finalFinancialData, select: '*' } });
                        if(savedFinancialTx) await db.cashTransactions.where({ id: cashTempId }).modify(savedFinancialTx);
                    }
                });
            } else {
                const bankTempId = `temp_bank_${Date.now()}`;
                await db.bankTransactions.add({ ...financialTxData, type: tx.type === 'purchase' ? 'withdrawal' : 'deposit', bank_id: bank_id!, id: bankTempId, createdAt: new Date().toISOString() });
                savedStockTxPromise.then(async (savedStockTx) => {
                    if (savedStockTx) {
                        await db.stockTransactions.where({ id: stockTempId }).modify(savedStockTx);
                        const finalFinancialData = { ...financialTxData, type: tx.type === 'purchase' ? 'withdrawal' : 'deposit', bank_id: bank_id!, linkedStockTxId: savedStockTx.id };
                        const savedFinancialTx = await queueOrSync({ action: 'appendData', payload: { tableName: 'bank_transactions', data: finalFinancialData, select: '*' } });
                        if(savedFinancialTx) await db.bankTransactions.where({ id: bankTempId }).modify(savedFinancialTx);
                    }
                });
            }
        } else if (tx.paymentMethod === 'credit') {
            const ledgerTempId = `temp_ledger_${Date.now()}`;
            const ledgerData = {
                type: tx.type === 'purchase' ? 'payable' : 'receivable',
                description: tx.description || `${tx.stockItemName} (${tx.weight}kg)`,
                amount: tx.actual_amount, date: tx.date, contact_id: tx.contact_id!, contact_name: tx.contact_name!,
            };
            const ledgerToSave = { ...ledgerData, status: 'unpaid', paid_amount: 0, installments: [] };
            await db.ledgerTransactions.add({ ...ledgerToSave, id: ledgerTempId, createdAt: new Date().toISOString() });
            const { installments, ...dataToSync } = ledgerToSave;
            const savedLedgerTx = await queueOrSync({ action: 'appendData', payload: { tableName: 'ap_ar_transactions', data: dataToSync, select: '*' } });
            if (savedLedgerTx) await db.ledgerTransactions.where({ id: ledgerTempId }).modify({ ...savedLedgerTx, installments: [] });
        }
        await updateBalances();
    };

    const addLedgerTransaction = async (tx: Omit<LedgerTransaction, 'id' | 'createdAt' | 'deletedAt' | 'status' | 'paid_amount' | 'installments'>) => {
        const tempId = `temp_${Date.now()}`;
        const dataToSave = { ...tx, status: 'unpaid', paid_amount: 0, installments: [] };
        await db.ledgerTransactions.add({ ...dataToSave, id: tempId, createdAt: new Date().toISOString() });
        await updateBalances();
        try {
            const { installments, ...syncData } = dataToSave;
            const newTx = await queueOrSync({ action: 'appendData', payload: { tableName: 'ap_ar_transactions', data: syncData, logDescription: `Added A/P or A/R: ${tx.description}`, select: '*' } });
            if (newTx) await db.ledgerTransactions.where({ id: tempId }).modify({ ...newTx, installments: []});
        } catch (error) { handleApiError(error); }
    }
    
    const editCashTransaction = async (originalTx: CashTransaction, updatedTxData: Partial<Omit<CashTransaction, 'id' | 'date' | 'createdAt'>>) => {
        await db.cashTransactions.update(originalTx.id, updatedTxData);
        await updateBalances();
        await queueOrSync({ action: 'updateData', payload: { tableName: 'cash_transactions', id: originalTx.id, data: updatedTxData, logDescription: `Edited cash tx: ${originalTx.id}` }});
        toast.success("Cash transaction updated.");
    };

    const editBankTransaction = async (originalTx: BankTransaction, updatedTxData: Partial<Omit<BankTransaction, 'id'| 'date' | 'createdAt'>>) => {
        await db.bankTransactions.update(originalTx.id, updatedTxData);
        await updateBalances();
        await queueOrSync({ action: 'updateData', payload: { tableName: 'bank_transactions', id: originalTx.id, data: updatedTxData, logDescription: `Edited bank tx: ${originalTx.id}` }});
        toast.success("Bank transaction updated.");
    };

    const editStockTransaction = async (originalTx: StockTransaction, updatedTxData: Partial<Omit<StockTransaction, 'id' | 'date' | 'createdAt'>>) => {
        await db.stockTransactions.update(originalTx.id, updatedTxData);
        await updateBalances();
        await queueOrSync({ action: 'updateStockTransaction', payload: { stockTxId: originalTx.id, updates: updatedTxData } });
        toast.success("Stock transaction updated.");
    };

    const deleteTransaction = async (tableName: 'cash_transactions' | 'bank_transactions' | 'stock_transactions' | 'ap_ar_transactions', localTable: 'cashTransactions' | 'bankTransactions' | 'stockTransactions' | 'ledgerTransactions', txToDelete: any) => {
        await db.table(localTable).delete(txToDelete.id);
        await updateBalances();
        await queueOrSync({ action: 'deleteData', payload: { tableName, id: txToDelete.id, logDescription: `Deleted item from ${tableName}` }});
        if (tableName === 'stock_transactions') {
            const linkedCash = await db.cashTransactions.where({ linkedStockTxId: txToDelete.id }).first();
            if (linkedCash) {
                 await queueOrSync({ action: 'deleteData', payload: { tableName: 'cash_transactions', id: linkedCash.id }});
                 await db.cashTransactions.delete(linkedCash.id);
            }
            const linkedBank = await db.bankTransactions.where({ linkedStockTxId: txToDelete.id }).first();
            if (linkedBank) {
                 await queueOrSync({ action: 'deleteData', payload: { tableName: 'bank_transactions', id: linkedBank.id }});
                 await db.bankTransactions.delete(linkedBank.id);
            }
        }
        toast.success("Moved to recycle bin.");
    };
    
    const setFontSize = (size: 'sm' | 'base' | 'lg') => db.appState.update(1, { fontSize: size });
    const setWastagePercentage = (percentage: number) => db.appState.update(1, { wastagePercentage: percentage });
    const setCurrency = (currency: string) => db.appState.update(1, { currency: currency });
    const setShowStockValue = (show: boolean) => db.appState.update(1, { showStockValue: show });

    const addBank = async (name: string) => {
        const tempId = `temp_${Date.now()}`;
        await db.banks.add({ id: tempId, name, createdAt: new Date().toISOString() });
        const newBank = await queueOrSync({ action: 'appendData', payload: { tableName: 'banks', data: { name }, select: '*' } });
        if(newBank) await db.banks.where({ id: tempId }).modify(newBank);
    };

    const addCategory = async (type: 'cash' | 'bank', name: string, direction: 'credit' | 'debit') => {
        const tempId = `temp_${Date.now()}`;
        await db.categories.add({ id: tempId, name, type, direction, is_deletable: true});
        const newCategory = await queueOrSync({ action: 'appendData', payload: { tableName: 'categories', data: { name, type, direction, is_deletable: true }, select: '*' } });
        if(newCategory) await db.categories.where({id: tempId}).modify(newCategory);
    };

    const deleteCategory = async (id: string) => {
        await db.categories.delete(id);
        await queueOrSync({ action: 'deleteData', payload: { tableName: 'categories', id } });
    };

    const transferFunds = async (from: 'cash' | 'bank', amount: number, date?: string, bankId?: string, description?: string) => {
        await reloadData({ force: true });
    };

    const setInitialBalances = async (cash: number, bankTotals: Record<string, number>, date: Date) => {
        const payload = { cash, bankTotals, date: date.toISOString() };
        await queueOrSync({ action: 'setInitialBalances', payload });
        await reloadData({ force: true });
    };
    
    const addInitialStockItem = async (item: { name: string; weight: number; pricePerKg: number }) => {
      const newItem = await server.appendData({ tableName: 'initial_stock', data: { name: item.name, weight: item.weight, purchasePricePerKg: item.pricePerKg }, select: '*' });
      if(newItem) await db.initialStock.add(newItem as any);
    }
    
    const addVendor = async (name: string) => {
        const tempId = `temp_vendor_${Date.now()}`;
        await db.vendors.add({ id: tempId, name, createdAt: new Date().toISOString() });
        const newVendor = await queueOrSync({ action: 'appendData', payload: { tableName: 'vendors', data: { name }, select: '*' }});
        if (newVendor) {
            await db.vendors.where({id: tempId}).modify(newVendor);
            return newVendor as Vendor;
        }
        return null;
    };
  
    const addClient = async (name: string) => {
        const tempId = `temp_client_${Date.now()}`;
        await db.clients.add({ id: tempId, name, createdAt: new Date().toISOString() });
        const newClient = await queueOrSync({ action: 'appendData', payload: { tableName: 'clients', data: { name }, select: '*' }});
        if (newClient) {
            await db.clients.where({id: tempId}).modify(newClient);
            return newClient as Client;
        }
        return null;
    };

    const recordPayment = async (contactId: string, contactName: string, paymentAmount: number, paymentMethod: 'cash' | 'bank', paymentDate: Date, ledgerType: 'payable' | 'receivable', bankId?: string) => {
        await queueOrSync({ 
            action: 'recordPaymentAgainstTotal', 
            payload: { contact_id: contactId, contact_name: contactName, payment_amount: paymentAmount, payment_date: paymentDate.toISOString(), payment_method: paymentMethod, ledger_type: ledgerType, bank_id: bankId, }
        });
        await reloadData({ force: true });
    };
    
    const loadDataForMonth = useCallback(async (month: Date) => {
        const monthKey = month.toISOString().slice(0, 7);
        try {
            const startDate = new Date(month.getFullYear(), month.getMonth(), 1).toISOString();
            const endDate = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59).toISOString();
            const [cashTxs, bankTxs, stockTxs] = await Promise.all([
                server.readData({ tableName: 'cash_transactions', startDate, endDate }),
                server.readData({ tableName: 'bank_transactions', startDate, endDate }),
                server.readData({ tableName: 'stock_transactions', startDate, endDate }),
            ]);

            await db.transaction('rw', db.cashTransactions, db.bankTransactions, db.stockTransactions, async () => {
                if (cashTxs) await bulkPut('cashTransactions', cashTxs);
                if (bankTxs) await bulkPut('bankTransactions', bankTxs);
                if (stockTxs) await bulkPut('stockTransactions', stockTxs);
            });
            setLoadedMonths(prev => ({ ...prev, [monthKey]: true }));
        } catch (error) {
            handleApiError(error);
        }
    }, [handleApiError, setLoadedMonths]);

    const loadRecycleBinData = useCallback(async () => {
        try {
            const [cash, bank, stock, ap_ar] = await Promise.all([
                server.readDeletedData({ tableName: 'cash_transactions'}),
                server.readDeletedData({ tableName: 'bank_transactions'}),
                server.readDeletedData({ tableName: 'stock_transactions'}),
                server.readDeletedData({ tableName: 'ap_ar_transactions'}),
            ]);
            setDeletedItems({ cash: cash || [], bank: bank || [], stock: stock || [], ap_ar: ap_ar || [] });
        } catch (error) {
            handleApiError(error);
        }
    }, [handleApiError, setDeletedItems]);

    const restoreTransaction = useCallback(async (txType: 'cash' | 'bank' | 'stock' | 'ap_ar', id: string) => {
        let tableName = '';
        switch(txType) {
            case 'cash': tableName = 'cash_transactions'; break;
            case 'bank': tableName = 'bank_transactions'; break;
            case 'stock': tableName = 'stock_transactions'; break;
            case 'ap_ar': tableName = 'ap_ar_transactions'; break;
        }
        await queueOrSync({ action: 'restoreData', payload: { tableName, id } });
        toast.success("Item restored successfully.");
        await loadRecycleBinData();
        await updateBalances();
    }, [queueOrSync, loadRecycleBinData, updateBalances]);
    
    const emptyRecycleBin = useCallback(async () => {
        await server.emptyRecycleBin();
        toast.success("Recycle bin has been emptied.");
        await loadRecycleBinData();
    }, [loadRecycleBinData]);

    const handleExport = async () => {
        // To be implemented
    };
    const handleImport = async (file: File) => {
        // To be implemented
    };
    const handleDeleteAllData = async () => {
        await server.deleteAllData();
        // The logout is handled server-side, but we trigger a local one too
        const { logout } = useAppContext();
        logout();
    };

    return {
        login,
        addCashTransaction,
        addBankTransaction,
        addStockTransaction,
        addLedgerTransaction,
        editCashTransaction,
        editBankTransaction,
        editStockTransaction,
        deleteCashTransaction: (tx: CashTransaction) => deleteTransaction('cash_transactions', 'cashTransactions', tx),
        deleteBankTransaction: (tx: BankTransaction) => deleteTransaction('bank_transactions', 'bankTransactions', tx),
        deleteStockTransaction: (tx: StockTransaction) => deleteTransaction('stock_transactions', 'stockTransactions', tx),
        deleteLedgerTransaction: (tx: LedgerTransaction) => deleteTransaction('ap_ar_transactions', 'ledgerTransactions', tx),
        deleteMultipleCashTransactions: (txs: CashTransaction[]) => Promise.all(txs.map(tx => deleteTransaction('cash_transactions', 'cashTransactions', tx))),
        deleteMultipleBankTransactions: (txs: BankTransaction[]) => Promise.all(txs.map(tx => deleteTransaction('bank_transactions', 'bankTransactions', tx))),
        deleteMultipleStockTransactions: (txs: StockTransaction[]) => Promise.all(txs.map(tx => deleteTransaction('stock_transactions', 'stockTransactions', tx))),
        setFontSize,
        setWastagePercentage,
        setCurrency,
        setShowStockValue,
        addBank,
        addCategory,
        deleteCategory,
        transferFunds,
        setInitialBalances,
        addInitialStockItem,
        addVendor,
        addClient,
        recordPayment,
        loadDataForMonth,
        loadRecycleBinData,
        restoreTransaction,
        emptyRecycleBin,
        handleExport,
        handleImport,
        handleDeleteAllData,
    };
}
