
import Dexie, { type EntityTable } from 'dexie';
import type { CashTransaction, BankTransaction, StockTransaction, StockItem, Category, Contact, LedgerTransaction, LedgerPayment, Bank, MonthlySnapshot, User, Loan, LoanPayment } from '@/lib/types';

interface AppState {
    id: number; // Singleton, always 1
    user: User | null;
    fontSize: 'sm' | 'base' | 'lg';
    showStockValue: boolean;
    currency: string;
    lastSync: string | null;
}

export interface SyncQueueItem {
    id?: number;
    action: 'appendData' | 'updateData' | 'deleteData' | 'restoreData' | 'recordPaymentAgainstTotal' | 'recordDirectPayment' | 'transferFunds' | 'setInitialBalances' | 'deleteCategory' | 'addStockTransaction' | 'addInitialStockItem' | 'batchImportData' | 'deleteAllData' | 'updateStockTransaction' | 'recordAdvancePayment' | 'deleteContact' | 'emptyRecycleBin' | 'addLoan' | 'recordLoanPayment';
    payload: any;
    timestamp: number;
}


export class AppDatabase extends Dexie {
    app_state!: EntityTable<AppState, 'id'>;
    cash_transactions!: EntityTable<CashTransaction, 'id'>;
    bank_transactions!: EntityTable<BankTransaction, 'id'>;
    stock_transactions!: EntityTable<StockTransaction, 'id'>;
    ap_ar_transactions!: EntityTable<LedgerTransaction, 'id'>;
    ledger_payments!: EntityTable<LedgerPayment, 'id'>;
    
    banks!: EntityTable<Bank, 'id'>;
    categories!: EntityTable<Category, 'id'>;
    contacts!: EntityTable<Contact, 'id'>;
    initial_stock!: EntityTable<StockItem, 'id'>;
    monthly_snapshots!: EntityTable<MonthlySnapshot, 'id'>;
    loans!: EntityTable<Loan, 'id'>;
    loan_payments!: EntityTable<LoanPayment, 'id'>;
    sync_queue!: EntityTable<SyncQueueItem, 'id'>;

    constructor() {
        // Renaming the database to force a fresh start and bypass the upgrade error.
        super('ShipShapeLedgerDB_v2');
        this.version(1).stores({
            app_state: 'id',
            cash_transactions: '++id, date, category, linkedStockTxId, linkedLoanId, advance_id, contact_id',
            bank_transactions: '++id, date, bank_id, category, linkedStockTxId, linkedLoanId, advance_id, contact_id',
            stock_transactions: '++id, date, stockItemName, type, contact_id',
            ap_ar_transactions: '++id, date, type, contact_id, status',
            ledger_payments: '++id, ap_ar_transaction_id, date',

            banks: 'id, name',
            categories: 'id, type, name',
            contacts: 'id, name, type',
            initial_stock: '++id, name',
            monthly_snapshots: '++id, snapshot_date',
            loans: '++id, contact_id, type, status',
            loan_payments: '++id, loan_id, payment_date',
            sync_queue: '++id, timestamp', // Correctly defining the index without changing primary key
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

export async function clearAllData(clearAppState = true) {
    await Promise.all(db.tables.map(table => {
        if (!clearAppState && table.name === 'app_state') {
             return;
        }
        return table.clear();
    }));
}
