
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
  paymentMethod: 'cash' | 'bank';
  description?: string;
  lastEdited?: string;
  deletedAt?: string;
  createdAt: string;
  user_id?: string;
}

export interface Vendor {
    id: string;
    name: string;
    user_id?: string;
}

export interface CreditTransaction {
    id: string;
    date: string;
    description: string;
    amount: number;
    vendorId: string;
    status: 'paid' | 'unpaid';
    paidAt?: string;
    paymentMethod?: 'cash' | 'bank';
    linkedTxId?: string; // To link to the cash/bank tx when paid
    lastEdited?: string;
    deletedAt?: string;
    createdAt: string;
    user_id?: string;
}

export interface User {
    id: string;
    username: string;
    role: 'admin' | 'user';
    accessToken?: string; // JWT token
}
