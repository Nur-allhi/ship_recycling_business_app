import { db, type SyncQueueItem } from '@/lib/db';
import * as server from '@/lib/actions';

export interface SyncOperation {
  action: string;
  payload: any;
}

export interface ConflictResolution {
  resolution: 'use_server' | 'use_local' | 'merge';
  mergedData?: any;
}

/**
 * Sync Service for offline-first data synchronization
 * Handles queue management, batch operations, and conflict resolution
 */
export class SyncService {
  private static instance: SyncService;
  
  public static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  /**
   * Enqueue a sync operation to be processed when online
   */
  async enqueue(operation: string, payload: any): Promise<void> {
    try {
      await db.sync_queue.add({
        action: operation as any, // Cast to any since we're using dynamic operations
        payload: payload,
        timestamp: Date.now(), // Use number timestamp
      });
    } catch (error) {
      console.error('Failed to enqueue sync operation:', error);
      throw error;
    }
  }

  /**
   * Process all items in the sync queue
   */
  async flushQueue(specificItemId?: number): Promise<{ success: number; failed: number }> {
    let queue: SyncQueueItem[] = [];
    
    if (specificItemId) {
      const item = await db.sync_queue.get(specificItemId);
      if (item) queue.push(item);
    } else {
      queue = await db.sync_queue.orderBy('timestamp').toArray();
    }

    if (queue.length === 0) {
      return { success: 0, failed: 0 };
    }

    let successCount = 0;
    let failedCount = 0;

    for (const item of queue) {
      try {
        const success = await this.processQueueItem(item);
        if (success) {
          successCount++;
          if (item.id) await db.sync_queue.delete(item.id);
        } else {
          failedCount++;
        }
      } catch (error) {
        failedCount++;
        console.error(`Sync failed for item ${item.id} (${item.action}):`, error);
        
        // Increment retry count - we'll track this in a separate way since retries isn't in the schema
        console.log(`Retry #${(item as any).retryCount || 1} for item ${item.id} (${item.action})`);
      }
    }

    return { success: successCount, failed: failedCount };
  }

  /**
   * Process a single queue item
   */
  private async processQueueItem(item: SyncQueueItem): Promise<boolean> {
    const { localId, localFinancialId, localLedgerId, localCashId, localBankId, ...payloadWithoutId } = item.payload || {};

    try {
      let result: any;

      switch (item.action) {
        case 'appendData':
          result = await server.appendData(payloadWithoutId);
          if (result && result.id && localId) {
            await db.table(payloadWithoutId.tableName).where({ id: localId }).modify({ id: result.id });
          }
          break;

        case 'updateData': 
          result = await server.updateData(item.payload); 
          break;

        case 'deleteData': 
          result = await server.deleteData(item.payload); 
          break;

        case 'restoreData': 
          result = await server.restoreData(item.payload); 
          break;

        case 'recordPaymentAgainstTotal':
          result = await server.recordPaymentAgainstTotal(payloadWithoutId);
          if (result && result.financialTxId && localFinancialId) {
            if (payloadWithoutId.payment_method === 'cash') {
              await db.cash_transactions.where({ id: localFinancialId }).modify({ id: result.financialTxId });
            } else {
              await db.bank_transactions.where({ id: localFinancialId }).modify({ id: result.financialTxId });
            }
          }
          break;

        case 'recordDirectPayment': 
          result = await server.recordDirectPayment(item.payload); 
          break;

        case 'recordAdvancePayment':
          result = await server.recordAdvancePayment(payloadWithoutId);
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
          result = await server.transferFunds(payloadWithoutId);
          if (result && localCashId && localBankId) {
            await db.cash_transactions.where({ id: localCashId }).modify({ id: result.cashTxId });
            await db.bank_transactions.where({ id: localBankId }).modify({ id: result.bankTxId });
          }
          break;

        case 'setInitialBalances': 
          result = await server.setInitialBalances(item.payload); 
          break;

        case 'deleteCategory': 
          result = await server.deleteCategory(item.payload); 
          break;

        case 'addStockTransaction':
          result = await server.addStockTransaction(payloadWithoutId);
          if (result && localId) {
            await db.stock_transactions.where({ id: localId }).modify({ id: result.stockTx.id });
            if (result.financialTx) {
              const finTable = result.financialTx.bank_id ? 'bank_transactions' : 'cash_transactions';
              await db.table(finTable).where({ linkedStockTxId: localId }).modify({ id: result.financialTx.id, linkedStockTxId: result.stockTx.id });
            }
          }
          break;

        case 'updateStockTransaction': 
          result = await server.updateStockTransaction(item.payload); 
          break;

        case 'deleteVendor': 
          result = await server.deleteVendor(item.payload.id); 
          break;

        case 'deleteClient': 
          result = await server.deleteClient(item.payload.id); 
          break;

        case 'addInitialStockItem': 
          result = await server.addInitialStockItem(item.payload); 
          break;

        case 'batchImportData': 
          result = await server.batchImportData(item.payload.data); 
          break;

        case 'deleteAllData': 
          result = await server.deleteAllData(); 
          break;

        case 'emptyRecycleBin': 
          result = await server.emptyRecycleBin(); 
          break;

        default:
          console.warn(`Unknown sync action: ${item.action}`);
          return false;
      }

      return true;
    } catch (error) {
      console.error(`Failed to process queue item: ${item.action}`, error);
      return false;
    }
  }

  /**
   * Resolve conflicts between server and local data
   */
  async resolveConflict(serverRow: any, localRow: any, strategy: ConflictResolution): Promise<any> {
    switch (strategy.resolution) {
      case 'use_server':
        return serverRow;
        
      case 'use_local':
        return localRow;
        
      case 'merge':
        if (strategy.mergedData) {
          return strategy.mergedData;
        }
        // Default merge strategy: prefer local for user data, server for system data
        return {
          ...serverRow,
          ...localRow,
          // Keep server metadata
          id: serverRow.id,
          created_at: serverRow.created_at,
          updated_at: serverRow.updated_at || new Date().toISOString(),
          // Use local data timestamp for conflict resolution
          last_modified: localRow.last_modified || new Date().toISOString()
        };
        
      default:
        throw new Error(`Unknown conflict resolution strategy: ${strategy.resolution}`);
    }
  }

  /**
   * Get the current sync queue status
   */
  async getQueueStatus(): Promise<{ count: number; items: SyncQueueItem[] }> {
    const items = await db.sync_queue.orderBy('timestamp').toArray();
    return {
      count: items.length,
      items
    };
  }

  /**
   * Clear failed items from sync queue (items with high retry count)
   * Note: Since retries field doesn't exist in schema, this is a placeholder
   */
  async clearFailedItems(maxRetries: number = 3): Promise<number> {
    // For now, we'll just return 0 since we can't track retries in the current schema
    console.log(`clearFailedItems called with maxRetries=${maxRetries}, but retries tracking not implemented in schema`);
    return 0;
  }

  /**
   * Retry specific failed items
   * Note: Since retries field doesn't exist in schema, this is a placeholder
   */
  async retryFailedItems(itemIds: number[]): Promise<void> {
    console.log(`retryFailedItems called for items: ${itemIds.join(', ')}, but retries tracking not implemented in schema`);
    // Items will be retried on next sync automatically
  }
}

// Export singleton instance
export const syncService = SyncService.getInstance();