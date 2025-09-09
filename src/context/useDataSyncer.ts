
"use client";

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { db } from '@/lib/db';
import type { SyncQueueItem } from '@/lib/db';
import * as server from '@/lib/actions';
import { useSessionManager } from '@/app/context/useSessionManager';
import { useLiveQuery } from 'dexie-react-hooks';

export function useDataSyncer() {
    const { handleApiError, isOnline } = useSessionManager();
    const [isSyncing, setIsSyncing] = useState(false);
    const syncQueueCount = useLiveQuery(() => db.sync_queue.count(), [], 0);

    const processSyncQueue = useCallback(async (specificItemId?: number) => {
        if (isSyncing || !isOnline) return;
        
        let queue: SyncQueueItem[] = [];
        if (specificItemId) {
            const item = await db.sync_queue.get(specificItemId);
            if (item) queue.push(item);
        } else {
            queue = await db.sync_queue.orderBy('timestamp').toArray();
        }

        if (queue.length === 0) {
            return;
        }
        setIsSyncing(true);
        if (!specificItemId) toast.info(`Syncing ${queue.length} items...`);

        let failedItems = 0;
        for (const item of queue) {
            try {
                let result: any;
                
                const actionMap: { [key: string]: (payload: any) => Promise<any> } = {
                    appendData: server.appendData,
                    updateData: server.updateData,
                    deleteData: server.deleteData,
                    restoreData: server.restoreData,
                    recordPaymentAgainstTotal: server.recordPaymentAgainstTotal,
                    recordDirectPayment: server.recordDirectPayment,
                    recordAdvancePayment: server.recordAdvancePayment,
                    transferFunds: server.transferFunds,
                    setInitialBalances: server.setInitialBalances,
                    deleteCategory: server.deleteCategory,
                    addStockTransaction: server.addStockTransaction,
                    updateStockTransaction: server.updateStockTransaction,
                    deleteContact: server.deleteContact,
                    batchImportData: server.batchImportData,
                    deleteAllData: server.deleteAllData,
                    emptyRecycleBin: server.emptyRecycleBin,
                    addLoan: server.addLoan,
                    recordLoanPayment: server.recordLoanPayment,
                };

                const actionFn = actionMap[item.action];
                if (actionFn) {
                    // Pass the whole item.payload to server actions
                    result = await actionFn(item.payload);
                } else {
                     console.warn(`Unknown sync action: ${item.action}`);
                }
                
                await db.transaction('rw', db.tables, async () => {
                     if (item.action === 'appendData' && result?.id && item.payload.localId) {
                        const tableName = item.payload.tableName;
                        const oldRecord = await db.table(tableName).get(item.payload.localId);
                        if (oldRecord) {
                            await db.table(tableName).delete(item.payload.localId);
                            // Ensure the returned data is merged with any existing fields not returned from server
                            await db.table(tableName).add({ ...oldRecord, ...result });
                        }
                    } else if (item.action === 'addStockTransaction' && result?.stockTx && result?.stockTx.id && item.payload.localId) { // addStockTransaction
                        const oldStockTx = await db.stock_transactions.get(item.payload.localId);
                        if (oldStockTx) {
                           await db.stock_transactions.delete(item.payload.localId);
                           await db.stock_transactions.add({ ...oldStockTx, ...result.stockTx });
                        }

                        if (result.financialTx) {
                            const finTable = result.financialTx.bank_id ? 'bank_transactions' : 'cash_transactions';
                            const finLocalId = item.payload.stockTx.paymentMethod === 'bank' ? (await db.bank_transactions.where({linkedStockTxId: item.payload.localId}).first())?.id : (await db.cash_transactions.where({linkedStockTxId: item.payload.localId}).first())?.id;

                            if(finLocalId) await db.table(finTable).where({ id: finLocalId }).modify({ id: result.financialTx.id, linkedStockTxId: result.stockTx.id });
                        }
                    } else if (item.action === 'addLoan' && result?.loan && result?.loan.id && item.payload.localId) { // addLoan
                        await db.loans.update(item.payload.localId, { id: result.loan.id });
                         if(result.financialTx) {
                           const finTable = result.financialTx.bank_id ? 'bank_transactions' : 'cash_transactions';
                           if(item.payload.localFinancialId) await db.table(finTable).where({id: item.payload.localFinancialId}).modify({id: result.financialTx.id, linkedLoanId: result.loan.id});
                         }
                    } else if (item.action === 'recordLoanPayment' && result?.savedPayment && result?.savedPayment.id && item.payload.localPaymentId) { // recordLoanPayment
                        await db.loan_payments.update(item.payload.localPaymentId, { id: result.savedPayment.id });
                        if (result.financialTx && item.payload.localFinancialId) {
                            const finTable = result.financialTx.bank_id ? 'bank_transactions' : 'cash_transactions';
                            await db.table(finTable).update(item.payload.localFinancialId, { id: result.financialTx.id });
                        }
                    }

                    if (item.id) await db.sync_queue.delete(item.id);
                });

            } catch (error) {
                failedItems++;
                handleApiError(error);
                console.error(`Sync failed for item ${item.id} (${item.action}):`, error);
            }
        }
        
        setIsSyncing(false);
        if (!specificItemId) {
            if (failedItems > 0) {
                toast.error(`${failedItems} sync operations failed. Check console for details.`);
            } else {
                if (queue.length > 0) toast.success("All items synced successfully!");
            }
        }
    }, [isSyncing, handleApiError, isOnline]);

    const queueOrSync = useCallback(async (item: Omit<SyncQueueItem, 'timestamp' | 'id'>) => {
        const id = await db.sync_queue.add({ ...item, timestamp: Date.now() } as SyncQueueItem);
        if (isOnline) {
            processSyncQueue();
        } else {
            toast.info("You are offline. Change saved locally and will sync later.");
        }
    }, [isOnline, processSyncQueue]);

    return {
        isSyncing,
        syncQueueCount,
        processSyncQueue,
        queueOrSync,
    };
}
