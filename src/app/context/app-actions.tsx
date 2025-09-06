
"use client";
import { useCallback } from 'react';
import { toast } from 'sonner';
import { db } from '@/lib/db';
import type { User } from '@/lib/db';
import { useDataSyncer } from './useDataSyncer';
import { useSessionManager } from './useSessionManager';
import type { CashTransaction, BankTransaction, StockTransaction, Contact, LedgerTransaction, LedgerPayment, StockItem, Loan, LoanPayment } from '@/lib/types';
import * as server from '@/lib/actions'; 
import { getSession } from '../auth/actions';
import { useAppContext } from './app-context';

// Helper to format date as YYYY-MM-DD string, preserving the local date
const toYYYYMMDD = (date: Date) => {
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
};

export function useAppActions() {
    const { logout } = useSessionManager();
    const { queueOrSync } = useDataSyncer();
    const { setBlockingOperation, reloadData } = useAppContext();
    
    const performAdminAction = async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
        const session = await getSession();
        if (session?.role !== 'admin') {
            toast.error("Permission Denied", { description: "You do not have permission to perform this action." });
            return undefined;
        }
        try {
            return await action();
        } catch (e: any) {
            toast.error("Operation Failed", { description: e.message });
            throw e;
        }
    };

    const addCashTransaction = async (tx: Omit<CashTransaction, 'id' | 'createdAt' | 'deletedAt'>) => {
        return performAdminAction(async () => {
            const tempId = `temp_cash_${Date.now()}`;
            const newTxData: CashTransaction = { ...tx, id: tempId, createdAt: new Date().toISOString() };
            
            await db.cash_transactions.add(newTxData);

            if (tx.category === 'A/R Settlement' || tx.category === 'A/P Settlement') {
                const payload = {
                    payment_method: 'cash' as const, date: tx.date, amount: tx.actual_amount, category: tx.category,
                    description: tx.description, contact_id: tx.contact_id!,
                };
                queueOrSync({ action: 'recordDirectPayment', payload: { ...payload, localId: tempId } });
            } else {
                queueOrSync({ action: 'appendData', payload: { tableName: 'cash_transactions', data: tx, localId: tempId, logDescription: `Added cash transaction: ${tx.description}`, select: '*' } });
            }
        });
    };

    const addBankTransaction = async (tx: Omit<BankTransaction, 'id' | 'createdAt' | 'deletedAt'>) => {
        return performAdminAction(async () => {
            const tempId = `temp_bank_${Date.now()}`;
            const newTxData: BankTransaction = { ...tx, id: tempId, createdAt: new Date().toISOString() };
            
            await db.bank_transactions.add(newTxData);
            
            if (tx.category === 'A/R Settlement' || tx.category === 'A/P Settlement') {
                const payload = {
                    payment_method: 'bank' as const, bank_id: tx.bank_id, date: tx.date, amount: tx.actual_amount, category: tx.category,
                    description: tx.description, contact_id: tx.contact_id!,
                };
                queueOrSync({ action: 'recordDirectPayment', payload: { ...payload, localId: tempId } });
            } else {
                queueOrSync({ action: 'appendData', payload: { tableName: 'bank_transactions', data: tx, localId: tempId, logDescription: `Added bank transaction: ${tx.description}`, select: '*' } });
            }
        });
    };

    const addStockTransaction = async (tx: Omit<StockTransaction, 'id' | 'createdAt' | 'deletedAt'>) => {
        return performAdminAction(async () => {
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
                    contact_id: tx.contact_id,
                };

                if (tx.paymentMethod === 'cash') {
                    await db.cash_transactions.add({ ...financialTxData, type: tx.type === 'purchase' ? 'expense' : 'income' });
                } else {
                    await db.bank_transactions.add({ ...financialTxData, type: tx.type === 'purchase' ? 'withdrawal' : 'deposit', bank_id: tx.bank_id! });
                }
            } else if (tx.paymentMethod === 'credit') {
                const ledgerTempId = `temp_ledger_${Date.now()}`;
                const ledgerData: LedgerTransaction = {
                    id: ledgerTempId,
                    type: tx.type === 'purchase' ? 'payable' : 'receivable',
                    description: tx.description || `${tx.stockItemName} (${tx.weight}kg)`,
                    amount: tx.actual_amount, date: tx.date, contact_id: tx.contact_id!,
                    status: 'unpaid', paid_amount: 0, installments: []
                };
                await db.ap_ar_transactions.add(ledgerData);
            }
            
            queueOrSync({
                action: 'addStockTransaction',
                payload: { stockTx: tx, localId: stockTempId }
            });
        });
    };

    const addLedgerTransaction = async (tx: Omit<LedgerTransaction, 'id' | 'deletedAt' | 'status' | 'paid_amount' | 'installments'>) => {
        return performAdminAction(async () => {
            const tempId = `temp_ledger_${Date.now()}`;
            const dataToSave: LedgerTransaction = { ...tx, status: 'unpaid', paid_amount: 0, installments: [], id: tempId };
            await db.ap_ar_transactions.add(dataToSave);
            
            const { installments, id, ...syncData } = dataToSave;
            queueOrSync({ action: 'appendData', payload: { tableName: 'ap_ar_transactions', data: syncData, localId: tempId, logDescription: `Added A/P or A/R: ${tx.description}`, select: '*' } });
        });
    };
    
    const editCashTransaction = async (originalTx: CashTransaction, updatedTxData: Partial<Omit<CashTransaction, 'id' | 'date' | 'createdAt'>>) => {
        return performAdminAction(async () => {
            await db.cash_transactions.update(originalTx.id, updatedTxData);
            queueOrSync({ action: 'updateData', payload: { tableName: 'cash_transactions', id: originalTx.id, data: updatedTxData, logDescription: `Edited cash tx: ${originalTx.id}` }});
            toast.success("Cash transaction updated locally.");
        });
    };

    const editBankTransaction = async (originalTx: BankTransaction, updatedTxData: Partial<Omit<BankTransaction, 'id'| 'date' | 'createdAt'>>) => {
        return performAdminAction(async () => {
            await db.bank_transactions.update(originalTx.id, updatedTxData);
            queueOrSync({ action: 'updateData', payload: { tableName: 'bank_transactions', id: originalTx.id, data: updatedTxData, logDescription: `Edited bank tx: ${originalTx.id}` }});
            toast.success("Bank transaction updated locally.");
        });
    };

    const editStockTransaction = async (originalTx: StockTransaction, updatedTxData: Partial<Omit<StockTransaction, 'id' | 'date' | 'createdAt'>>) => {
        return performAdminAction(async () => {
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

            queueOrSync({ action: 'updateStockTransaction', payload: { stockTxId: originalTx.id, updates: finalUpdates } });
            toast.success("Stock transaction updated locally.");
        });
    };

    const deleteTransaction = useCallback(async (tableName: 'cash_transactions' | 'bank_transactions' | 'stock_transactions' | 'ap_ar_transactions', txToDelete: any) => {
        return performAdminAction(async () => {
            const isTemporary = txToDelete.id.startsWith('temp_');
            
            await db.table(tableName).delete(txToDelete.id);

            if (isTemporary) {
                const queueItemToDelete = await db.sync_queue.where('payload.localId').equals(txToDelete.id).first();
                if (queueItemToDelete && queueItemToDelete.id) {
                    await db.sync_queue.delete(queueItemToDelete.id);
                    toast.success("Unsynced transaction removed.");
                }
            } else {
                queueOrSync({ action: 'deleteData', payload: { tableName, id: txToDelete.id, logDescription: `Deleted item from ${tableName}` }});
                toast.success("Moved to recycle bin.");
            }
            
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
            
        });
    }, [queueOrSync]);
    
    const setFontSize = (size: 'sm' | 'base' | 'lg') => db.app_state.update(1, { fontSize: size });
    const setWastagePercentage = (percentage: number) => performAdminAction(() => db.app_state.update(1, { wastagePercentage: percentage }));
    const setCurrency = (currency: string) => db.app_state.update(1, { currency: currency });
    const setShowStockValue = (show: boolean) => db.app_state.update(1, { showStockValue: show });

    const addBank = async (name: string) => {
        return performAdminAction(async () => {
            const tempId = `temp_${Date.now()}`;
            await db.banks.add({ id: tempId, name, createdAt: new Date().toISOString() });
            queueOrSync({ action: 'appendData', payload: { tableName: 'banks', data: { name }, localId: tempId, select: '*' } });
        });
    };

    const addCategory = async (type: 'cash' | 'bank', name: string, direction: 'credit' | 'debit') => {
        return performAdminAction(async () => {
            const tempId = `temp_${Date.now()}`;
            await db.categories.add({ id: tempId, name, type, direction, is_deletable: true});
            queueOrSync({ action: 'appendData', payload: { tableName: 'categories', data: { name, type, direction, is_deletable: true }, localId: tempId, select: '*' } });
        });
    };

    const deleteCategory = async (id: string) => {
        return performAdminAction(async () => {
            await db.categories.delete(id);
            queueOrSync({ action: 'deleteCategory', payload: { id } });
        });
    };

    const transferFunds = async (from: 'cash' | 'bank', amount: number, date: string, bankId: string, description?: string) => {
        return performAdminAction(async () => {
            const fromDesc = `Transfer to ${from === 'cash' ? `Bank` : 'Cash'}: ${description || 'Funds Transfer'}`;
            const toDesc = `Transfer from ${from === 'cash' ? 'Cash' : `Bank`}: ${description || 'Funds Transfer'}`;
            const tempCashId = `temp_tf_cash_${Date.now()}`;
            const tempBankId = `temp_tf_bank_${Date.now()}`;

            if (from === 'cash') {
                await db.cash_transactions.add({ id: tempCashId, date, type: 'expense', category: 'Funds Transfer', description: fromDesc, actual_amount: amount, expected_amount: amount, difference: 0, createdAt: new Date().toISOString() });
                await db.bank_transactions.add({ id: tempBankId, date, type: 'deposit', category: 'Funds Transfer', description: toDesc, actual_amount: amount, expected_amount: amount, difference: 0, bank_id: bankId, createdAt: new Date().toISOString() });
            } else {
                await db.bank_transactions.add({ id: tempBankId, date, type: 'withdrawal', category: 'Funds Transfer', description: fromDesc, actual_amount: amount, expected_amount: amount, difference: 0, bank_id: bankId, createdAt: new Date().toISOString() });
                await db.cash_transactions.add({ id: tempCashId, date, type: 'income', category: 'Funds Transfer', description: toDesc, actual_amount: amount, expected_amount: amount, difference: 0, createdAt: new Date().toISOString() });
            }
            
            queueOrSync({ action: 'transferFunds', payload: { from, amount, date, bankId, description, localCashId: tempCashId, localBankId: tempBankId } });
            toast.success("Transfer recorded locally.");
        });
    };

    const setInitialBalances = async (cash: number, bankTotals: Record<string, number>, date: Date) => {
        return performAdminAction(async () => {
            const isoDate = toYYYYMMDD(date);
            const oldInitialCash = await db.cash_transactions.where('category').equals('Initial Balance').toArray();
            const oldInitialBank = await db.bank_transactions.where('category').equals('Initial Balance').toArray();
            await db.cash_transactions.bulkDelete(oldInitialCash.map(tx => tx.id));
            await db.bank_transactions.bulkDelete(oldInitialBank.map(tx => tx.id));

            await db.cash_transactions.add({ id: `temp_init_cash_${Date.now()}`, date: isoDate, type: 'income', category: 'Initial Balance', description: 'Initial cash balance', actual_amount: cash, expected_amount: cash, difference: 0, createdAt: new Date().toISOString() });
            for (const [bankId, amount] of Object.entries(bankTotals)) {
                await db.bank_transactions.add({ id: `temp_init_bank_${bankId}_${Date.now()}`, date: isoDate, type: 'deposit', category: 'Initial Balance', description: 'Initial bank balance', actual_amount: amount, expected_amount: amount, difference: 0, bank_id: bankId, createdAt: new Date().toISOString() });
            }
            
            queueOrSync({ action: 'setInitialBalances', payload: { cash, bankTotals, date: isoDate } });
        });
    };
    
    const addInitialStockItem = async (item: { name: string; weight: number; pricePerKg: number }) => {
      return performAdminAction(async () => {
        const newItem: StockItem = { ...item, id: `temp_init_stock_${Date.now()}`, purchasePricePerKg: item.pricePerKg };
        await db.initial_stock.add(newItem as any);
        queueOrSync({ action: 'addInitialStockItem', payload: { item } });
      });
    };
    
    const addContact = async (name: string, type: 'vendor' | 'client' | 'both'): Promise<Contact | undefined> => {
        const session = await getSession();
        if (session?.role !== 'admin') {
            toast.error("Permission Denied", { description: "You do not have permission to perform this action." });
            return undefined;
        }

        const tempId = `temp_contact_${Date.now()}`;
        const newContact: Contact = { id: tempId, name, type, createdAt: new Date().toISOString() };
        
        await db.contacts.add(newContact);
        queueOrSync({ action: 'appendData', payload: { tableName: 'contacts', data: { name, type }, localId: tempId, logDescription: `Added contact: ${name}`, select: '*' }});
        return newContact;
    };
  
    const deleteContact = async (id: string) => {
        return performAdminAction(async () => {
            await db.contacts.delete(id);
            queueOrSync({ action: 'deleteContact', payload: { id } });
        });
    };

    const recordPayment = async (contactId: string, paymentAmount: number, paymentMethod: 'cash' | 'bank', paymentDate: Date, ledgerType: 'payable' | 'receivable', bankId?: string) => {
        return performAdminAction(async () => {
            const tempFinancialId = `temp_payment_fin_${Date.now()}`;
            const contact = await db.contacts.get(contactId);
            if (!contact) {
                toast.error("Contact not found");
                return;
            }
            const desc = `Payment ${ledgerType === 'payable' ? 'to' : 'from'} ${contact.name}`;
            const category = ledgerType === 'payable' ? 'A/P Settlement' : 'A/R Settlement';
            const isoDate = toYYYYMMDD(paymentDate);

            if (paymentMethod === 'cash') {
                await db.cash_transactions.add({ id: tempFinancialId, date: isoDate, type: ledgerType === 'payable' ? 'expense' : 'income', category, description: desc, actual_amount: paymentAmount, expected_amount: paymentAmount, difference: 0, createdAt: new Date().toISOString(), contact_id: contactId });
            } else {
                await db.bank_transactions.add({ id: tempFinancialId, date: isoDate, type: ledgerType === 'payable' ? 'withdrawal' : 'deposit', category, description: desc, actual_amount: paymentAmount, expected_amount: paymentAmount, difference: 0, bank_id: bankId!, createdAt: new Date().toISOString(), contact_id: contactId });
            }

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
                
                const installment: LedgerPayment = {
                    id: `temp_inst_${Date.now()}`,
                    ap_ar_transaction_id: tx.id,
                    amount: paymentForThisTx,
                    date: isoDate,
                    payment_method: paymentMethod,
                    createdAt: new Date().toISOString(),
                };
                await db.ledger_payments.add(installment);
                
                amountToSettle -= paymentForThisTx;
            }

            queueOrSync({ 
                action: 'recordPaymentAgainstTotal', 
                payload: { contact_id: contactId, payment_amount: paymentAmount, payment_date: isoDate, payment_method: paymentMethod, ledger_type: ledgerType, bank_id: bankId, description: desc, localFinancialId: tempFinancialId }
            });
            toast.success("Payment recorded locally.");
        });
    };

    const recordAdvancePayment = async (payload: { contact_id: string, amount: number, date: Date, payment_method: 'cash' | 'bank', ledger_type: 'payable' | 'receivable', bank_id?: string, description?: string }) => {
        return performAdminAction(async () => {
            const { contact_id, amount, date, payment_method, ledger_type, bank_id, description } = payload;
            const isoDate = toYYYYMMDD(date);
            
            const contact = await db.contacts.get(contact_id);
            if (!contact) {
                toast.error("Contact not found");
                return;
            }

            const tempLedgerId = `temp_adv_ledger_${Date.now()}`;
            const tempFinancialId = `temp_adv_fin_${Date.now()}`;
            const ledgerDescription = description || `Advance ${ledger_type === 'payable' ? 'to' : 'from'} ${contact.name}`;

            const advanceLedgerEntry: LedgerTransaction = {
                id: tempLedgerId,
                date: isoDate,
                type: 'advance',
                description: ledgerDescription,
                amount: -amount,
                paid_amount: 0,
                status: 'paid',
                contact_id: contact_id,
                installments: []
            };
            await db.ap_ar_transactions.add(advanceLedgerEntry);

            const financialTxData = {
                id: tempFinancialId,
                date: isoDate,
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
            
            queueOrSync({
                action: 'recordAdvancePayment',
                payload: { ...payload, date: isoDate, localLedgerId: tempLedgerId, localFinancialId: tempFinancialId }
            });
            
            toast.success("Advance payment recorded locally and will sync to the server.");
        });
    };
    
    const restoreTransaction = useCallback(async (txType: 'cash' | 'bank' | 'stock' | 'ap_ar', id: string) => {
        return performAdminAction(async () => {
            let tableName: 'cash_transactions' | 'bank_transactions' | 'stock_transactions' | 'ap_ar_transactions' = 'cash_transactions';
            
            switch(txType) {
                case 'cash': tableName = 'cash_transactions'; break;
                case 'bank': tableName = 'bank_transactions'; break;
                case 'stock': tableName = 'stock_transactions'; break;
                case 'ap_ar': tableName = 'ap_ar_transactions'; break;
            }

            queueOrSync({ action: 'restoreData', payload: { tableName, id } });
            toast.success("Item restoration queued. Please refresh data later.");
        });
    }, [queueOrSync]);
    
    const emptyRecycleBin = useCallback(() => {
        return performAdminAction(async () => {
            queueOrSync({ action: 'emptyRecycleBin', payload: {} });
            toast.success("Recycle bin clearing queued. Please refresh data later.");
        });
    }, [queueOrSync]);

    const handleExport = async () => {
        return performAdminAction(async () => {
            const data = await server.exportAllData();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `shipshape_ledger_backup_${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            URL.revokeObjectURL(link.href);
            toast.success("Backup downloaded.");
        });
    };

    const handleImport = (file: File) => {
        return performAdminAction(() => {
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    setBlockingOperation({ isActive: true, message: "Importing data... Do not close the app."});
                    const data = JSON.parse(event.target?.result as string);
                    await server.batchImportData(data); // Directly call, don't queue
                    toast.info("Data import successful! Reloading data...");
                    await reloadData({ force: true });
                } catch (e: any) {
                    toast.error("Import failed", { description: e.message });
                } finally {
                    setBlockingOperation({ isActive: false, message: "" });
                }
            };
            reader.readAsText(file);
        });
    };

    const handleDeleteAllData = async () => {
        const session = await getSession();
        if (session?.role !== 'admin') {
            toast.error("Permission Denied", { description: "You do not have permission to perform this action." });
            return;
        }

        setBlockingOperation({ isActive: true, message: "Deleting all data... Please wait." });
        try {
            await server.deleteAllData();
            toast.success("All data has been deleted from the server.");
        } catch (error: any) {
            toast.error("Operation Failed", { description: error.message });
        } finally {
            // Logout will clear local data and reset the app state
            logout();
        }
    };
    
    const addLoan = async (loan: Omit<Loan, 'id' | 'status' | 'created_at' | 'payments'>, disbursement: { method: 'cash' | 'bank', bank_id?: string }) => {
        return performAdminAction(async () => {
            const tempId = `temp_loan_${Date.now()}`;
            const tempFinancialId = `temp_loan_fin_${Date.now()}`;
            const newLoan: Loan = { ...loan, id: tempId, status: 'active', created_at: new Date().toISOString(), payments: [] };
            
            await db.loans.add(newLoan);

            const financialTxData = {
                id: tempFinancialId,
                date: loan.issue_date,
                description: `Loan ${loan.type === 'payable' ? 'received from' : 'given to'} contact ID ${loan.contact_id}`,
                category: loan.type === 'payable' ? 'Loan In' : 'Loan Out',
                expected_amount: loan.principal_amount,
                actual_amount: loan.principal_amount,
                difference: 0,
                contact_id: loan.contact_id,
                linkedLoanId: tempId, // Link financial tx to loan
                createdAt: new Date().toISOString(),
            };

            if (disbursement.method === 'cash') {
                await db.cash_transactions.add({ ...financialTxData, type: loan.type === 'payable' ? 'income' : 'expense' });
            } else {
                await db.bank_transactions.add({ ...financialTxData, type: loan.type === 'payable' ? 'deposit' : 'withdrawal', bank_id: disbursement.bank_id! });
            }

            queueOrSync({ action: 'addLoan', payload: { loanData: loan, disbursement, localId: tempId, localFinancialId: tempFinancialId } });
            return newLoan;
        });
    };

    const recordLoanPayment = async (payload: { loan_id: string, amount: number, payment_date: string, payment_method: 'cash' | 'bank', bank_id?: string, notes?: string }) => {
        return performAdminAction(async () => {
            const { loan_id, amount, payment_date, payment_method, bank_id, notes } = payload;
            
            const loan = await db.loans.get(loan_id);
            if (!loan) throw new Error("Loan not found locally.");
            
            const tempPaymentId = `temp_loan_payment_${Date.now()}`;
            const tempFinancialId = `temp_loan_fin_${Date.now()}`;
            
            const newPayment: LoanPayment = {
                id: tempPaymentId,
                loan_id: loan_id,
                payment_date: payment_date,
                amount: amount,
                notes: notes,
                created_at: new Date().toISOString(),
                linked_transaction_id: tempFinancialId,
            };
            await db.loan_payments.add(newPayment);

            const financialTxData = {
                id: tempFinancialId,
                date: payment_date,
                description: `Payment for loan ${loan_id}`,
                category: 'Loan Payment',
                expected_amount: amount,
                actual_amount: amount,
                difference: 0,
                contact_id: loan.contact_id,
                linkedLoanId: loan_id,
                createdAt: new Date().toISOString(),
            };

            if (payment_method === 'cash') {
                await db.cash_transactions.add({ ...financialTxData, type: loan.type === 'payable' ? 'expense' : 'income' });
            } else {
                await db.bank_transactions.add({ ...financialTxData, type: loan.type === 'payable' ? 'withdrawal' : 'deposit', bank_id: bank_id! });
            }
            
            // Optimistically update loan status
            const payments = await db.loan_payments.where({ loan_id }).toArray();
            const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0) + amount;
            if (totalPaid >= loan.principal_amount) {
                await db.loans.update(loan_id, { status: 'paid' });
            }
            
            queueOrSync({ action: 'recordLoanPayment', payload: { ...payload, localPaymentId: tempPaymentId, localFinancialId: tempFinancialId } });
            toast.success("Loan payment recorded locally.");
        });
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
        addContact,
        deleteContact,
        recordPayment,
        recordAdvancePayment,
        restoreTransaction: (txType: 'cash' | 'bank' | 'stock' | 'ap_ar', id: string) => restoreTransaction(txType, id),
        emptyRecycleBin,
        handleExport,
        handleImport,
        handleDeleteAllData,
        addLoan,
        recordLoanPayment,
    };
}
