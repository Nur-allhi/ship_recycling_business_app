# Graph Report - .  (2026-05-01)

## Corpus Check
- 100 files · ~120,246 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 292 nodes · 349 edges · 26 communities detected
- Extraction: 83% EXTRACTED · 17% INFERRED · 0% AMBIGUOUS · INFERRED: 58 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Core Server Actions|Core Server Actions]]
- [[_COMMUNITY_App Context & Data Sync|App Context & Data Sync]]
- [[_COMMUNITY_Auth & User Management|Auth & User Management]]
- [[_COMMUNITY_PDF Utility & Reports|PDF Utility & Reports]]
- [[_COMMUNITY_Bank Transaction Management|Bank Transaction Management]]
- [[_COMMUNITY_Cash Transaction Management|Cash Transaction Management]]
- [[_COMMUNITY_Stock Transaction Management|Stock Transaction Management]]
- [[_COMMUNITY_Sidebar & Layout Navigation|Sidebar & Layout Navigation]]
- [[_COMMUNITY_Initial Balance Setup|Initial Balance Setup]]
- [[_COMMUNITY_Session & Category Management|Session & Category Management]]
- [[_COMMUNITY_Contact Management|Contact Management]]
- [[_COMMUNITY_IndexedDB Database Logic|IndexedDB Database Logic]]
- [[_COMMUNITY_Dashboard Analytics|Dashboard Analytics]]
- [[_COMMUNITY_Recycle Bin Logic|Recycle Bin Logic]]
- [[_COMMUNITY_Mobile Responsive Utilities|Mobile Responsive Utilities]]
- [[_COMMUNITY_Stock Form Submission|Stock Form Submission]]
- [[_COMMUNITY_Project Blueprint & Branding|Project Blueprint & Branding]]
- [[_COMMUNITY_Main Page Navigation|Main Page Navigation]]
- [[_COMMUNITY_Stock Transaction Logic|Stock Transaction Logic]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 89|Community 89]]
- [[_COMMUNITY_Community 90|Community 90]]

## God Nodes (most connected - your core abstractions)
1. `createAdminSupabaseClient()` - 27 edges
2. `handleApiError()` - 27 edges
3. `getSession()` - 27 edges
4. `logActivity()` - 23 edges
5. `useAppActions()` - 8 edges
6. `createSupabaseClient()` - 7 edges
7. `logActivity()` - 7 edges
8. `transferFunds()` - 7 edges
9. `getOrCreateSnapshot()` - 7 edges
10. `emptyRecycleBin()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `RootLayout Component` --implements--> `ShipShape Ledger`  [INFERRED]
  src/app/layout.tsx → docs/blueprint.md
- `Ha-Mim Iron Mart Brand Identity` --conceptually_related_to--> `ShipShape Ledger`  [INFERRED]
  logo.png → docs/blueprint.md
- `checkSessionAndLoad()` --calls--> `handleApiError()`  [INFERRED]
  src/app/context/app-context.tsx → src/lib/actions.ts
- `handleClearLog()` --calls--> `clearActivityLog()`  [INFERRED]
  src/components/activity-log-tab.tsx → src/lib/actions.ts
- `handleTransferSubmit()` --calls--> `transferFunds()`  [INFERRED]
  src/components/bank-tab.tsx → src/lib/actions.ts

## Hyperedges (group relationships)
- **Financial Management System** — blueprint_cash_tracking, blueprint_bank_tracking, blueprint_stock_tracking, actions_addstocktransaction [EXTRACTED 0.90]

## Communities

### Community 0 - "Core Server Actions"
Cohesion: 0.26
Nodes (31): addLoan(), addStockTransaction(), appendData(), applyPaymentToLedger(), batchImportData(), batchReadData(), clearActivityLog(), createAdminSupabaseClient() (+23 more)

### Community 1 - "App Context & Data Sync"
Cohesion: 0.12
Nodes (8): ExportImportTab(), RecordAdvanceDialog(), useAppActions(), useDataSyncer(), useSessionManager(), BankForm(), CashForm(), TransferForm()

### Community 2 - "Auth & User Management"
Cohesion: 0.26
Nodes (13): addUser(), createSupabaseClient(), deleteUser(), getSession(), getUsers(), hasUsers(), logActivity(), login() (+5 more)

### Community 3 - "PDF Utility & Reports"
Cohesion: 0.25
Nodes (11): handleExportPdf(), handleExportPdf(), onSubmit(), formatCurrencyForPdf(), generateBankLedgerPdf(), generateCashLedgerPdf(), generateContactStatementPdf(), generateFooter() (+3 more)

### Community 4 - "Bank Transaction Management"
Cohesion: 0.13
Nodes (2): handlePrint(), handleTransferSubmit()

### Community 5 - "Cash Transaction Management"
Cohesion: 0.13
Nodes (2): handlePrint(), handleTransferSubmit()

### Community 6 - "Stock Transaction Management"
Cohesion: 0.14
Nodes (1): handlePrint()

### Community 7 - "Sidebar & Layout Navigation"
Cohesion: 0.33
Nodes (2): AppSidebar(), useSidebar()

### Community 8 - "Initial Balance Setup"
Cohesion: 0.4
Nodes (2): handleClose(), handleSave()

### Community 9 - "Session & Category Management"
Cohesion: 0.4
Nodes (1): checkSessionAndLoad()

### Community 10 - "Contact Management"
Cohesion: 0.4
Nodes (1): confirmDeletion()

### Community 13 - "IndexedDB Database Logic"
Cohesion: 0.4
Nodes (1): AppDatabase

### Community 14 - "Dashboard Analytics"
Cohesion: 0.67
Nodes (2): formatCurrency(), renderValue()

### Community 16 - "Recycle Bin Logic"
Cohesion: 0.5
Nodes (1): handleEmptyRecycleBin()

### Community 17 - "Mobile Responsive Utilities"
Cohesion: 0.5
Nodes (2): useIsMobile(), ResponsiveDialog()

### Community 23 - "Stock Form Submission"
Cohesion: 0.67
Nodes (1): onSubmit()

### Community 26 - "Project Blueprint & Branding"
Cohesion: 0.67
Nodes (3): ShipShape Ledger, RootLayout Component, Ha-Mim Iron Mart Brand Identity

### Community 27 - "Main Page Navigation"
Cohesion: 0.67
Nodes (3): Authentication Middleware, MainContent Component, renderTabContent Function

### Community 28 - "Stock Transaction Logic"
Cohesion: 0.67
Nodes (3): addStockTransaction Server Action, createAdminSupabaseClient Utility, logActivity Utility

### Community 33 - "Community 33"
Cohesion: 1.0
Nodes (1): handleClearLog()

### Community 41 - "Community 41"
Cohesion: 1.0
Nodes (1): onSubmit()

### Community 86 - "Community 86"
Cohesion: 1.0
Nodes (1): Cash Tracking

### Community 87 - "Community 87"
Cohesion: 1.0
Nodes (1): Bank Tracking

### Community 88 - "Community 88"
Cohesion: 1.0
Nodes (1): Stock Tracking

### Community 89 - "Community 89"
Cohesion: 1.0
Nodes (1): App Hosting Run Configuration

### Community 90 - "Community 90"
Cohesion: 1.0
Nodes (1): useSortedTransactions Hook

## Knowledge Gaps
- **11 isolated node(s):** `Cash Tracking`, `Bank Tracking`, `Stock Tracking`, `App Hosting Run Configuration`, `Ha-Mim Iron Mart Brand Identity` (+6 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Bank Transaction Management`** (15 nodes): `confirmDeletion()`, `formatCurrency()`, `goToNextMonth()`, `goToPreviousMonth()`, `handleDeleteClick()`, `handleEditClick()`, `handleMultiDeleteClick()`, `handlePrint()`, `handleSelectAll()`, `handleSelectRow()`, `handleSort()`, `handleTransferSubmit()`, `renderSortArrow()`, `toggleSelectionMode()`, `bank-tab.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Cash Transaction Management`** (15 nodes): `confirmDeletion()`, `formatCurrency()`, `goToNextMonth()`, `goToPreviousMonth()`, `handleDeleteClick()`, `handleEditClick()`, `handleMultiDeleteClick()`, `handlePrint()`, `handleSelectAll()`, `handleSelectRow()`, `handleSort()`, `handleTransferSubmit()`, `renderSortArrow()`, `toggleSelectionMode()`, `cash-tab.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Stock Transaction Management`** (14 nodes): `confirmDeletion()`, `formatCurrency()`, `goToNextMonth()`, `goToPreviousMonth()`, `handleDeleteClick()`, `handleEditClick()`, `handleMultiDeleteClick()`, `handlePrint()`, `handleSelectAll()`, `handleSelectRow()`, `handleSort()`, `renderSortArrow()`, `toggleSelectionMode()`, `stock-tab.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Sidebar & Layout Navigation`** (6 nodes): `AppSidebar()`, `app-sidebar.tsx`, `sidebar.tsx`, `cn()`, `handleKeyDown()`, `useSidebar()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Initial Balance Setup`** (6 nodes): `handleAddStockItem()`, `handleClose()`, `handleRemoveStockItem()`, `handleSave()`, `handleStockItemChange()`, `initial-balance-dialog.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Session & Category Management`** (5 nodes): `checkSessionAndLoad()`, `handleOffline()`, `handleOnline()`, `isCategory()`, `app-context.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Contact Management`** (5 nodes): `confirmDeletion()`, `handleAddContact()`, `handleDeleteClick()`, `handleViewHistory()`, `contacts-tab.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `IndexedDB Database Logic`** (5 nodes): `AppDatabase`, `.constructor()`, `bulkPut()`, `clearAllData()`, `db.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dashboard Analytics`** (4 nodes): `formatCurrency()`, `renderSubtext()`, `renderValue()`, `dashboard-tab.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Recycle Bin Logic`** (4 nodes): `formatCurrency()`, `handleEmptyRecycleBin()`, `handleRestore()`, `recycle-bin-tab.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Mobile Responsive Utilities`** (4 nodes): `useIsMobile()`, `responsive-dialog.tsx`, `use-mobile.tsx`, `ResponsiveDialog()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Stock Form Submission`** (3 nodes): `if()`, `onSubmit()`, `stock-form.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (2 nodes): `handleClearLog()`, `activity-log-tab.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (2 nodes): `onSubmit()`, `loan-form.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 86`** (1 nodes): `Cash Tracking`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 87`** (1 nodes): `Bank Tracking`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 88`** (1 nodes): `Stock Tracking`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 89`** (1 nodes): `App Hosting Run Configuration`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 90`** (1 nodes): `useSortedTransactions Hook`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `transferFunds()` connect `Core Server Actions` to `Bank Transaction Management`, `Cash Transaction Management`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **Why does `getSession()` connect `Core Server Actions` to `Auth & User Management`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Why does `handleTransferSubmit()` connect `Bank Transaction Management` to `Core Server Actions`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Are the 26 inferred relationships involving `getSession()` (e.g. with `logActivity()` and `readData()`) actually correct?**
  _`getSession()` has 26 INFERRED edges - model-reasoned connections that need verification._
- **Are the 7 inferred relationships involving `useAppActions()` (e.g. with `useSessionManager()` and `useDataSyncer()`) actually correct?**
  _`useAppActions()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Cash Tracking`, `Bank Tracking`, `Stock Tracking` to the rest of the system?**
  _11 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App Context & Data Sync` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._