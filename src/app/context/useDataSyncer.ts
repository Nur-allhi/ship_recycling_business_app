
"use client";

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { db } from '@/lib/db';
import type { SyncQueueItem } from '@/lib/db';
import * as server from '@/lib/actions';
import { useSessionManager } from './useSessionManager';
import { useLiveQuery } from 'dexie-react-hooks';

export function useDataSyncer() {
    const { handleApiError, isOnline } = useSessionManager();
    const [isSyncing, setIsSyncing] = useState(false);
    const syncQueueCount = useLiveQuery(() => db.sync_queue.count(), 0) || 0;

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
                const { localId, localFinancialId, localLedgerId, localCashId, localBankId, ...payloadWithoutId } = item.payload || {};
                
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
                    addInitialStockItem: server.addInitialStockItem,
                    deleteContact: server.deleteContact,
                    batchImportData: server.batchImportData,
                    deleteAllData: server.deleteAllData,
                    emptyRecycleBin: server.emptyRecycleBin,
                    addLoan: server.addLoan,
                    recordLoanPayment: server.recordLoanPayment,
                };

                const actionFn = actionMap[item.action];
                if (actionFn) {
                    result = await actionFn(payloadWithoutId);
                } else {
                     console.warn(`Unknown sync action: ${item.action}`);
                }

                // Post-sync local DB updates for ID reconciliation
                if (result && result.id && localId) {
                    const tableName = payloadWithoutId.tableName;
                    const oldRecord = await db.table(tableName).get(localId);
                    if (oldRecord) {
                        await db.table(tableName).delete(localId);
                        await db.table(tableName).add({ ...oldRecord, id: result.id });
                    }
                } else if (result && result.stockTx && result.stockTx.id && localId) { // For addStockTransaction
                    await db.stock_transactions.update(localId, { id: result.stockTx.id });
                    if (result.financialTx) {
                        const finTable = result.financialTx.bank_id ? 'bank_transactions' : 'cash_transactions';
                        await db.table(finTable).where({ linkedStockTxId: localId }).modify({ id: result.financialTx.id, linkedStockTxId: result.stockTx.id });
                    }
                }

                if (item.id) await db.sync_queue.delete(item.id);

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
            // No longer passing ID here to avoid complexity. The processQueue will pick it up.
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
