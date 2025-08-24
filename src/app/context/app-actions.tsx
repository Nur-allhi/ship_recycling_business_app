
"use client";
import { useCallback } from 'react';
import { toast } from 'sonner';
import { db, bulkPut } from '@/lib/db';
import type { SyncQueueItem } from '@/lib/db';
import { useAppContext } from './app-context';
import type { CashTransaction, BankTransaction, StockTransaction, Vendor, Client, LedgerTransaction, PaymentInstallment, StockItem } from '@/lib/types';
import * as server from '@/lib/actions'; 
import { login as serverLogin, logout as serverLogout } from '@/app/auth/actions';

export function useAppActions() {
    const { isOnline, handleApiError, reloadData, updateBalances, processSyncQueue, setUser, login, logout } = useAppContext();

    const queueOrSync = useCallback(async (item: Omit<SyncQueueItem, 'timestamp' | 'id'>) => {
        const id = await db.sync_queue.add({ ...item, timestamp: Date.now() });
        if (isOnline) {
            // Don't await this. Let it run in the background.
            processSyncQueue(id); 
        } else {
            toast.info("You are offline. Change saved locally and will sync later.");
        }
    }, [isOnline, processSyncQueue]);
    
    // Auth actions are now in src/app/auth/actions.ts


    // DATA MUTATION ACTIONS
    const addCashTransaction = async (tx: Omit<CashTransaction, 'id' | 'createdAt' | 'deletedAt'>) => {
        const tempId = `temp_${Date.now()}`;
        const newTxData: CashTransaction = { ...tx, id: tempId, createdAt: new Date().toISOString() };
        
        await db.cash_transactions.add(newTxData);
        await updateBalances();

        if (tx.category === 'A/R Settlement' || tx.category === 'A/P Settlement') {
            const payload = {
                payment_method: 'cash' as const, date: tx.date, amount: tx.actual_amount, category: tx.category,
                description: tx.description, contact_id: tx.contact_id!,
                contact_name: tx.type === 'income' ? (await db.clients.get(tx.contact_id!))?.name || '?' : (await db.vendors.get(tx.contact_id!))?.name || '?',
            };
            queueOrSync({ action: 'recordDirectPayment', payload: { ...payload, localId: tempId } });
        } else {
            queueOrSync({ action: 'appendData', payload: { tableName: 'cash_transactions', data: tx, localId: tempId, logDescription: `Added cash transaction: ${tx.description}`, select: '*' } });
        }
    };

    const addBankTransaction = async (tx: Omit<BankTransaction, 'id' | 'createdAt' | 'deletedAt'>) => {
        const tempId = `temp_${Date.now()}`;
        const newTxData: BankTransaction = { ...tx, id: tempId, createdAt: new Date().toISOString() };
        
        await db.bank_transactions.add(newTxData);
        await updateBalances();
        
        if (tx.category === 'A/R Settlement' || tx.category === 'A/P Settlement') {
            const payload = {
                payment_method: 'bank' as const, bank_id: tx.bank_id, date: tx.date, amount: tx.actual_amount, category: tx.category,
                description: tx.description, contact_id: tx.contact_id!,
                contact_name: tx.type === 'deposit' ? (await db.clients.get(tx.contact_id!))?.name || '?' : (await db.vendors.get(tx.contact_id!))?.name || '?',
            };
            queueOrSync({ action: 'recordDirectPayment', payload: { ...payload, localId: tempId } });
        } else {
            queueOrSync({ action: 'appendData', payload: { tableName: 'bank_transactions', data: tx, localId: tempId, logDescription: `Added bank transaction: ${tx.description}`, select: '*' } });
        }
    };

    const addStockTransaction = async (tx: Omit<StockTransaction, 'id' | 'createdAt' | 'deletedAt'> & { contact_id?: string; contact_name?: string }, bank_id?: string) => {
        const stockTempId = `temp_stock_${Date.now()}`;
        const newStockTxData: StockTransaction = { ...tx, id: stockTempId, createdAt: new Date().toISOString() };

        await db.stock_transactions.add(newStockTxData);

        if (tx.paymentMethod === 'cash' || tx.paymentMethod === 'bank') {
            const financialTempId = `temp_fin_${Date.now()}`;
            const financialTxData = {
                id: financialTempId, createdAt: new Date().toISOString(),
                date: tx.date, expected_amount: tx.expected_amount, actual_amount: tx.actual_amount,
                difference: tx.difference, difference_reason: tx.difference_reason,
                description: tx.description || `${tx.type} of ${tx.weight}kg of ${tx.stockItemName}`,
                category: tx.type === 'purchase' ? 'Stock Purchase' : 'Stock Sale', linkedStockTxId: stockTempId,
                contact_id: tx.contact_id, // Pass contact_id here
            };

            if (tx.paymentMethod === 'cash') {
                await db.cash_transactions.add({ ...financialTxData, type: tx.type === 'purchase' ? 'expense' : 'income' });
            } else {
                await db.bank_transactions.add({ ...financialTxData, type: tx.type === 'purchase' ? 'withdrawal' : 'deposit', bank_id: bank_id! });
            }
        } else if (tx.paymentMethod === 'credit') {
            const ledgerTempId = `temp_ledger_${Date.now()}`;
            const ledgerData: LedgerTransaction = {
                id: ledgerTempId,
                type: tx.type === 'purchase' ? 'payable' : 'receivable',
                description: tx.description || `${tx.stockItemName} (${tx.weight}kg)`,
                amount: tx.actual_amount, date: tx.date, contact_id: tx.contact_id!, contact_name: tx.contact_name!,
                status: 'unpaid', paid_amount: 0, installments: []
            };
            await db.ap_ar_transactions.add(ledgerData);
        }
        
        await updateBalances();
        
        // Queue the entire stock operation for background sync
        queueOrSync({
            action: 'addStockTransaction',
            payload: { stockTx: tx, bank_id, localId: stockTempId }
        });
    };

    const addLedgerTransaction = async (tx: Omit<LedgerTransaction, 'id' | 'deletedAt' | 'status' | 'paid_amount' | 'installments'>) => {
        const tempId = `temp_${Date.now()}`;
        const dataToSave: LedgerTransaction = { ...tx, status: 'unpaid', paid_amount: 0, installments: [], id: tempId };
        await db.ap_ar_transactions.add(dataToSave);
        await updateBalances();
        
        const { installments, ...syncData } = dataToSave;
        queueOrSync({ action: 'appendData', payload: { tableName: 'ap_ar_transactions', data: syncData, localId: tempId, logDescription: `Added A/P or A/R: ${tx.description}`, select: '*' } });
    }
    
    const editCashTransaction = async (originalTx: CashTransaction, updatedTxData: Partial<Omit<CashTransaction, 'id' | 'date' | 'createdAt'>>) => {
        await db.cash_transactions.update(originalTx.id, updatedTxData);
        await updateBalances();
        queueOrSync({ action: 'updateData', payload: { tableName: 'cash_transactions', id: originalTx.id, data: updatedTxData, logDescription: `Edited cash tx: ${originalTx.id}` }});
        toast.success("Cash transaction updated locally.");
    };

    const editBankTransaction = async (originalTx: BankTransaction, updatedTxData: Partial<Omit<BankTransaction, 'id'| 'date' | 'createdAt'>>) => {
        await db.bank_transactions.update(originalTx.id, updatedTxData);
        await updateBalances();
        queueOrSync({ action: 'updateData', payload: { tableName: 'bank_transactions', id: originalTx.id, data: updatedTxData, logDescription: `Edited bank tx: ${originalTx.id}` }});
        toast.success("Bank transaction updated locally.");
    };

    const editStockTransaction = async (originalTx: StockTransaction, updatedTxData: Partial<Omit<StockTransaction, 'id' | 'date' | 'createdAt'>>) => {
        const fullUpdate = { ...originalTx, ...updatedTxData };
        const newActualAmount = fullUpdate.weight * fullUpdate.pricePerKg;
        const finalUpdates = {
            ...updatedTxData,
            actual_amount: newActualAmount,
            expected_amount: newActualAmount,
            difference: 0,
            difference_reason: 'Edited transaction',
        };

        await db.stock_transactions.update(originalTx.id, finalUpdates);
        
        const linkedCash = await db.cash_transactions.where({ linkedStockTxId: originalTx.id }).first();
        if (linkedCash) {
            await db.cash_transactions.update(linkedCash.id, { actual_amount: newActualAmount, expected_amount: newActualAmount, difference: 0 });
        }
        const linkedBank = await db.bank_transactions.where({ linkedStockTxId: originalTx.id }).first();
        if (linkedBank) {
            await db.bank_transactions.update(linkedBank.id, { actual_amount: newActualAmount, expected_amount: newActualAmount, difference: 0 });
        }

        await updateBalances();
        queueOrSync({ action: 'updateStockTransaction', payload: { stockTxId: originalTx.id, updates: finalUpdates } });
        toast.success("Stock transaction updated locally.");
    };

    const deleteTransaction = async (tableName: 'cash_transactions' | 'bank_transactions' | 'stock_transactions' | 'ap_ar_transactions', txToDelete: any) => {
        await db.table(tableName).delete(txToDelete.id);
        
        if (tableName === 'stock_transactions') {
            const linkedCash = await db.cash_transactions.where({ linkedStockTxId: txToDelete.id }).first();
            if (linkedCash) {
                 await db.cash_transactions.delete(linkedCash.id);
            }
            const linkedBank = await db.bank_transactions.where({ linkedStockTxId: txToDelete.id }).first();
            if (linkedBank) {
                 await db.bank_transactions.delete(linkedBank.id);
            }
        }
        
        await updateBalances();
        queueOrSync({ action: 'deleteData', payload: { tableName, id: txToDelete.id, logDescription: `Deleted item from ${tableName}` }});
        toast.success("Moved to recycle bin.");
    };
    
    const setFontSize = (size: 'sm' | 'base' | 'lg') => db.app_state.update(1, { fontSize: size });
    const setWastagePercentage = (percentage: number) => db.app_state.update(1, { wastagePercentage: percentage });
    const setCurrency = (currency: string) => db.app_state.update(1, { currency: currency });
    const setShowStockValue = (show: boolean) => db.app_state.update(1, { showStockValue: show });

    const addBank = async (name: string) => {
        const tempId = `temp_${Date.now()}`;
        await db.banks.add({ id: tempId, name, createdAt: new Date().toISOString() });
        queueOrSync({ action: 'appendData', payload: { tableName: 'banks', data: { name }, localId: tempId, select: '*' } });
    };

    const addCategory = async (type: 'cash' | 'bank', name: string, direction: 'credit' | 'debit') => {
        const tempId = `temp_${Date.now()}`;
        await db.categories.add({ id: tempId, name, type, direction, is_deletable: true});
        queueOrSync({ action: 'appendData', payload: { tableName: 'categories', data: { name, type, direction, is_deletable: true }, localId: tempId, select: '*' } });
    };

    const deleteCategory = async (id: string) => {
        await db.categories.delete(id);
        queueOrSync({ action: 'deleteCategory', payload: { id } });
    };

    const transferFunds = async (from: 'cash' | 'bank', amount: number, date: string, bankId: string, description?: string) => {
        const fromDesc = `Transfer to ${from === 'cash' ? `Bank` : 'Cash'}: ${description || 'Funds Transfer'}`;
        const toDesc = `Transfer from ${from === 'cash' ? 'Cash' : `Bank`}: ${description || 'Funds Transfer'}`;

        if (from === 'cash') {
            await db.cash_transactions.add({ id: `temp_tf_cash_${Date.now()}`, date, type: 'expense', category: 'Funds Transfer', description: fromDesc, actual_amount: amount, expected_amount: amount, difference: 0, createdAt: new Date().toISOString() });
            await db.bank_transactions.add({ id: `temp_tf_bank_${Date.now()}`, date, type: 'deposit', category: 'Funds Transfer', description: toDesc, actual_amount: amount, expected_amount: amount, difference: 0, bank_id: bankId, createdAt: new Date().toISOString() });
        } else {
            await db.bank_transactions.add({ id: `temp_tf_bank_${Date.now()}`, date, type: 'withdrawal', category: 'Funds Transfer', description: fromDesc, actual_amount: amount, expected_amount: amount, difference: 0, bank_id: bankId, createdAt: new Date().toISOString() });
            await db.cash_transactions.add({ id: `temp_tf_cash_${Date.now()}`, date, type: 'income', category: 'Funds Transfer', description: toDesc, actual_amount: amount, expected_amount: amount, difference: 0, createdAt: new Date().toISOString() });
        }
        
        await updateBalances();
        queueOrSync({ action: 'transferFunds', payload: { from, amount, date, bankId, description } });
        toast.success("Transfer recorded locally.");
    };

    const setInitialBalances = async (cash: number, bankTotals: Record<string, number>, date: Date) => {
        // Clear existing initial balance entries locally to avoid duplicates
        const oldInitialCash = await db.cash_transactions.where('category').equals('Initial Balance').toArray();
        const oldInitialBank = await db.bank_transactions.where('category').equals('Initial Balance').toArray();
        await db.cash_transactions.bulkDelete(oldInitialCash.map(tx => tx.id));
        await db.bank_transactions.bulkDelete(oldInitialBank.map(tx => tx.id));

        // Add new initial balance entries
        await db.cash_transactions.add({ id: `temp_init_cash_${Date.now()}`, date: date.toISOString(), type: 'income', category: 'Initial Balance', description: 'Initial cash balance', actual_amount: cash, expected_amount: cash, difference: 0, createdAt: new Date().toISOString() });
        for (const [bankId, amount] of Object.entries(bankTotals)) {
            await db.bank_transactions.add({ id: `temp_init_bank_${bankId}_${Date.now()}`, date: date.toISOString(), type: 'deposit', category: 'Initial Balance', description: 'Initial bank balance', actual_amount: amount, expected_amount: amount, difference: 0, bank_id: bankId, createdAt: new Date().toISOString() });
        }
        
        await updateBalances();
        queueOrSync({ action: 'setInitialBalances', payload: { cash, bankTotals, date: date.toISOString() } });
    };
    
    const addInitialStockItem = async (item: { name: string; weight: number; pricePerKg: number }) => {
      const newItem: StockItem = { ...item, id: `temp_init_stock_${Date.now()}`, purchasePricePerKg: item.pricePerKg };
      await db.initial_stock.add(newItem as any);
      await updateBalances();
      queueOrSync({ action: 'addInitialStockItem', payload: { item } });
    }
    
    const addVendor = async (name: string): Promise<Vendor> => {
        const tempId = `temp_vendor_${Date.now()}`;
        const newVendor = { id: tempId, name, createdAt: new Date().toISOString() };
        await db.vendors.add(newVendor);
        queueOrSync({ action: 'appendData', payload: { tableName: 'vendors', data: { name }, localId: tempId, select: '*' }});
        return newVendor;
    };
  
    const addClient = async (name: string): Promise<Client> => {
        const tempId = `temp_client_${Date.now()}`;
        const newClient = { id: tempId, name, createdAt: new Date().toISOString() };
        await db.clients.add(newClient);
        queueOrSync({ action: 'appendData', payload: { tableName: 'clients', data: { name }, localId: tempId, select: '*' }});
        return newClient;
    };

    const deleteVendor = async (id: string) => {
        await db.vendors.delete(id);
        queueOrSync({ action: 'deleteVendor', payload: { id } });
    };
  
    const deleteClient = async (id: string) => {
        await db.clients.delete(id);
        queueOrSync({ action: 'deleteClient', payload: { id } });
    };

    const recordPayment = async (contactId: string, contactName: string, paymentAmount: number, paymentMethod: 'cash' | 'bank', paymentDate: Date, ledgerType: 'payable' | 'receivable', bankId?: string) => {
        const tempId = `temp_payment_${Date.now()}`;
        const desc = `Payment ${ledgerType === 'payable' ? 'to' : 'from'} ${contactName}`;
        const category = ledgerType === 'payable' ? 'A/P Settlement' : 'A/R Settlement';

        // Add the financial transaction locally
        if (paymentMethod === 'cash') {
            await db.cash_transactions.add({ id: tempId, date: paymentDate.toISOString(), type: ledgerType === 'payable' ? 'expense' : 'income', category, description: desc, actual_amount: paymentAmount, expected_amount: paymentAmount, difference: 0, createdAt: new Date().toISOString(), contact_id: contactId });
        } else {
            await db.bank_transactions.add({ id: tempId, date: paymentDate.toISOString(), type: ledgerType === 'payable' ? 'withdrawal' : 'deposit', category, description: desc, actual_amount: paymentAmount, expected_amount: paymentAmount, difference: 0, bank_id: bankId!, createdAt: new Date().toISOString(), contact_id: contactId });
        }

        // Apply payment to local ledger transactions
        let amountToSettle = paymentAmount;
        const outstandingTxs = await db.ap_ar_transactions
            .where({ contact_id: contactId, type: ledgerType })
            .filter(tx => tx.status !== 'paid')
            .sortBy('date');
            
        for (const tx of outstandingTxs) {
            if (amountToSettle <= 0) break;
            const remainingBalance = tx.amount - tx.paid_amount;
            const paymentForThisTx = Math.min(amountToSettle, remainingBalance);
            
            const newPaidAmount = tx.paid_amount + paymentForThisTx;
            const newStatus = newPaidAmount >= tx.amount ? 'paid' : 'partially paid';
            
            await db.ap_ar_transactions.update(tx.id, { paid_amount: newPaidAmount, status: newStatus });
            
            // Add installment locally (optional, but good for consistency)
            const installment: PaymentInstallment = {
                id: `temp_inst_${Date.now()}`,
                ap_ar_transaction_id: tx.id,
                amount: paymentForThisTx,
                date: paymentDate.toISOString(),
                payment_method: paymentMethod,
                createdAt: new Date().toISOString(),
            };
            await db.payment_installments.add(installment);
            
            amountToSettle -= paymentForThisTx;
        }

        await updateBalances();
        queueOrSync({ 
            action: 'recordPaymentAgainstTotal', 
            payload: { contact_id: contactId, contact_name: contactName, payment_amount: paymentAmount, payment_date: paymentDate.toISOString(), payment_method: paymentMethod, ledger_type: ledgerType, bank_id: bankId, localId: tempId }
        });
        toast.success("Payment recorded locally.");
    };

    const recordAdvancePayment = async (payload: { contact_id: string, contact_name: string, amount: number, date: Date, payment_method: 'cash' | 'bank', ledger_type: 'payable' | 'receivable', bank_id?: string, description?: string }) => {
        const { contact_id, contact_name, amount, date, payment_method, ledger_type, bank_id, description } = payload;
        
        const tempLedgerId = `temp_adv_ledger_${Date.now()}`;
        const tempFinancialId = `temp_adv_fin_${Date.now()}`;
        const ledgerDescription = description || `Advance ${ledger_type === 'payable' ? 'to' : 'from'} ${contact_name}`;

        // Create the advance entry in the local ledger. Amount is negative.
        const advanceLedgerEntry: LedgerTransaction = {
            id: tempLedgerId,
            date: date.toISOString(),
            type: 'advance',
            description: ledgerDescription,
            amount: -amount,
            paid_amount: 0,
            status: 'paid',
            contact_id: contact_id,
            contact_name: contact_name,
            installments: []
        };
        await db.ap_ar_transactions.add(advanceLedgerEntry);

        // Create the corresponding financial transaction
        const financialTxData = {
            id: tempFinancialId,
            date: date.toISOString(),
            description: ledgerDescription,
            category: `Advance ${ledger_type === 'payable' ? 'Payment' : 'Received'}`,
            expected_amount: amount,
            actual_amount: amount,
            difference: 0,
            advance_id: tempLedgerId,
            createdAt: new Date().toISOString(),
            contact_id: contact_id,
        };

        if (payment_method === 'cash') {
            await db.cash_transactions.add({ ...financialTxData, type: ledger_type === 'payable' ? 'expense' : 'income' });
        } else {
            await db.bank_transactions.add({ ...financialTxData, type: ledger_type === 'payable' ? 'withdrawal' : 'deposit', bank_id: bank_id! });
        }
        
        await updateBalances();
        
        // Queue the entire operation for the server
        queueOrSync({
            action: 'recordAdvancePayment',
            payload: { ...payload, date: date.toISOString(), localLedgerId: tempLedgerId, localFinancialId: tempFinancialId }
        });
        
        toast.success("Advance payment recorded locally and will sync to the server.");
    };
    
    const loadDataForMonth = useCallback(async (month: Date) => {
       // This function is now less critical for UI speed but good for fetching historical data.
       // The implementation in app-context.tsx can handle this.
       // We keep the shell of the function here in case it's needed for other purposes.
    }, []);

    const { loadRecycleBinData, setDeletedItems } = useAppContext();
    const restoreTransaction = useCallback(async (txType: 'cash' | 'bank' | 'stock' | 'ap_ar', id: string) => {
        let tableName: 'cash_transactions' | 'bank_transactions' | 'stock_transactions' | 'ap_ar_transactions' = 'cash_transactions';
        
        switch(txType) {
            case 'cash': tableName = 'cash_transactions'; break;
            case 'bank': tableName = 'bank_transactions'; break;
            case 'stock': tableName = 'stock_transactions'; break;
            case 'ap_ar': tableName = 'ap_ar_transactions'; break;
        }

        queueOrSync({ action: 'restoreData', payload: { tableName, id } });
        // Optimistic UI update for recycle bin
        setDeletedItems(prev => ({ ...prev, [txType]: (prev as any)[txType].filter((item: any) => item.id !== id) }));
        
        toast.success("Item restoration queued.");
        
        // No need to await a full reload. We can add the item back locally if we want,
        // but for now, letting the next sync/reload handle it is simpler.
        // A full reload can be triggered manually by the user if they want to see it immediately.
        await updateBalances(); // This is fast and local now.
    }, [queueOrSync, setDeletedItems, updateBalances]);
    
    const emptyRecycleBin = useCallback(async () => {
        queueOrSync({ action: 'emptyRecycleBin', payload: {} });
        setDeletedItems({ cash: [], bank: [], stock: [], ap_ar: [] });
        toast.success("Recycle bin clearing queued.");
    }, [queueOrSync, setDeletedItems]);

    const handleExport = async () => {
        try {
            const data = await server.exportAllData();
            // Trigger download on client
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `shipshape_ledger_backup_${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            URL.revokeObjectURL(link.href);
            toast.success("Backup downloaded.");
        } catch(e) {
            handleApiError(e);
        }
    };

    const handleImport = async (file: File) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target?.result as string);
                queueOrSync({ action: 'batchImportData', payload: { data } });
                toast.info("Data import has been queued. The app will reload once completed.");
                // Let the sync process handle the reload
            } catch (e) {
                toast.error("Import failed", { description: "Invalid file format." });
            }
        };
        reader.readAsText(file);
    };

    const handleDeleteAllData = async () => {
        toast.info("Deleting all data. You will be logged out.");
        queueOrSync({ action: 'deleteAllData', payload: {} });
    };

    return {
        addCashTransaction,
        addBankTransaction,
        addStockTransaction,
        addLedgerTransaction,
        editCashTransaction,
        editBankTransaction,
        editStockTransaction,
        deleteCashTransaction: (tx: CashTransaction) => deleteTransaction('cash_transactions', tx),
        deleteBankTransaction: (tx: BankTransaction) => deleteTransaction('bank_transactions', tx),
        deleteStockTransaction: (tx: StockTransaction) => deleteTransaction('stock_transactions', tx),
        deleteLedgerTransaction: (tx: LedgerTransaction) => deleteTransaction('ap_ar_transactions', tx),
        deleteMultipleCashTransactions: (txs: CashTransaction[]) => Promise.all(txs.map(tx => deleteTransaction('cash_transactions', tx))),
        deleteMultipleBankTransactions: (txs: BankTransaction[]) => Promise.all(txs.map(tx => deleteTransaction('bank_transactions', tx))),
        deleteMultipleStockTransactions: (txs: StockTransaction[]) => Promise.all(txs.map(tx => deleteTransaction('stock_transactions', tx))),
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
        deleteVendor,
        deleteClient,
        recordPayment,
        recordAdvancePayment,
        loadDataForMonth,
        loadRecycleBinData,
        restoreTransaction,
        emptyRecycleBin,
        handleExport,
        handleImport,
        handleDeleteAllData,
        login,
        logout
    };
}
