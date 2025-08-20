
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
    action: 'appendData' | 'updateData' | 'deleteData' | 'restoreData' | 'recordPaymentAgainstTotal' | 'recordDirectPayment' | 'transferFunds' | 'setInitialBalances';
    payload: any;
    timestamp: number;
}


export class AppDatabase extends Dexie {
    appState!: EntityTable<AppState, 'id'>;
    cashTransactions!: EntityTable<CashTransaction, 'id'>;
    bankTransactions!: EntityTable<BankTransaction, 'id'>;
    stockTransactions!: EntityTable<StockTransaction, 'id'>;
    ledgerTransactions!: EntityTable<LedgerTransaction, 'id'>;
    paymentInstallments!: EntityTable<PaymentInstallment, 'id'>;
    
    banks!: EntityTable<Bank, 'id'>;
    categories!: EntityTable<Category, 'id'>;
    vendors!: EntityTable<Vendor, 'id'>;
    clients!: EntityTable<Client, 'id'>;
    initialStock!: EntityTable<StockItem, 'id'>;
    monthlySnapshots!: EntityTable<MonthlySnapshot, 'id'>;
    syncQueue!: EntityTable<SyncQueueItem, 'id'>;

    constructor() {
        super('ShipShapeLedgerDB');
        this.version(3).stores({
            appState: 'id',
            cashTransactions: '++id, date, category',
            bankTransactions: '++id, date, bank_id, category',
            stockTransactions: '++id, date, stockItemName, type',
            ledgerTransactions: '++id, date, type, contact_id',
            paymentInstallments: '++id, ap_ar_transaction_id, date',

            banks: '++id, name',
            categories: '++id, type, name',
            vendors: '++id, name',
            clients: '++id, name',
            initialStock: '++id, name',
            monthlySnapshots: '++id, snapshot_date',
            syncQueue: '++id, timestamp',
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
    await Promise.all(db.tables.map(table => table.clear()));
}
