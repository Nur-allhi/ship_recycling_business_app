
export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  lastEdited?: string;
  deletedAt?: string;
  linkedStockTxId?: string;
  createdAt: string;
  user_id?: string;
}

export interface CashTransaction extends Transaction {
  type: 'income' | 'expense';
}

export interface BankTransaction extends Transaction {
  type: 'deposit' | 'withdrawal';
}

export interface StockItem {
  id: string;
  name: string;
  weight: number; // in kg
  purchasePricePerKg: number;
  user_id?: string;
}

export interface StockTransaction {
  id: string;
  date: string;
  stockItemName: string;
  type: 'purchase' | 'sale';
  weight: number; // in kg
  pricePerKg: number;
  paymentMethod: 'cash' | 'bank' | 'credit';
  description?: string;
  lastEdited?: string;
  deletedAt?: string;
  createdAt: string;
  user_id?: string;
  // Fields for credit transactions
  contactId?: string;
  contactName?: string;
}

export interface User {
    id: string;
    username: string;
    role: 'admin' | 'user';
    accessToken?: string; // JWT token
}

export interface Vendor {
  id: string;
  name: string;
  user_id?: string;
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  user_id?: string;
  createdAt: string;
}

export interface LedgerTransaction {
  id: string;
  date: string;
  type: 'payable' | 'receivable'; // A/P or A/R
  contactId: string; // Links to Vendor or Client ID
  contactName: string;
  description: string;
  amount: number;
  status: 'unpaid' | 'paid';
  dueDate?: string;
  paidDate?: string;
  paidFrom?: 'cash' | 'bank';
  deletedAt?: string;
  createdAt: string;
  user_id?: string;
  linkedStockTxId?: string; // Link to the stock transaction if it exists
}
