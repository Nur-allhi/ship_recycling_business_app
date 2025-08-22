
import Dexie, { type EntityTable } from 'dexie';
import type { CashTransaction, BankTransaction, StockTransaction, StockItem, Category, Vendor, Client, LedgerTransaction, PaymentInstallment, Bank, MonthlySnapshot, User } from '@/lib/types';

interface AppState {
    id: number; // Singleton, always 1
    user: User | null;
    fontSize: 'sm' | 'base' | 'lg';
    wastagePercentage: number;
    currency: string;
    showStockValue: boolean;
    lastSync: string | null;
}

export interface SyncQueueItem {
    id?: number;
    action: 'appendData' | 'updateData' | 'deleteData' | 'restoreData' | 'recordPaymentAgainstTotal' | 'recordDirectPayment' | 'transferFunds' | 'setInitialBalances' | 'deleteCategory' | 'addStockTransaction' | 'addInitialStockItem' | 'batchImportData' | 'deleteAllData' | 'updateStockTransaction' | 'recordAdvancePayment';
    payload: any;
    timestamp: number;
}


export class AppDatabase extends Dexie {
    app_state!: EntityTable<AppState, 'id'>;
    cash_transactions!: EntityTable<CashTransaction, 'id'>;
    bank_transactions!: EntityTable<BankTransaction, 'id'>;
    stock_transactions!: EntityTable<StockTransaction, 'id'>;
    ap_ar_transactions!: EntityTable<LedgerTransaction, 'id'>;
    payment_installments!: EntityTable<PaymentInstallment, 'id'>;
    
    banks!: EntityTable<Bank, 'id'>;
    categories!: EntityTable<Category, 'id'>;
    vendors!: EntityTable<Vendor, 'id'>;
    clients!: EntityTable<Client, 'id'>;
    initial_stock!: EntityTable<StockItem, 'id'>;
    monthly_snapshots!: EntityTable<MonthlySnapshot, 'id'>;
    sync_queue!: EntityTable<SyncQueueItem, 'id'>;

    constructor() {
        super('ShipShapeLedgerDB');
        this.version(8).stores({
            app_state: 'id',
            cash_transactions: '++id, date, category, linkedStockTxId, advance_id',
            bank_transactions: '++id, date, bank_id, category, linkedStockTxId, advance_id',
            stock_transactions: '++id, date, stockItemName, type',
            ap_ar_transactions: '++id, date, type, contact_id, status',
            payment_installments: '++id, ap_ar_transaction_id, date',

            banks: '++id, name',
            categories: '++id, type, name',
            vendors: '++id, name',
            clients: '++id, name',
            initial_stock: '++id, name',
            monthly_snapshots: '++id, snapshot_date',
            sync_queue: '++id, timestamp',
        });
    }
}

export const db = new AppDatabase();

// Generic function to bulk add or update data into a table
export async function bulkPut(tableName: keyof AppDatabase, data: any[]) {
  if (!data || data.length === 0) return;
  try {
    await db.table(tableName).bulkPut(data);
  } catch (error) {
    console.error(`Failed to bulk put data into ${tableName}`, error);
  }
}

export async function clearAllData() {
    await Promise.all(db.tables.map(table => {
        if (table.name !== 'app_state') { // Keep app_state
            return table.clear();
        }
    }));
}
