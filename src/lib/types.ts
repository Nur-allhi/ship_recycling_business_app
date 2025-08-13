export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
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
}

export interface StockTransaction {
  id: string;
  date: string;
  stockItemName: string;
  type: 'purchase' | 'sale';
  weight: number; // in kg
  pricePerKg: number;
  paymentMethod: 'cash' | 'bank';
}
