
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { startOfMonth, endOfMonth } from 'date-fns';
import { toLocalDateString } from './utils';
import type { CashTransaction, BankTransaction, StockTransaction, LedgerTransaction } from './types';

type Transaction = CashTransaction | BankTransaction | StockTransaction | LedgerTransaction;
type SortKey = keyof Transaction | 'debit' | 'credit' | null;
type SortDirection = 'asc' | 'desc';

type TransactionTable = 'cash_transactions' | 'bank_transactions' | 'stock_transactions' | 'ap_ar_transactions';

interface UseSortedTransactionsOptions {
  month: Date;
  sortKey: SortKey;
  sortDirection: SortDirection;
  filter?: (tx: any) => boolean;
}

/**
 * Calculate running balances for transactions using chronological order
 * This ensures proper balance calculation regardless of display sorting
 */
export function calculateRunningBalances<T extends CashTransaction | BankTransaction>(
  transactions: T[],
  openingBalance: number
): Array<T & { balance: number }> {
  let currentBalance = openingBalance;
  
  // Add debugging to show transaction order and opening balance
  if (process.env.NODE_ENV === 'development') {
    console.log(`[calculateRunningBalances] Starting calculation with opening balance: ${openingBalance}`);
    console.log(`[calculateRunningBalances] Transaction order (first 5):`, transactions.slice(0, 5).map(tx => ({
      id: tx.id.substring(0, 8),
      date: tx.date,
      type: tx.type,
      amount: tx.actual_amount,
      created_at: tx.created_at
    })));
  }
  
  return transactions.map((tx, index) => {
    // Ensure we're working with the actual_amount
    const amount = tx.actual_amount || 0;
    
    if ('type' in tx) {
      if (tx.type === 'income' || tx.type === 'deposit') {
        currentBalance += amount;
      } else if (tx.type === 'expense' || tx.type === 'withdrawal') {
        currentBalance -= amount;
      }
    }
    
    // Add debugging information in development
    if (process.env.NODE_ENV === 'development' && currentBalance < 0 && index < 5) {
      console.warn(`Negative balance detected: ${currentBalance} after transaction ${tx.id} (${tx.type}: ${amount})`);
    }
    
    return { ...tx, balance: currentBalance };
  });
}

export function useSortedTransactions(tableName: TransactionTable, options: UseSortedTransactionsOptions) {
  const { month, sortKey, sortDirection, filter } = options;

  const transactions = useLiveQuery(() => {
    // Use local date strings to avoid timezone issues
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    
    // Create date strings without timezone conversion to avoid date shifting
    const startDate = toLocalDateString(start);
    const endDate = toLocalDateString(end);

    // Debug logging to help troubleshoot date filtering issues
    if (process.env.NODE_ENV === 'development') {
      console.log(`[useSortedTransactions] Filtering ${tableName} for month:`, {
        month: month.toISOString(),
        startDate,
        endDate,
        monthName: month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      });
    }

    // Since transaction dates can be stored as ISO strings or simple dates,
    // we need to filter based on the date portion only
    let query = db.table(tableName).filter((tx: any) => {
      // Extract date portion from transaction date (handles both 'YYYY-MM-DD' and 'YYYY-MM-DDTHH:mm:ss' formats)
      const txDateStr = tx.date.split('T')[0];
      return txDateStr >= startDate && txDateStr <= endDate;
    });

    if (filter) {
      query = query.filter(filter);
    }
    
    // Return the promise for useLiveQuery
    return query.toArray().then(results => {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[useSortedTransactions] Found ${results.length} transactions in ${tableName} for ${month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`);
        if (results.length === 0) {
          // Check if there are any transactions at all in the table
          return db.table(tableName).count().then(totalCount => {
            console.log(`[useSortedTransactions] Total transactions in ${tableName}:`, totalCount);
            if (totalCount > 0) {
              // Show a sample of dates to help debug
              return db.table(tableName).limit(5).toArray().then(sample => {
                console.log(`[useSortedTransactions] Sample dates in ${tableName}:`, sample.map(tx => tx.date));
                return results;
              });
            }
            return results;
          });
        }
      }
      return results;
    });
  }, [tableName, month, filter]);

  if (!transactions) {
    return { isLoading: true, transactions: [] };
  }

  // For balance calculation, always use chronological order (date ASC, created_at ASC)
  const chronologicalSorted = [...transactions].sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    if (dateA !== dateB) {
      return dateA - dateB; // Always ascending for balance calculation
    }
    
    // Handle missing created_at timestamps
    const created_atA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const created_atB = b.created_at ? new Date(b.created_at).getTime() : 0;
    
    // If both have created_at, sort by created_at
    if (created_atA !== 0 && created_atB !== 0 && created_atA !== created_atB) {
      return created_atA - created_atB;
    }
    
    // For same-day transactions without created_at, prioritize income over expense
    // to prevent negative balance issues when starting from 0 opening balance
    if (!a.created_at && !b.created_at && 'type' in a && 'type' in b) {
      const aIsIncome = a.type === 'income' || a.type === 'deposit';
      const bIsIncome = b.type === 'income' || b.type === 'deposit';
      
      if (aIsIncome && !bIsIncome) return -1; // Income before expense
      if (!aIsIncome && bIsIncome) return 1;  // Expense after income
    }
    
    // Final tiebreaker by ID
    return a.id.localeCompare(b.id);
  });

  // Debug: Show transaction order after sorting
  if (process.env.NODE_ENV === 'development' && transactions.length > 0) {
    console.log(`[useSortedTransactions] Chronological order for ${tableName}:`, chronologicalSorted.map(tx => ({
      id: tx.id.substring(0, 8),
      date: tx.date.split('T')[0],
      type: tx.type,
      amount: tx.actual_amount,
      created_at: tx.created_at?.split('T')[0] || 'no-created_at'
    })));
  }

  // For display purposes, apply user-selected sorting while preserving same-date order
  const displaySorted = [...chronologicalSorted].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    if (sortKey === 'debit') {
      // Handle debit column for both cash and bank transactions
      if ('type' in a && 'type' in b) {
        aValue = (a.type === 'expense' || a.type === 'withdrawal') ? a.actual_amount : 0;
        bValue = (b.type === 'expense' || b.type === 'withdrawal') ? b.actual_amount : 0;
      }
    } else if (sortKey === 'credit') {
      // Handle credit column for both cash and bank transactions
      if ('type' in a && 'type' in b) {
        aValue = (a.type === 'income' || a.type === 'deposit') ? a.actual_amount : 0;
        bValue = (b.type === 'income' || b.type === 'deposit') ? b.actual_amount : 0;
      }
    } else if (sortKey === 'date') {
      // For date sorting, maintain chronological order for same dates
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) {
        return sortDirection === 'desc' ? dateB - dateA : dateA - dateB;
      }
      // Secondary sort by created_at to maintain entry order for same dates
      const created_atResult = sortDirection === 'desc' 
        ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        : new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (created_atResult !== 0) {
        return created_atResult;
      }
      // Tertiary sort by ID as final tiebreaker
      return sortDirection === 'desc' ? b.id.localeCompare(a.id) : a.id.localeCompare(b.id);
    } else if (sortKey && sortKey in a && sortKey in b) {
      aValue = a[sortKey as keyof Transaction];
      bValue = b[sortKey as keyof Transaction];
    } else {
      return 0;
    }

    // Apply sorting comparison
    let result = 0;
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      result = aValue.localeCompare(bValue);
    } else if (typeof aValue === 'number' && typeof bValue === 'number') {
      result = aValue - bValue;
    }

    return sortDirection === 'desc' ? -result : result;
  });

  return { 
    isLoading: false, 
    transactions: displaySorted,
    chronologicalTransactions: chronologicalSorted // For balance calculations
  };
}
