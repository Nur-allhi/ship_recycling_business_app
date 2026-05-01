import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  role: text('role', { enum: ['admin', 'user'] }).notNull().default('user'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const banks = sqliteTable('banks', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  type: text('type', { enum: ['cash', 'bank'] }).notNull(),
  direction: text('direction', { enum: ['credit', 'debit'] }),
  isDeletable: integer('is_deletable', { mode: 'boolean' }).default(true),
});

export const contacts = sqliteTable('contacts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  type: text('type', { enum: ['vendor', 'client', 'both'] }).notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const initialStock = sqliteTable('initial_stock', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  weight: real('weight').notNull(),
  purchasePricePerKg: real('purchase_price_per_kg').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const cashTransactions = sqliteTable('cash_transactions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  date: text('date').notNull(),
  type: text('type', { enum: ['income', 'expense'] }).notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(),
  expectedAmount: real('expected_amount').notNull(),
  actualAmount: real('actual_amount').notNull(),
  difference: real('difference').notNull(),
  differenceReason: text('difference_reason'),
  contactId: text('contact_id').references(() => contacts.id),
  linkedStockTxId: text('linked_stock_tx_id'),
  linkedLoanId: text('linked_loan_id'),
  advanceId: text('advance_id'),
  deletedAt: text('deletedAt'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const bankTransactions = sqliteTable('bank_transactions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  bankId: text('bank_id').notNull().references(() => banks.id),
  date: text('date').notNull(),
  type: text('type', { enum: ['deposit', 'withdrawal'] }).notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(),
  expectedAmount: real('expected_amount').notNull(),
  actualAmount: real('actual_amount').notNull(),
  difference: real('difference').notNull(),
  differenceReason: text('difference_reason'),
  contactId: text('contact_id').references(() => contacts.id),
  linkedStockTxId: text('linked_stock_tx_id'),
  linkedLoanId: text('linked_loan_id'),
  advanceId: text('advance_id'),
  deletedAt: text('deletedAt'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const stockTransactions = sqliteTable('stock_transactions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  date: text('date').notNull(),
  stockItemName: text('stock_item_name').notNull(),
  type: text('type', { enum: ['purchase', 'sale'] }).notNull(),
  weight: real('weight').notNull(),
  pricePerKg: real('price_per_kg').notNull(),
  paymentMethod: text('payment_method', { enum: ['cash', 'bank', 'credit'] }).notNull(),
  bankId: text('bank_id').references(() => banks.id),
  description: text('description'),
  expectedAmount: real('expected_amount').notNull(),
  actualAmount: real('actual_amount').notNull(),
  difference: real('difference').notNull(),
  differenceReason: text('difference_reason'),
  contactId: text('contact_id').references(() => contacts.id),
  contactName: text('contact_name'),
  deletedAt: text('deletedAt'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const apArTransactions = sqliteTable('ap_ar_transactions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  date: text('date').notNull(),
  type: text('type', { enum: ['payable', 'receivable', 'advance'] }).notNull(),
  description: text('description').notNull(),
  amount: real('amount').notNull(),
  paidAmount: real('paid_amount').notNull().default(0),
  status: text('status', { enum: ['unpaid', 'partially paid', 'paid'] }).notNull(),
  contactId: text('contact_id').notNull().references(() => contacts.id),
  contactName: text('contact_name'),
  deletedAt: text('deletedAt'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const ledgerPayments = sqliteTable('ledger_payments', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  apArTransactionId: text('ap_ar_transaction_id').notNull().references(() => apArTransactions.id),
  amount: real('amount').notNull(),
  date: text('date').notNull(),
  paymentMethod: text('payment_method', { enum: ['cash', 'bank'] }).notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const loans = sqliteTable('loans', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  contactId: text('contact_id').notNull().references(() => contacts.id),
  type: text('type', { enum: ['payable', 'receivable'] }).notNull(),
  principalAmount: real('principal_amount').notNull(),
  interestRate: real('interest_rate').notNull(),
  issueDate: text('issue_date').notNull(),
  dueDate: text('due_date'),
  notes: text('notes'),
  status: text('status', { enum: ['active', 'paid', 'defaulted'] }).notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const loanPayments = sqliteTable('loan_payments', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  loanId: text('loan_id').notNull().references(() => loans.id),
  paymentDate: text('payment_date').notNull(),
  amount: real('amount').notNull(),
  linkedTransactionId: text('linked_transaction_id'),
  notes: text('notes'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const activityLog = sqliteTable('activity_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull(),
  username: text('username').notNull(),
  description: text('description').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const monthlySnapshots = sqliteTable('monthly_snapshots', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  snapshotDate: text('snapshot_date').notNull(),
  cashBalance: real('cash_balance').notNull(),
  bankBalances: text('bank_balances', { mode: 'json' }).notNull(), // Record<string, number>
  stockItems: text('stock_items', { mode: 'json' }).notNull(), // Record<string, { weight: number, value: number }>
  totalReceivables: real('total_receivables').notNull(),
  totalPayables: real('total_payables').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});
