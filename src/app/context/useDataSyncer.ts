
"use client";

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { db } from '@/lib/db';
import type { SyncQueueItem } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import * as server from '@/lib/actions';
import { useSessionManager } from './useSessionManager';

export function useDataSyncer() {
    const { handleApiError, isOnline } = useSessionManager();
    const [isSyncing, setIsSyncing] = useState(false);
    const syncQueueCount = useLiveQuery(() => db.sync_queue.count(), []) ?? 0;

    const processSyncQueue = useCallback(async (specificItemId?: number) => {
        if (isSyncing && !specificItemId) return;
        setIsSyncing(true);

        let queue: SyncQueueItem[] = [];
        if (specificItemId) {
            const item = await db.sync_queue.get(specificItemId);
            if (item) queue.push(item);
        } else {
            queue = await db.sync_queue.orderBy('timestamp').toArray();
        }

        if (queue.length === 0) {
            setIsSyncing(false);
            return;
        }

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
                    deleteContact: (id: string) => server.deleteContact(id),
                    batchImportData: (data: any) => server.batchImportData(data),
                    deleteAllData: server.deleteAllData,
                    emptyRecycleBin: server.emptyRecycleBin,
                    // Add new loan actions here
                };

                const actionFn = actionMap[item.action];
                if (actionFn) {
                    result = await actionFn(payloadWithoutId);
                } else {
                     console.warn(`Unknown sync action: ${item.action}`);
                }

                // Post-sync local DB updates
                if (result) {
                    switch (item.action) {
                        case 'appendData':
                            if (result && result.id && localId) {
                                await db.table(payloadWithoutId.tableName).where({ id: localId }).modify({ id: result.id });
                            }
                            break;
                        case 'recordPaymentAgainstTotal':
                             if (result && result.financialTxId && localFinancialId) {
                                if (payloadWithoutId.payment_method === 'cash') {
                                    await db.cash_transactions.where({ id: localFinancialId }).modify({ id: result.financialTxId });
                                } else {
                                    await db.bank_transactions.where({ id: localFinancialId }).modify({ id: result.financialTxId });
                                }
                            }
                            break;
                        case 'recordAdvancePayment':
                            if (result && result.ledgerEntry && result.financialTx) {
                                await db.transaction('rw', db.ap_ar_transactions, db.cash_transactions, db.bank_transactions, async () => {
                                    if (localLedgerId) await db.ap_ar_transactions.where({ id: localLedgerId }).modify({ id: result.ledgerEntry.id });
                                    if (result.financialTx.bank_id) {
                                        if (localFinancialId) await db.bank_transactions.where({ id: localFinancialId }).modify({ id: result.financialTx.id, advance_id: result.ledgerEntry.id });
                                    } else {
                                        if (localFinancialId) await db.cash_transactions.where({ id: localFinancialId }).modify({ id: result.financialTx.id, advance_id: result.ledgerEntry.id });
                                    }
                                });
                            }
                            break;
                        case 'transferFunds':
                             if (result && localCashId && localBankId) {
                                await db.cash_transactions.where({ id: localCashId }).modify({ id: result.cashTxId });
                                await db.bank_transactions.where({ id: localBankId }).modify({ id: result.bankTxId });
                            }
                            break;
                        case 'addStockTransaction':
                             if (result && localId) {
                                await db.stock_transactions.where({ id: localId }).modify({ id: result.stockTx.id });
                                if (result.financialTx) {
                                    const finTable = result.financialTx.bank_id ? 'bank_transactions' : 'cash_transactions';
                                    await db.table(finTable).where({ linkedStockTxId: localId }).modify({ id: result.financialTx.id, linkedStockTxId: result.stockTx.id });
                                }
                            }
                            break;
                    }
                }

                if (item.id) await db.sync_queue.delete(item.id);

            } catch (error) {
                failedItems++;
                handleApiError(error);
                console.error(`Sync failed for item ${item.id} (${item.action}):`, error);
            }
        }

        if (!specificItemId) {
            if (failedItems > 0) {
                toast.error(`${failedItems} sync operations failed. Check console for details.`);
            } else {
                if (queue.length > 0) toast.success("All items synced successfully!");
            }
        }

        setIsSyncing(false);
    }, [isSyncing, handleApiError]);

    const queueOrSync = useCallback(async (item: Omit<SyncQueueItem, 'timestamp' | 'id'>) => {
        const id = await db.sync_queue.add({ ...item, timestamp: Date.now() });
        if (isOnline) {
            processSyncQueue(id); 
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

    