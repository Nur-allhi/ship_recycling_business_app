// Backward compatibility exports for feature components
// This file maintains compatibility while we transition to the new feature-based structure

// Dashboard
export { DashboardTab } from '@/features/dashboard/components';

// Ledger - moved to ledger feature
export { CashTab, BankTab, CreditTab, PayablesList, ReceivablesList, ContactHistoryDialog, SettlePaymentDialog, RecordAdvanceDialog } from '@/features/ledger/components';

// Transactions - already moved
export { UnifiedTransactionForm } from '@/features/transactions/components';

// Shared components remain in original location
export { DeleteConfirmationDialog } from './delete-confirmation-dialog';
export { EditTransactionSheet } from './edit-transaction-sheet';
export { AppLoading } from './app-loading';
export { LoginForm } from './login-form';
export { default as Logo } from './logo';
export { LayoutProvider } from './layout-provider';

// Admin features - moved to admin feature
export { ActivityLogTab, UserManagementTab, ExportImportTab, RecycleBinTab } from '@/features/admin/components';

// Settings - moved to settings feature
export { SettingsTab } from '@/features/settings/components';

// Stock - moved to stock feature
export { StockTab } from '@/features/stock/components';

// Contacts - moved to contacts feature
export { ClientList, VendorList, ContactsTab } from '@/features/contacts/components';

// Credit/Ledger features - moved to ledger feature
// These exports have been moved to the main ledger feature exports above

// Bank operations - moved to ledger feature
// export { BankTab } from './bank-tab';

// PDF and utilities - moved to shared feature
export { PdfExportDialog, InitialBalanceDialog } from '@/features/shared/components';