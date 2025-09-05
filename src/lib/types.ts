
export interface Transaction {
  id: string;
  date: string;
  description: string;
  expected_amount: number;
  actual_amount: number;
  difference: number;
  difference_reason?: string;
  category: string;
  lastEdited?: string;
  deletedAt?: string;
  linkedStockTxId?: string;
  createdAt: string;
  advance_id?: string | null;
  contact_id?: string | null;
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
  pricePerKg: number; // This becomes the expected price
  paymentMethod: 'cash' | 'bank' | 'credit';
  bank_id?: string | null;
  description?: string;
  lastEdited?: string;
  deletedAt?: string;
  createdAt: string;
  // New fields for payment discrepancies
  expected_amount: number;
  actual_amount: number;
  difference: number;
  difference_reason?: string;
  contact_id?: string;
  contact_name?: string;
}

export interface User {
    id: string;
    username: string;
    role: 'admin' | 'user';
    accessToken?: string; // JWT token
}

export interface Contact {
  id: string;
  name: string;
  type: 'vendor' | 'client' | 'both';
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
  type: 'payable' | 'receivable' | 'advance';
  description: string;
  amount: number;
  paid_amount: number;
  status: 'unpaid' | 'partially paid' | 'paid';
  contact_id: string;
  contact_name: string;
  deletedAt?: string;
  installments: PaymentInstallment[];
}
    
export interface ActivityLog {
    id: string;
    created_at: string;
    user_id: string;
    username: string;
    description: string;
}

export interface Category {
    id: string;
    name: string;
    type: 'cash' | 'bank';
    direction: 'credit' | 'debit' | null;
    is_deletable: boolean;
}

export interface MonthlySnapshot {
    id: string;
    // user_id removed for shared app model
    snapshot_date: string;
    cash_balance: number;
    bank_balances: Record<string, number>;
    stock_items: Record<string, { weight: number, value: number }>;
    total_receivables: number;
    total_payables: number;
    created_at: string;
}

// New Types for Loans Module
export interface Loan {
  id: string;
  contact_id: string;
  type: 'payable' | 'receivable'; // 'payable' (we borrowed), 'receivable' (we lent)
  principal_amount: number;
  interest_rate: number;
  issue_date: string;
  due_date?: string;
  status: 'active' | 'paid' | 'defaulted';
  created_at: string;
}

export interface LoanPayment {
  id: string;
  loan_id: string;
  payment_date: string;
  amount: number;
  linked_transaction_id?: string; // Can be linked to a cash or bank transaction
  notes?: string;
  created_at: string;
}
    

    



    




