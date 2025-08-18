
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
}

export interface CashTransaction extends Transaction {
  type: 'income' | 'expense';
}

export interface Bank {
    id: string;
    name: string;
    createdAt: string;
}

export interface BankTransaction extends Transaction {
  type: 'deposit' | 'withdrawal';
  bank_id: string;
}

export interface StockItem {
  id: string;
  name: string;
  weight: number; // in kg
  purchasePricePerKg: number;
}

export interface StockTransaction {
  id: string;
  date: string;
  stockItemName: string;
  type: 'purchase' | 'sale';
  weight: number; // in kg
  pricePerKg: number;
  paymentMethod: 'cash' | 'bank' | 'credit';
  bank_id?: string | null;
  description?: string;
  lastEdited?: string;
  deletedAt?: string;
  createdAt: string;
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
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  createdAt: string;
}

export interface PaymentInstallment {
  id: string;
  ap_ar_transaction_id: string;
  amount: number;
  date: string;
  payment_method: 'cash' | 'bank';
  createdAt: string;
}

export interface LedgerTransaction {
  id: string;
  date: string;
  type: 'payable' | 'receivable'; // A/P or A/R
  description: string;
  amount: number;
  paid_amount: number;
  status: 'unpaid' | 'partially paid' | 'paid';
  contact_id: string;
  contact_name: string;
  deletedAt?: string;
  createdAt: string;
  installments: PaymentInstallment[];
}
    
export interface ActivityLog {
    id: string;
    created_at: string;
    user_id: string;
    username: string;
    description: string;
}
    

    