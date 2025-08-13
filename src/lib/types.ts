
export interface Transaction {
  id: string;
  rowIndex: number; // The row number in the Google Sheet (1-based index)
  date: string;
  description: string;
  amount: number;
  category: string;
  lastEdited?: string;
  deletedAt?: string;
}

export interface CashTransaction extends Transaction {
  type: 'income' | 'expense';
}

export interface BankTransaction extends Transaction {
  type: 'deposit' | 'withdrawal';
}

export interface StockItem {
  id: string;
  rowIndex: number;
  name: string;
  weight: number; // in kg
  purchasePricePerKg: number;
}

export interface StockTransaction {
  id: string;
  rowIndex: number;
  date: string;
  stockItemName: string;
  type: 'purchase' | 'sale';
  weight: number; // in kg
  pricePerKg: number;
  paymentMethod: 'cash' | 'bank';
  description?: string;
  lastEdited?: string;
  deletedAt?: string;
}
